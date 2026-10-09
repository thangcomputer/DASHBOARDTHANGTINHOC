import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clapperboard, Loader2, Lock, NotebookPen, PartyPopper, PenLine, Trophy } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import { extractYouTubeId } from '../../../utils/youtubeDuration';
import { resolveRichHtmlMedia, sanitizeRichHtml } from '../../../utils/htmlContent';
import StudentVideoPlayer from '../../lms/StudentVideoPlayer';
import LessonPracticePlayerPage from './LessonPracticePlayerPage';
import LmsPlayerPanels, { LmsTabBar } from '../../lms/LmsPlayerTabs';

function orderedSections(unit) {
  const contents = unit?.contents?.length
    ? unit.contents
    : (unit?.note ? [{ id: 'legacy-note', title: 'Nội dung 1', content: unit.note }] : []);
  const videos = unit?.videos?.length
    ? unit.videos
    : (unit?.videoUrl ? [{ id: 'legacy-video', title: 'Video 1', url: unit.videoUrl }] : []);
  const entries = [];
  const seen = new Set();
  const add = (kind, id, label, icon) => {
    const key = kind === 'practice' ? 'practice' : `${kind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ id: key, kind, itemId: id, label, icon });
  };

  (unit?.contentOrder || []).forEach((entry) => {
    const value = String(entry);
    if (value.startsWith('content:')) {
      const id = value.slice('content:'.length);
      const content = contents.find((item) => String(item.id) === id);
      if (content) add('note', id, content.title || `Nội dung ${contents.indexOf(content) + 1}`, NotebookPen);
    } else if (value.startsWith('video:')) {
      const id = value.slice('video:'.length);
      const video = videos.find((item) => String(item.id) === id);
      if (video) add('video', id, video.title || `Video ${videos.indexOf(video) + 1}`, Clapperboard);
    } else if (value.startsWith('practice:') || value.startsWith('quiz:')) {
      add('practice', 'practice', 'Luyện tập', PenLine);
    }
  });

  contents.forEach((content, index) => add('note', String(content.id), content.title || `Nội dung ${index + 1}`, NotebookPen));
  videos.forEach((video, index) => add('video', String(video.id), video.title || `Video ${index + 1}`, Clapperboard));
  add('practice', 'practice', 'Luyện tập', PenLine);
  return entries;
}

function embedSrc(url) {
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    const origin = encodeURIComponent(window.location.origin);
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&origin=${origin}`;
  }
  const vimeo = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return '';
}

const WATCH_REQUIRED_RATIO = 0.7;
const SEEK_TOLERANCE_SEC = 2;

/** Chống tua: chặn tua vượt vị trí đã xem, chỉ tính giây xem thực tế, hoàn thành khi >= 70%. */
function createWatchGuard() {
  let maxPos = 0;
  let watched = 0;
  let last = 0;
  return {
    tick(time, duration, playing, seekTo, unlocked) {
      const t = Number(time) || 0;
      const d = Number(duration) || 0;
      if (unlocked) { last = t; return false; }
      if (t > maxPos + SEEK_TOLERANCE_SEC) {
        seekTo(maxPos);
        last = maxPos;
        return false;
      }
      const delta = t - last;
      if (playing && delta > 0 && delta <= SEEK_TOLERANCE_SEC) watched += delta;
      maxPos = Math.max(maxPos, t);
      last = t;
      return d > 0 && watched / d >= WATCH_REQUIRED_RATIO;
    },
    reset() { maxPos = 0; watched = 0; last = 0; },
  };
}

function FallbackVideoPane({ unit, done, onWatched, playerApiRef }) {
  const url = unit?.videoUrl || '';
  const vimeoRef = useRef(null);
  const nativeVideoRef = useRef(null);
  const vimeoTimeRef = useRef(0);
  const vimeoDurationRef = useRef(0);
  const [started, setStarted] = useState(false);
  const ended = useRef(false);
  const onWatchedRef = useRef(onWatched);
  const doneRef = useRef(done);
  onWatchedRef.current = onWatched;
  doneRef.current = done;
  useEffect(() => { setStarted(false); ended.current = false; }, [url]);

  const [guard] = useState(() => createWatchGuard());
  const guardRef = useRef(guard);
  useEffect(() => { guard.reset(); }, [url, guard]);
  useEffect(() => {
    if (!playerApiRef) return undefined;
    playerApiRef.current = {
      getCurrentTime: () => Number(nativeVideoRef.current?.currentTime ?? vimeoTimeRef.current) || 0,
      getDuration: () => Number(nativeVideoRef.current?.duration ?? vimeoDurationRef.current) || 0,
    };
    return () => { playerApiRef.current = null; };
  }, [playerApiRef, url]);

  function finish() {
    if (ended.current || doneRef.current) return;
    ended.current = true;
    onWatchedRef.current?.();
  }

  useEffect(() => {
    const vimeo = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (!started || !vimeo || !vimeoRef.current) return undefined;
    const frame = vimeoRef.current;
    let vimeoPlaying = true;
    const listen = () => ['playProgress', 'play', 'pause'].forEach((value) => frame.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value }), '*'));
    const onMessage = (event) => {
      if (!String(event.origin || '').includes('vimeo.com')) return;
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (data?.event === 'ready') {
        listen();
      }
      if (data?.event === 'play') vimeoPlaying = true;
      if (data?.event === 'pause') vimeoPlaying = false;
      if (data?.event === 'playProgress' && data.data) {
        const { seconds, duration } = data.data;
        vimeoTimeRef.current = Number(seconds) || 0;
        vimeoDurationRef.current = Number(duration) || 0;
        if (guardRef.current.tick(seconds, duration, vimeoPlaying, (s) => frame.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: s }), '*'), doneRef.current || unit.antiSeek === false)) finish();
      }
    };
    window.addEventListener('message', onMessage);
    listen();
    return () => window.removeEventListener('message', onMessage);
  }, [started, url]);

  const embedded = embedSrc(url);
  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black aspect-video">
          <iframe ref={vimeoRef} title={unit.title} src={`${embedded}&api=1`} onLoad={() => setStarted(true)} className="h-full w-full" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
        <p className="text-xs font-bold text-slate-500">{done ? 'Đã xem hết video.' : 'Xem tối thiểu 70% video (không tua) để hoàn thành mục này.'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <video ref={nativeVideoRef} key={url} src={resolveMediaUrl(url)} controls controlsList="nodownload noplaybackrate" onTimeUpdate={(e) => { const v = e.currentTarget; if (guardRef.current.tick(v.currentTime, v.duration, !v.paused, (s) => { v.currentTime = s; }, done || unit.antiSeek === false)) finish(); }} className="w-full max-h-[70vh] rounded-2xl bg-black" />
      <p className="text-xs font-bold text-slate-500">{done ? 'Đã xem hết video.' : 'Xem tối thiểu 70% video (không tua) để hoàn thành mục này.'}</p>
    </div>
  );
}

function VideoPane({
  unit, videos, selectedVideo, selectedVideoIndex, onSelectVideo, onWatched, subject, units, videoTab, setVideoTab, user, courseId,
}) {
  const url = selectedVideo?.url || '';
  const videoDone = unit?.videoDoneIds?.includes(selectedVideo?.id);
  const youtubeId = extractYouTubeId(url);
  const playerApiRef = useRef(null);
  const [duration, setDuration] = useState(Number(unit?.videoDurationSeconds) || 0);
  useEffect(() => {
    setDuration(Number(unit?.videoDurationSeconds) || 0);
    const timer = window.setInterval(() => {
      const next = Number(playerApiRef.current?.getDuration?.()) || 0;
      setDuration((current) => (current === next || !next ? current : next));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [unit?.id, selectedVideo?.id, youtubeId]);

  const completedCount = units.filter((row) => row.status === 'completed').length;
  const overallProgress = units.length ? Math.round((completedCount / units.length) * 100) : 0;
  const currentLesson = useMemo(() => ({
    ...unit,
    _id: `${unit.id}-${selectedVideo?.id || 'video'}`,
    title: selectedVideo?.title || unit.title,
    chapterTitle: subject?.name || 'Bài học',
    duration,
    isCompleted: !!videoDone,
    description: unit.description || '',
    videoUrl: url,
  }), [unit, selectedVideo, subject?.name, duration, videoDone, url]);
  const selectedCourse = useMemo(() => ({
    id: courseId || subject?.id || 'lesson-practice',
    title: subject?.name || 'Bài học',
  }), [courseId, subject?.id, subject?.name]);
  const lessons = useMemo(() => [currentLesson], [currentLesson]);
  const groupedLessons = useMemo(() => ({ [subject?.name || 'Bài học']: lessons }), [subject?.name, lessons]);
  const studentId = user?.id || user?._id || 'student';
  const userName = user?.name || user?.fullName || 'Học viên';
  const media = !url ? (
    <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Buổi này chưa có video.</p>
  ) : youtubeId ? (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-black aspect-video">
      <StudentVideoPlayer
        key={`${unit.id}-${selectedVideo?.id}-${youtubeId}`}
        videoId={url}
        lessonId={String(`${unit.id}-${selectedVideo?.id || youtubeId}`)}
        courseId={String(unit.courseId || courseId || subject?.id || 'lesson-practice')}
        initialWatchedSeconds={Number(unit.watchedSeconds) || 0}
        adminDurationSeconds={Number(unit.videoDurationSeconds) || 0}
        antiSeekEnabled={unit.antiSeek !== false}
        lessonCompleted={!!videoDone}
        requiredRatio={WATCH_REQUIRED_RATIO}
        onEligibilityReached={async () => { onWatched?.(selectedVideo?.id); return true; }}
        playerApiRef={playerApiRef}
      />
    </div>
  ) : (
    <FallbackVideoPane
      key={`${unit.id}-${selectedVideo?.id}`}
      unit={{ ...unit, title: selectedVideo?.title || unit.title, videoUrl: url }}
      done={videoDone}
      onWatched={() => onWatched?.(selectedVideo?.id)}
      playerApiRef={playerApiRef}
    />
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h3 className="flex items-center gap-2 px-4 pt-4 text-base font-black text-slate-900">
        <Clapperboard size={17} className="text-red-600" />
        {selectedVideo?.title || `Video ${selectedVideoIndex + 1}`}
        {videoDone && <CheckCircle2 size={16} className="text-emerald-600" />}
      </h3>
      <div className="p-3 sm:p-4">
        {videos.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelectVideo(video.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${selectedVideo?.id === video.id ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-red-200'}`}
              >
                {video.title || `Video ${index + 1}`}
                {unit.videoDoneIds?.includes(video.id) && <CheckCircle2 size={13} />}
              </button>
            ))}
          </div>
        )}
        <div className="w-full">
          {media}
        </div>
      </div>
      <LmsTabBar
        courseTab={videoTab}
        setCourseTab={setVideoTab}
        includeLessonList={false}
        light
        courseId={selectedCourse.id}
        lessonId={currentLesson._id}
        audience="student"
        userId={studentId}
      />
      <div className="min-h-56 bg-white px-4 py-5 sm:px-6">
        <LmsPlayerPanels
          courseTab={videoTab}
          userId={studentId}
          userName={userName}
          selectedCourse={selectedCourse}
          currentLesson={currentLesson}
          lessons={lessons}
          groupedLessons={groupedLessons}
          overallProgress={overallProgress}
          expandedChapters={{}}
          setExpandedChapters={() => {}}
          onSelectLesson={() => {}}
          getCurrentTime={() => Number(playerApiRef.current?.getCurrentTime?.()) || 0}
          antiSeekEnabled={unit.antiSeek !== false}
          audience="student"
          canAnswerQa={false}
          light
        />
      </div>
    </div>
  );
}
function NotePane({ unit, content, done, onMarkRead }) {
  const selectedContent = content;
  const note = String(selectedContent?.content || '').trim();
  const isRichHtml = /<\/?[a-z][^>]*>/i.test(note);
  const safeNoteHtml = isRichHtml
    ? resolveRichHtmlMedia(sanitizeRichHtml(note), resolveMediaUrl)
    : '';
  const contentDone = done || unit?.noteDoneIds?.includes(selectedContent?.id);
  const scroller = useRef(null);
  const [atEnd, setAtEnd] = useState(false);

  function checkEnd() {
    const node = scroller.current;
    if (!node) return;
    if (node.scrollHeight <= node.clientHeight + 8) setAtEnd(true);
    else setAtEnd(node.scrollTop + node.clientHeight >= node.scrollHeight - 16);
  }

  useEffect(() => {
    setAtEnd(false);
    const id = window.requestAnimationFrame(checkEnd);
    return () => window.cancelAnimationFrame(id);
  }, [note, selectedContent?.id]);

  if (!note) return <p className="text-sm text-slate-500">Buổi này chưa có nội dung.</p>;
  return (
    <div className="flex min-h-0 flex-col gap-3">
      {selectedContent?.title && <h3 className="shrink-0 text-base font-black text-slate-800">{selectedContent.title}</h3>}
      {isRichHtml ? (
        <div
          ref={scroller}
          onScroll={checkEnd}
          onLoad={checkEnd}
          className="prose prose-sm h-[min(70vh,48rem)] min-h-80 max-w-none overflow-y-auto text-slate-800 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
          dangerouslySetInnerHTML={{ __html: safeNoteHtml }}
        />
      ) : (
        <div ref={scroller} onScroll={checkEnd} className="h-[min(70vh,48rem)] min-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {note}
        </div>
      )}
      {contentDone ? (
        <p className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
          <CheckCircle2 size={16} /> Đã đọc xong nội dung buổi học.
        </p>
      ) : (
        <button
          type="button"
          disabled={!atEnd}
          onClick={() => onMarkRead?.(selectedContent?.id)}
          className="mt-auto self-start rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {atEnd ? 'Tôi đã đọc xong' : 'Lăn hết nội dung để tích đã đọc'}
        </button>
      )}
    </div>
  );
}

function withSessionLocks(units) {
  let waitingOnEarlier = false;
  return units.map((unit) => {
    const previewAllowed = unit.isPreviewAllowed === true;
    const locked = !!unit.purchaseRequired || (!previewAllowed && (waitingOnEarlier || !!unit.locked));
    if (!previewAllowed && !locked && unit.status !== 'completed') waitingOnEarlier = true;
    return { ...unit, locked };
  });
}

const MOTIVATION = [
  'Mỗi buổi học xong là một bước tiến lớn. Cố lên, bạn đang làm rất tốt!',
  'Kiên trì từng ngày, bạn sẽ giỏi hơn chính mình hôm qua!',
  'Thành công đến từ những bước nhỏ liên tục. Tiếp tục phát huy nhé!',
  'Bạn đã chứng minh được sự nỗ lực của mình. Buổi tiếp theo đang chờ bạn!',
];

function playFireworkSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    const noiseBuffer = (seconds, decay) => {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
      return buffer;
    };
    const tone = (type, freqFrom, freqTo, t, dur, vol) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqFrom, t);
      if (freqTo !== freqFrom) osc.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };
    const noise = (t, dur, decay, filterType, freq, vol) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur, decay);
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(g).connect(master);
      src.start(t);
    };
    const firework = (at, pitch) => {
      const t = ctx.currentTime + at;
      tone('sine', 500 * pitch, 1800 * pitch, t, 0.45, 0.12);
      const b = t + 0.45;
      noise(b, 0.12, 1.5, 'highpass', 1200, 0.9);
      noise(b, 0.9, 2.5, 'lowpass', 900, 0.8);
      tone('sine', 140, 35, b, 0.45, 0.9);
      for (let i = 0; i < 14; i += 1) {
        const c = b + 0.12 + Math.random() * 0.8;
        noise(c, 0.04, 1, 'highpass', 4000 + Math.random() * 3000, 0.22);
      }
    };
    [[0, 1], [0.7, 1.15], [1.4, 0.9], [2.1, 1.25]].forEach(([at, pitch]) => firework(at, pitch));
    [523, 659, 784, 1047].forEach((freq, i) => {
      const t = ctx.currentTime + 0.3 + i * 0.16;
      tone('triangle', freq, freq, t, 0.6, 0.16);
      tone('sine', freq * 2, freq * 2, t, 0.5, 0.05);
    });
    setTimeout(() => ctx.close().catch(() => {}), 5000);
  } catch {
    // Audio may be blocked by the browser.
  }
}
const CELEBRATION_MS = 5000;
const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#facc15'];

function CompletionCelebrationModal({ subjectName, onClose }) {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 3 + Math.random() * 3,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
  })), []);
  const bursts = useMemo(() => [
    { x: 18, y: 28, delay: 0.1 }, { x: 82, y: 24, delay: 0.5 }, { x: 50, y: 14, delay: 1 },
    { x: 28, y: 62, delay: 1.5 }, { x: 74, y: 60, delay: 2 },
  ], []);

  useEffect(() => {
    playFireworkSound();
    const timer = setTimeout(onClose, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Chúc mừng hoàn thành môn học" className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <style>{`
        @keyframes lp-cele-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }
        @keyframes lp-cele-burst { 0% { transform: scale(0); opacity: 1; } 70% { opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes lp-cele-trophy { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.2) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes lp-cele-glow { 0%, 100% { box-shadow: 0 0 40px 8px rgba(251,191,36,.5); } 50% { box-shadow: 0 0 70px 20px rgba(251,191,36,.8); } }
        @keyframes lp-cele-bar { from { width: 100%; } to { width: 0%; } }
        @keyframes lp-cele-in { from { transform: translateY(24px) scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .lp-cele-anim { animation: none !important; } }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {pieces.map((p) => (
          <span key={p.id} className="lp-cele-anim absolute top-0 block" style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.6, background: p.color, borderRadius: p.round ? '50%' : 2, animation: `lp-cele-fall ${p.duration}s linear ${p.delay}s infinite` }} />
        ))}
        {bursts.map((b, i) => (
          <span key={i} className="lp-cele-anim absolute block h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${b.x}%`, top: `${b.y}%`, background: `radial-gradient(circle, ${CONFETTI_COLORS[i]} 0 3px, transparent 4px), repeating-conic-gradient(from 0deg, ${CONFETTI_COLORS[(i + 2) % 7]} 0 4deg, transparent 4deg 20deg)`, WebkitMask: 'radial-gradient(circle, transparent 20%, #000 21%, #000 100%)', mask: 'radial-gradient(circle, transparent 20%, #000 21%, #000 100%)', animation: `lp-cele-burst 1.6s ease-out ${b.delay}s infinite` }} />
        ))}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="lp-cele-anim relative w-full max-w-md overflow-hidden rounded-3xl bg-white text-center shadow-2xl" style={{ animation: 'lp-cele-in .5s ease-out both' }}>
        <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 px-6 pb-10 pt-8">
          <div className="lp-cele-anim mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white/95" style={{ animation: 'lp-cele-trophy .9s ease-out both, lp-cele-glow 2s ease-in-out .9s infinite' }}>
            <Trophy size={64} className="text-amber-500" strokeWidth={2} />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.3em] text-white/90">Hoàn thành môn học</p>
          <h2 className="mt-1 text-2xl font-black text-white">Chúc mừng bạn!</h2>
        </div>
        <div className="px-6 pb-6 pt-5">
          <p className="text-sm font-semibold text-slate-600">Bạn đã hoàn thành xuất sắc tất cả các buổi của môn</p>
          <p className="mt-1 text-xl font-black text-red-600">{subjectName}</p>
          <p className="mt-3 text-sm text-slate-500">Tiếp tục phát huy, thành quả này là bước tiến lớn trên hành trình học tập của bạn.</p>
          <button type="button" onClick={onClose} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-8 text-sm font-black text-white shadow-md transition hover:bg-red-700">Tiếp tục</button>
        </div>
        <div className="h-1.5 bg-slate-100">
          <div className="h-full bg-gradient-to-r from-amber-400 to-red-500" style={{ animation: `lp-cele-bar ${CELEBRATION_MS}ms linear forwards` }} />
        </div>
      </div>
    </div>
  );
}

function CourseCompleteBanner({ title, message, className = 'mt-2' }) {
  return (
    <div className={`${className} overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-amber-50 p-4 text-center`}>
      <style>{`
        @keyframes lp-medal-pop { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.2) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
        @keyframes lp-medal-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes lp-confetti { 0% { transform: translateY(-6px) rotate(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(70px) rotate(360deg); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .lp-anim { animation: none !important; } }
      `}</style>
      <div className="relative mx-auto mb-2 h-20 w-20">
        {[
          ['8%', '#f59e0b', '0s'], ['28%', '#ef4444', '0.4s'], ['50%', '#10b981', '0.8s'], ['70%', '#3b82f6', '0.2s'], ['90%', '#a855f7', '0.6s'],
        ].map(([left, color, delay]) => (
          <span key={left} className="lp-anim absolute top-0 h-2 w-1.5 rounded-sm" style={{ left, background: color, animation: `lp-confetti 1.8s ease-in ${delay} infinite` }} />
        ))}
        <span className="lp-anim absolute inset-0 flex items-center justify-center" style={{ animation: 'lp-medal-pop 0.7s ease-out both, lp-medal-float 2.4s ease-in-out 0.7s infinite' }}>
          <Trophy size={52} className="text-amber-500 drop-shadow" fill="#fde68a" />
        </span>
      </div>
      <p className="flex items-center justify-center gap-1 text-sm font-black text-emerald-700">
        <PartyPopper size={16} /> {title}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-500">{message}</p>
    </div>
  );
}

function pickStarter(units) {
  return units.find((unit) => !unit.locked && unit.status === 'in_progress')
    || units.find((unit) => !unit.locked && unit.status !== 'completed')
    || units.find((unit) => !unit.locked)
    || null;
}

export default function LessonPracticeUnitsPage() {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedCourseId = searchParams.get('courseId') || '';
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openUnitId, setOpenUnitId] = useState('');
  const [section, setSection] = useState('note');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [videoTab, setVideoTab] = useState('overview');
  const [studentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('student_user') || '{}') || {}; }
    catch { return {}; }
  });

  function loadUnits() {
    return lessonPracticeApi.student.units(subjectId, requestedCourseId).then((res) => setPayload(res.data));
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setOpenUnitId('');
    lessonPracticeApi.student.units(subjectId, requestedCourseId)
      .then((res) => { if (alive) setPayload(res.data); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách buổi'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subjectId, requestedCourseId]);

  const units = withSessionLocks(payload?.units || []);
  const openUnit = units.find((unit) => unit.id === openUnitId && !unit.locked) || null;
  const openUnitVideos = openUnit?.videos?.length
    ? openUnit.videos
    : (openUnit?.videoUrl ? [{ id: 'legacy-video', title: 'Video 1', url: openUnit.videoUrl }] : []);
  const openSections = orderedSections(openUnit);
  const activeSection = openSections.find((item) => item.id === section) || openSections[0] || null;
  const selectedVideo = openUnitVideos.find((video) => video.id === (activeSection?.kind === 'video' ? activeSection.itemId : selectedVideoId))
    || openUnitVideos[0]
    || null;
  const selectedContent = (openUnit?.contents?.length
    ? openUnit.contents
    : (openUnit?.note ? [{ id: 'legacy-note', title: 'Nội dung 1', content: openUnit.note }] : []))
    .find((content) => content.id === activeSection?.itemId) || null;
  const allCompleted = units.length > 0 && units.every((unit) => unit.status === 'completed');

  const [celebrating, setCelebrating] = useState(false);
  const wasCompleted = useRef(null);
  useEffect(() => { wasCompleted.current = null; }, [subjectId]);
  useEffect(() => {
    if (!payload || payload.subject?.id !== subjectId) return;
    if (wasCompleted.current === false && allCompleted) setCelebrating(true);
    wasCompleted.current = allCompleted;
  }, [payload, subjectId, allCompleted]);
  const closeCelebration = useCallback(() => setCelebrating(false), []);

  useEffect(() => {
    if (!payload || payload.subject?.id !== subjectId) return undefined;
    const current = units.find((unit) => unit.id === openUnitId);
    if (current && !current.locked) return undefined;
    const starter = pickStarter(units);
    setOpenUnitId(starter?.id || '');
    if (starter) setSection(orderedSections(starter)[0]?.id || '');
    return undefined;
  }, [payload, subjectId, openUnitId, units]);

  function chooseUnit(unit) {
    if (unit.locked) return;
    setOpenUnitId(unit.id);
    setSection(orderedSections(unit)[0]?.id || '');
    setSelectedVideoId('');
    setVideoTab('overview');
  }

  async function markSection(part, itemId = '') {
    if (!openUnitId) return;
    try {
      const res = await lessonPracticeApi.student.markSection(openUnitId, part, itemId);
      setPayload((prev) => prev && ({
        ...prev,
        units: (prev.units || []).map((unit) => (unit.id === openUnitId ? {
          ...unit,
          status: res.data.status,
          videoDone: res.data.videoDone,
          noteDone: res.data.noteDone,
          videoDoneIds: res.data.videoDoneIds || unit.videoDoneIds || [],
          noteDoneIds: res.data.noteDoneIds || unit.noteDoneIds || [],
          practiceDone: res.data.practiceDone,
        } : unit)),
      }));
      if (res.data.status === 'completed') loadUnits().catch(() => {});
    } catch (err) {
      setError(err.message || 'Không ghi nhận được phần này');
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-0 flex-col overflow-hidden">
      {celebrating && <CompletionCelebrationModal subjectName={payload?.subject?.name || ''} onClose={closeCelebration} />}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={() => navigate('/student/lesson-practice')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50">
            <ArrowLeft size={16} /> Trở về
          </button>
          {payload?.subject && <h1 className="text-lg font-black text-slate-900">{payload.subject.name}</h1>}
        </div>
        {payload?.subject?.previewOnly && units.some((unit) => unit.isPreview) && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900">Bạn đang xem thử các buổi được mở của môn học.</p>
          </div>
        )}
      </div>
      {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải buổi học...</div>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && units.length === 0 && <p className="text-sm text-slate-500">Môn này chưa có buổi học.</p>}
      {units.length > 0 && (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2">
            <ol className="space-y-1">
              {units.map((unit, index) => {
                const opened = openUnit?.id === unit.id;
                return (
                  <li key={unit.id} className="pb-2">
                    {unit.locked ? (
                      <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left" aria-disabled="true">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-400">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-slate-400">{unit.title}</span>
                          {!unit.purchaseRequired && (
                            <span className="block text-xs text-slate-400">Hoàn thành buổi trước để mở</span>
                          )}
                        </span>
                        {unit.purchaseRequired ? (
                          <Lock size={15} className="shrink-0 text-slate-400" aria-label="Buổi học bị khóa" />
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-800">
                            <Lock size={14} /> Khóa
                          </span>
                        )}
                      </div>
                    ) : (
                    <button
                      type="button"
                      onClick={() => chooseUnit(unit)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${opened ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ${opened ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-bold ${opened ? 'text-red-700' : 'text-slate-900'}`}>{unit.title}</span>
                        {(unit.status === 'completed' || unit.status === 'in_progress') && (
                          <span className={`block text-xs ${opened ? 'text-red-500' : 'text-slate-500'}`}>
                            {unit.status === 'completed' ? 'Đã xong' : 'Đang học'}
                          </span>
                        )}
                      </span>
                      {unit.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </button>
                    )}
                    {opened && (
                      <div className="mb-1 ml-11 mt-1 space-y-1 pr-2">
                        {orderedSections(unit).map((item) => {
                          const Icon = item.icon;
                          const active = section === item.id;
                          const done = item.kind === 'video'
                            ? unit.videoDoneIds?.includes(item.itemId) || unit.videoDone
                            : item.kind === 'note'
                              ? unit.noteDoneIds?.includes(item.itemId) || unit.noteDone
                              : unit.practiceDone;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSection(item.id)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${active ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50'}`}
                            >
                              <Icon size={15} />
                              <span className="min-w-0 flex-1 text-left">{item.label}</span>
                              {done && <CheckCircle2 size={14} className={active ? 'text-white' : 'text-emerald-600'} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {allCompleted && <CourseCompleteBanner title="Chúc mừng bạn đã hoàn thành khóa học!" message={`Bạn đã hoàn thành tất cả các buổi của môn ${payload?.subject?.name || ''}.`} />}
          </aside>
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-2">
            {openUnit ? (
              <>
                {activeSection?.kind === 'note' && (
                  <div className="mb-4 shrink-0">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{openUnit.title}</p>
                    <h2 className="text-xl font-black text-slate-900">{activeSection.label}</h2>
                  </div>
                )}
                {activeSection?.kind === 'video' && (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {selectedVideo ? (
                      <VideoPane
                        unit={{ ...openUnit, antiSeek: selectedVideo.antiSeek ?? openUnit.antiSeek }}
                        videos={selectedVideo ? [selectedVideo] : []}
                        selectedVideo={selectedVideo}
                        selectedVideoIndex={openUnitVideos.findIndex((video) => video.id === selectedVideo.id)}
                        onSelectVideo={setSelectedVideoId}
                        onWatched={(videoId) => markSection('video', videoId)}
                        subject={payload.subject}
                        units={units}
                        videoTab={videoTab}
                        setVideoTab={setVideoTab}
                        user={studentUser}
                        courseId={requestedCourseId}
                      />
                    ) : (
                      <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Buổi này chưa có video.</p>
                    )}
                  </div>
                )}
                {activeSection?.kind === 'note' && (
                  <div className="flex min-h-[min(76vh,54rem)] flex-1 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                    <NotePane
                      unit={openUnit}
                      content={selectedContent}
                      done={openUnit.noteDoneIds?.includes(selectedContent?.id) || openUnit.noteDone}
                      onMarkRead={(contentId) => markSection('note', contentId)}
                    />
                  </div>
                )}
                {activeSection?.kind === 'practice' && (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <LessonPracticePlayerPage
                      key={openUnit.id}
                      unitId={openUnit.id}
                      embedded
                      onUnitStatus={() => { loadUnits().catch(() => {}); }}
                    />
                    {openUnit.status === 'completed' && (
                      <CourseCompleteBanner
                        className="mt-4"
                        title={`Chúc mừng bạn đã hoàn thành ${openUnit.title}`}
                        message={MOTIVATION[units.findIndex((unit) => unit.id === openUnit.id) % MOTIVATION.length]}
                      />
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Chọn một buổi bên trái để xem video, nội dung buổi học hoặc luyện tập.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
