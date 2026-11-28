import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clapperboard, Lock } from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import { extractYouTubeId } from '../../../utils/youtubeDuration';
import { resolveRichHtmlMedia, sanitizeRichHtml } from '../../../utils/htmlContent';
import StudentVideoPlayer from '../../lms/StudentVideoPlayer';
import LmsPlayerPanels, { LmsTabBar } from '../../lms/LmsPlayerTabs';

const WATCH_REQUIRED_RATIO = 0.7;
const SEEK_TOLERANCE_SEC = 2;

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

function createWatchGuard() {
  let maxPos = 0;
  let watched = 0;
  let last = 0;
  return {
    tick(time, duration, playing, seekTo, unlocked) {
      const t = Number(time) || 0;
      const d = Number(duration) || 0;
      if (unlocked) {
        const delta = t - last;
        if (playing && delta > 0 && delta <= SEEK_TOLERANCE_SEC) watched += delta;
        last = t;
        this.ratio = d > 0 ? watched / d : 0;
        return d > 0 && watched / d >= WATCH_REQUIRED_RATIO;
      }
      if (t > maxPos + SEEK_TOLERANCE_SEC) {
        seekTo(maxPos);
        last = maxPos;
        return false;
      }
      const delta = t - last;
      if (playing && delta > 0 && delta <= SEEK_TOLERANCE_SEC) watched += delta;
      maxPos = Math.max(maxPos, t);
      last = t;
      this.ratio = d > 0 ? watched / d : 0;
      return d > 0 && watched / d >= WATCH_REQUIRED_RATIO;
    },
    ratio: 0,
    reset() { maxPos = 0; watched = 0; last = 0; this.ratio = 0; },
  };
}

function FallbackVideoPane({
  unit, done, onWatched, onXpWatched, playerApiRef,
  maxCheckpointSec = null,
  checkpointGateModal = null,
}) {
  const url = unit?.videoUrl || '';
  const vimeoRef = useRef(null);
  const nativeVideoRef = useRef(null);
  const wrapRef = useRef(null);
  const vimeoTimeRef = useRef(0);
  const vimeoDurationRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const ended = useRef(false);
  const xpSent = useRef(false);
  const onWatchedRef = useRef(onWatched);
  const doneRef = useRef(done);
  const maxCpRef = useRef(maxCheckpointSec);
  onWatchedRef.current = onWatched;
  doneRef.current = done;
  maxCpRef.current = maxCheckpointSec;
  useEffect(() => { setStarted(false); ended.current = false; xpSent.current = false; }, [url]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === wrapRef.current || document.fullscreenElement === nativeVideoRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const [guard] = useState(() => createWatchGuard());
  const guardRef = useRef(guard);
  useEffect(() => { guard.reset(); }, [url, guard]);
  useEffect(() => {
    if (!playerApiRef) return undefined;
    playerApiRef.current = {
      getCurrentTime: () => Number(nativeVideoRef.current?.currentTime ?? vimeoTimeRef.current) || 0,
      getDuration: () => Number(nativeVideoRef.current?.duration ?? vimeoDurationRef.current) || 0,
      pause: () => {
        if (nativeVideoRef.current) nativeVideoRef.current.pause?.();
        else if (vimeoRef.current?.contentWindow) {
          vimeoRef.current.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
        }
      },
      play: () => {
        if (nativeVideoRef.current) nativeVideoRef.current.play?.()?.catch?.(() => {});
        else if (vimeoRef.current?.contentWindow) {
          vimeoRef.current.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
        }
      },
      seekTo: (sec) => {
        const target = Math.max(0, Number(sec) || 0);
        if (nativeVideoRef.current) {
          nativeVideoRef.current.currentTime = target;
        } else if (vimeoRef.current?.contentWindow) {
          vimeoRef.current.contentWindow.postMessage(JSON.stringify({ method: 'setCurrentTime', value: target }), '*');
        }
      },
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
      if (data?.event === 'ready') listen();
      if (data?.event === 'play') vimeoPlaying = true;
      if (data?.event === 'pause') vimeoPlaying = false;
      if (data?.event === 'playProgress' && data.data) {
        const { seconds, duration } = data.data;
        vimeoTimeRef.current = Number(seconds) || 0;
        vimeoDurationRef.current = Number(duration) || 0;
        const cpCap = typeof maxCpRef.current === 'number' ? Math.max(0, maxCpRef.current) : Number.POSITIVE_INFINITY;
        if (vimeoTimeRef.current > cpCap + 0.35) {
          frame.contentWindow?.postMessage(JSON.stringify({ method: 'pause' }), '*');
          frame.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: cpCap }), '*');
        }
        const g = guardRef.current;
        if (g.tick(seconds, duration, vimeoPlaying, (s) => frame.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: s }), '*'), doneRef.current || unit.antiSeek !== true)) finish();
        if (!xpSent.current && g.ratio >= 0.9) { xpSent.current = true; onXpWatched?.(); }
      }
    };
    window.addEventListener('message', onMessage);
    listen();
    return () => window.removeEventListener('message', onMessage);
  }, [started, url, unit.antiSeek]);

  const embedded = embedSrc(url);
  const gateNode = typeof checkpointGateModal === 'function'
    ? checkpointGateModal({ isFullscreen })
    : checkpointGateModal;

  if (embedded) {
    return (
      <div ref={wrapRef} className="relative space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-black">
          <iframe
            ref={vimeoRef}
            title={unit.title}
            src={`${embedded}&api=1`}
            onLoad={() => setStarted(true)}
            className="h-full w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          {gateNode}
        </div>
      </div>
    );
  }
  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={nativeVideoRef}
        key={url}
        src={resolveMediaUrl(url)}
        controls
        controlsList="nodownload"
        onPlay={(e) => {
          const cpCap = typeof maxCpRef.current === 'number' ? Math.max(0, maxCpRef.current) : Number.POSITIVE_INFINITY;
          if (e.currentTarget.currentTime >= cpCap - 0.15) {
            e.currentTarget.pause();
            e.currentTarget.currentTime = cpCap;
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          const cpCap = typeof maxCpRef.current === 'number' ? Math.max(0, maxCpRef.current) : Number.POSITIVE_INFINITY;
          if (v.currentTime > cpCap + 0.35) {
            v.pause();
            v.currentTime = cpCap;
            return;
          }
          const g = guardRef.current;
          if (g.tick(v.currentTime, v.duration, !v.paused, (s) => { v.currentTime = s; }, done || unit.antiSeek !== true)) finish();
          if (!xpSent.current && g.ratio >= 0.9) { xpSent.current = true; onXpWatched?.(); }
        }}
        className="max-h-[70vh] w-full rounded-2xl bg-black"
      />
      {gateNode}
    </div>
  );
}

export function VideoPane({
  unit, videos, selectedVideo, selectedVideoIndex, onSelectVideo, onWatched, onXpWatched, subject, units, videoTab, setVideoTab, user, courseId,
  compact = false,
  checkpoints = [],
  onSelectCheckpoint = null,
  onPlaybackUpdate = null,
  playerControlRef = null,
  checkpointGateModal = null,
  maxCheckpointSec = null,
}) {
  const url = selectedVideo?.url || '';
  const videoDone = unit?.videoDoneIds?.includes(selectedVideo?.id);
  const youtubeId = extractYouTubeId(url);
  const playerApiRef = useRef(null);
  const maxReachedRef = useRef(0);
  const onPlaybackUpdateRef = useRef(onPlaybackUpdate);
  onPlaybackUpdateRef.current = onPlaybackUpdate;
  const [duration, setDuration] = useState(Number(unit?.videoDurationSeconds) || 0);

  useEffect(() => {
    maxReachedRef.current = 0;
  }, [unit?.id, selectedVideo?.id]);

  useEffect(() => {
    if (!playerControlRef) return undefined;
    playerControlRef.current = {
      getCurrentTime: () => Number(playerApiRef.current?.getCurrentTime?.()) || 0,
      getDuration: () => Number(playerApiRef.current?.getDuration?.()) || duration || 0,
      play: () => playerApiRef.current?.play?.(),
      pause: () => playerApiRef.current?.pause?.(),
      seekTo: (sec, opts) => playerApiRef.current?.seekTo?.(sec, opts || { allowAdvance: true }),
    };
    return () => { playerControlRef.current = null; };
  }, [playerControlRef, duration, unit?.id, selectedVideo?.id]);

  useEffect(() => {
    setDuration(Number(unit?.videoDurationSeconds) || 0);
    const timer = window.setInterval(() => {
      const api = playerApiRef.current;
      const nextDur = Number(api?.getDuration?.()) || 0;
      const curTime = Number(api?.getCurrentTime?.()) || 0;
      if (nextDur > 0) setDuration((current) => (current === nextDur ? current : nextDur));
      if (curTime > maxReachedRef.current) maxReachedRef.current = curTime;
      onPlaybackUpdateRef.current?.({
        currentTime: curTime,
        duration: nextDur || Number(unit?.videoDurationSeconds) || 0,
        maxReachedTime: maxReachedRef.current,
      });
    }, 350);
    return () => window.clearInterval(timer);
  }, [unit?.id, selectedVideo?.id, youtubeId, unit?.videoDurationSeconds]);

  const completedCount = (units || []).filter((row) => row.status === 'completed').length;
  const overallProgress = units?.length ? Math.round((completedCount / units.length) * 100) : 0;
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
  const antiSeek = selectedVideo?.antiSeek === true || (selectedVideo?.antiSeek === undefined && unit?.antiSeek === true);

  const media = !url ? (
    <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Chưa có link video.</p>
  ) : youtubeId ? (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-black">
      <StudentVideoPlayer
        key={`${unit.id}-${selectedVideo?.id}-${youtubeId}`}
        videoId={url}
        lessonId={String(`${unit.id}-${selectedVideo?.id || youtubeId}`)}
        courseId={String(unit.courseId || courseId || subject?.id || 'lesson-practice')}
        initialWatchedSeconds={Number(unit.watchedSeconds) || 0}
        adminDurationSeconds={Number(unit.videoDurationSeconds) || 0}
        antiSeekEnabled={antiSeek}
        lessonCompleted={!!videoDone}
        requiredRatio={WATCH_REQUIRED_RATIO}
        onEligibilityReached={async () => { onWatched?.(selectedVideo?.id); return true; }}
        onXpRatioReached={async (ratio) => { await onXpWatched?.(selectedVideo?.id, ratio); }}
        playerApiRef={playerApiRef}
        checkpoints={checkpoints}
        onSelectCheckpoint={onSelectCheckpoint}
        checkpointGateModal={checkpointGateModal}
        maxCheckpointSec={maxCheckpointSec}
      />
    </div>
  ) : (
    <FallbackVideoPane
      key={`${unit.id}-${selectedVideo?.id}`}
      unit={{ ...unit, antiSeek, title: selectedVideo?.title || unit.title, videoUrl: url }}
      done={videoDone}
      onWatched={() => onWatched?.(selectedVideo?.id)}
      onXpWatched={() => onXpWatched?.(selectedVideo?.id, 0.9)}
      playerApiRef={playerApiRef}
      checkpointGateModal={checkpointGateModal}
      maxCheckpointSec={maxCheckpointSec}
    />
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
          <Clapperboard size={17} className="text-emerald-600" />
          {selectedVideo?.title || `Video ${selectedVideoIndex + 1}`}
          {videoDone && <CheckCircle2 size={16} className="text-emerald-600" />}
        </h3>
        {!compact && !videoDone && onWatched && selectedVideo?.id ? (
          <button
            type="button"
            onClick={() => onWatched(selectedVideo.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100"
          >
            <CheckCircle2 size={14} /> Đánh dấu đã xem
          </button>
        ) : null}
      </div>
      <div className="p-3 sm:p-4">
        {videos.length > 1 && onSelectVideo && (
          <div className="mb-3 flex flex-wrap gap-2">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelectVideo(video.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${selectedVideo?.id === video.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200'}`}
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
      {!compact && (<>
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
      <div className="min-h-40 bg-white px-4 py-4 sm:px-6">
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
          setExpandedChapters={() => { }}
          onSelectLesson={() => { }}
          getCurrentTime={() => Number(playerApiRef.current?.getCurrentTime?.()) || 0}
          onSeekTo={(sec) => {
            playerApiRef.current?.seekTo?.(sec);
            playerApiRef.current?.play?.();
          }}
          antiSeekEnabled={antiSeek}
          audience="student"
          canAnswerQa={false}
          light
        />
      </div>
      </>)}
    </div>
  );
}

export function NotePane({ unit, content, done, onMarkRead }) {
  const [busy, setBusy] = useState(false);
  const note = String(content?.content || '').trim();
  const isRichHtml = /<\/?[a-z][^>]*>/i.test(note);
  const safeNoteHtml = isRichHtml
    ? resolveRichHtmlMedia(sanitizeRichHtml(note), resolveMediaUrl)
    : '';
  const contentDone = Boolean(done || (content?.id && unit?.noteDoneIds?.includes(content.id)));

  if (!note) {
    return <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Chưa có nội dung đọc.</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      {content?.title && <h3 className="text-lg font-black text-slate-900">{content.title}</h3>}
      {isRichHtml ? (
        <div
          className="prose prose-sm max-w-none text-slate-800 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
          dangerouslySetInnerHTML={{ __html: safeNoteHtml }}
        />
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
          {note}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        {contentDone ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={16} /> Đã đánh dấu đã đọc
          </p>
        ) : onMarkRead && content?.id ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onMarkRead(content.id);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <CheckCircle2 size={15} />
            Đánh dấu đã đọc
          </button>
        ) : <span />}
      </div>
    </div>
  );
}
