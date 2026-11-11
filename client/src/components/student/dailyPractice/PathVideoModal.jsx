import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clapperboard, ExternalLink, Loader2, Lock, Play,
} from 'lucide-react';
import StudentVideoPlayer from '../../lms/StudentVideoPlayer';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import BuyXpModal from './BuyXpModal';
import { extractYouTubeId } from '../../../utils/youtubeDuration';
import { lessonResumeUrl } from '../../../utils/learningGoal';
import { gameSounds } from '../../../utils/sound';
import { VIDEO_CHECK_ANSWER_XP } from '../../../utils/dailyPractice';
import { AnswerCheer, CRY_MASCOT, readScreenshot, UploadProgress } from './VideoAnswerFx';

const WATCH_REQUIRED_RATIO = 2 / 3;

function vimeoId(url) {
  const match = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? match[1] : '';
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?|#|$)/i.test(String(url || '')) || /^\/uploads\//.test(String(url || ''));
}

/** Video không phải YouTube: file trực tiếp (theo dõi 2/3 thời lượng) hoặc Vimeo (đánh dấu sau khi mở đủ lâu). */
/** Màn chờ kiểu cửa sổ video: nền xám đậm, nút phát đỏ tròn lớn ở giữa. */
function BigPlayOverlay({ onPlay }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(239,68,68,0.10) 0%, #23262E 55%, #1C1F26 100%)' }}>
      <button
        type="button"
        onClick={onPlay}
        aria-label="Phát video"
        className="flex h-20 w-20 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 sm:h-28 sm:w-28 !shadow-none"
        style={{ background: '#EF3B36', boxShadow: '0 0 32px rgba(220,38,38,0.45), 0 8px 24px rgba(0,0,0,0.35)' }}
      >
        <Play size={40} className="ml-1.5 text-white" fill="white" />
      </button>
    </div>
  );
}

function FallbackPlayer({ url, onWatched, onTick }) {
  const [started, setStarted] = useState(false);
  const doneRef = useRef(false);
  const onWatchedRef = useRef(onWatched);
  const onTickRef = useRef(onTick);
  useEffect(() => { onWatchedRef.current = onWatched; }, [onWatched]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  const vimeo = vimeoId(url);
  const markOnce = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onWatchedRef.current();
  };
  useEffect(() => {
    if (!vimeo || !started) return undefined;
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onWatchedRef.current();
    }, 45000);
    return () => window.clearTimeout(timer);
  }, [vimeo, started]);
  if ((vimeo || isDirectVideo(url)) && !started) {
    return <BigPlayOverlay onPlay={() => setStarted(true)} />;
  }
  if (vimeo) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeo}?autoplay=1`}
        title="Video bài học"
        className="h-full w-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (isDirectVideo(url)) {
    return (
      <video
        src={url}
        className="h-full w-full bg-black object-contain accent-red-500"
        controls
        autoPlay
        playsInline
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget;
          onTickRef.current?.(currentTime, e.currentTarget);
          if (duration > 0 && currentTime / duration >= WATCH_REQUIRED_RATIO) markOnce();
        }}
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-white/80">
      Liên kết video chưa đúng định dạng. Trung tâm sẽ cập nhật sớm.
    </div>
  );
}

/** Popup video của chặng lộ trình - giao diện trình phát Thắng Tin Học. */
/**
 * Popup video của chặng - mở ngay trên trang lộ trình, đóng lại là về đúng chỗ đang xem.
 * Danh sách phát: video riêng của chặng + video buổi bài giảng đã gắn (vẫn có liên kết mở trang bài giảng).
 */
export default function PathVideoModal({ unit, initialVideoId = '', color, onClose, onWatched }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState(initialVideoId);
  const [watchedIds, setWatchedIds] = useState(() => new Set());
  const [passedKeys, setPassedKeys] = useState(() => new Set());
  const [gate, setGate] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [picked, setPicked] = useState(null);
  const [checkHint, setCheckHint] = useState('');
  const [paidHint, setPaidHint] = useState('');
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [xpPacks, setXpPacks] = useState([]);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [missed, setMissed] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
  const [grading, setGrading] = useState(false);
  const [hintStep, setHintStep] = useState(false);
  const playerApiRef = useRef(null);
  const passedRef = useRef(passedKeys);
  const gateRef = useRef(null);
  const currentRef = useRef(null);
  const eligibleRef = useRef(false);
  useEffect(() => { passedRef.current = passedKeys; }, [passedKeys]);

  useEffect(() => {
    let alive = true;
    dailyPracticeApi.student.unitVideos(unit.id)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setWatchedIds(new Set((res.videos || []).filter((video) => video.state === 'completed').map((video) => video.id)));
        setPassedKeys(new Set(res.passedCheckIds || []));
      })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được video của chặng'); });
    return () => { alive = false; };
  }, [unit.id]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const playlist = useMemo(() => [
    ...(data?.videos || []).map((video) => ({ ...video, source: video.source || 'unit' })),
    ...(data?.lesson?.videos || []).map((video) => ({ ...video, source: 'lesson', state: 'active' })),
  ], [data]);
  const playable = playlist.filter((video) => video.state !== 'locked');
  const current = playable.find((video) => video.id === currentId) || playable[0] || null;
  const currentWatched = current ? ((current.source === 'unit' || current.source === 'step') ? watchedIds.has(current.id) : false) : false;
  const lesson = data?.lesson || null;
  currentRef.current = current;

  const pendingOf = (video) => (video?.checks || []).filter((check) => !passedRef.current.has(`${video.id}:${check.id}`));

  const openGate = (check, media) => {
    if (!check || gateRef.current) return;
    if (media) {
      media.pause?.();
      if (media.currentTime > Number(check.atSec) + 1.2) media.currentTime = Number(check.atSec) || 0;
    } else {
      playerApiRef.current?.pause?.();
      const now = playerApiRef.current?.getCurrentTime?.() || 0;
      if (now > Number(check.atSec) + 1.2) playerApiRef.current?.seekTo?.(Number(check.atSec) || 0);
    }
    gateRef.current = check;
    setGate(check);
    setAnswerText('');
    setPicked(null);
    setCheckHint('');
    setPaidHint('');
    setCheckError('');
    setUploadPct(null);
    setGrading(false);
    setHintStep(false);
  };

  const onMediaTick = (time, media) => {
    const video = currentRef.current;
    if (!video || video.source === 'lesson') return;
    if (gateRef.current) {
      const at = Number(gateRef.current.atSec) || 0;
      if (media) {
        media.pause?.();
        if (media.currentTime > at + 1.2) media.currentTime = at;
      } else {
        playerApiRef.current?.pause?.();
        if (time > at + 1.2) playerApiRef.current?.seekTo?.(at);
      }
      return;
    }
    const check = pendingOf(video).sort((a, b) => a.atSec - b.atSec).find((item) => time + 0.3 >= Number(item.atSec));
    if (check) openGate(check, media);
  };

  useEffect(() => {
    eligibleRef.current = false;
    gateRef.current = null;
    setGate(null);
  }, [current?.id]);

  useEffect(() => {
    if (!current || !extractYouTubeId(current.url) || current.source === 'lesson') return undefined;
    const timer = window.setInterval(() => {
      const time = playerApiRef.current?.getCurrentTime?.();
      if (typeof time === 'number') onMediaTick(time, null);
    }, 400);
    return () => window.clearInterval(timer);
  }, [current?.id, current?.url]);

  const markWatched = async () => {
    eligibleRef.current = true;
    if (!current || (current.source !== 'unit' && current.source !== 'step') || watchedIds.has(current.id)) return true;
    if (pendingOf(current).length) {
      if (!extractYouTubeId(current.url) && !isDirectVideo(current.url)) {
        openGate(pendingOf(current).slice().sort((a, b) => a.atSec - b.atSec)[0], null);
      }
      return false;
    }
    const videoId = current.id;
    setWatchedIds((prev) => new Set(prev).add(videoId));
    gameSounds.correct();
    try {
      await onWatched(videoId);
    } catch { /* lần sau xem lại sẽ ghi tiếp */ }
    const nextVideo = playable.find((video) => (
      video.id !== videoId
      && video.state !== 'locked'
      && !watchedIds.has(video.id)
      && (video.source === 'unit' || video.source === 'step')
    ));
    if (nextVideo) setCurrentId(nextVideo.id);
    return true;
  };

  const finishCheck = (checkId) => {
    const key = `${current.id}:${checkId}`;
    const next = new Set(passedRef.current);
    next.add(key);
    passedRef.current = next;
    setPassedKeys(next);
    gateRef.current = null;
    setGate(null);
    setCheer(false);
    setMissed(false);
    playerApiRef.current?.play?.();
    if (eligibleRef.current) markWatched();
  };

  const submitCheck = async (imageDataUrl) => {
    if (!gate || !current || checkBusy || cheer) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const res = await dailyPracticeApi.student.answerVideoCheck(unit.id, current.id, gate.id, {
        choiceIndex: picked,
        text: answerText,
        imageDataUrl: imageDataUrl || '',
      });
      if (res.correct) {
        setMissed(false);
        gameSounds.win();
        setCheer(true);
      } else if (res.needsReview) {
        setMissed(false);
        setCheckHint(res.hint || 'Chưa đủ ý để kết luận. Hãy viết rõ hơn, lần này không mất XP.');
      } else {
        setMissed(true);
        setPicked(null);
        setAnswerText('');
        setCheckHint(res.hint || 'Bài này chưa được.');
        gameSounds.wrong();
      }
    } catch (err) {
      setMissed(false);
      if (err.status === 402) openBuyXp();
      else setCheckError(err.message || 'Chưa gửi được câu trả lời');
    } finally {
      setCheckBusy(false);
    }
  };

  const sendScreenshot = async (file) => {
    if (!file || checkBusy || uploadPct != null) return;
    setMissed(false);
    setCheckError('');
    setUploadPct(4);
    setGrading(false);
    try {
      const dataUrl = await readScreenshot(file, setUploadPct);
      setGrading(true);
      await submitCheck(dataUrl);
    } catch (err) {
      setCheckError(err.message || 'Không tải được ảnh');
    } finally {
      setUploadPct(null);
      setGrading(false);
    }
  };

  const openBuyXp = () => {
    setBuyXpOpen(true);
    dailyPracticeApi.student.overview()
      .then((data) => setXpPacks(data?.stats?.xpPacks || []))
      .catch(() => { });
  };

  const buyHint = async () => {
    if (!gate || !current || checkBusy) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const data = await dailyPracticeApi.student.overview();
      const cost = Number(gate.hintCostXp) || 0;
      const xp = Number(data?.stats?.xpTotal) || 0;
      if (cost > 0 && xp < cost) {
        setXpPacks(data?.stats?.xpPacks || []);
        setBuyXpOpen(true);
        setCheckBusy(false);
        return;
      }
    } catch { /* server vẫn chặn nếu không đủ */ }
    try {
      const res = await dailyPracticeApi.student.buyVideoHint(unit.id, current.id, gate.id);
      setPaidHint(res.hint || '');
      setHintStep(true);
    } catch (err) {
      if (err.status === 402) openBuyXp();
      else setCheckError(err.message || 'Chưa đổi được gợi ý');
    } finally {
      setCheckBusy(false);
    }
  };

  const openLessonPage = () => {
    onClose();
    navigate(lessonResumeUrl({ subjectId: lesson.subjectId, unitId: lesson.unitId }));
  };

  return createPortal(
    <div className="dp-video-backdrop fixed inset-0 z-[9600] flex items-center justify-center p-3 sm:p-6" role="presentation" onClick={onClose}>
      <div
        className="dp-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] bg-[#1C1F26] shadow-[0_30px_80px_rgba(69,10,10,0.55)] ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-label={`Video chặng ${unit.index}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/5 bg-[#16181E] px-4 py-3">
          <span
            className="max-w-[42%] shrink-0 truncate rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white"
            style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
            title={`Chặng ${unit.index} · ${unit.title}`}
          >
            Chặng {unit.index} · {unit.title}
          </span>
          <h2 className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-left text-base font-black text-white" title={current?.title || ''}>
            <Clapperboard size={16} className="shrink-0 text-red-400" aria-hidden="true" />
            <span className="line-clamp-2 break-words">{current?.title || 'Video của chặng'}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="cms-btn cms-btn-primary cms-btn-brand shrink-0 !py-2 !px-4 text-sm font-black">
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative aspect-video w-full overflow-hidden bg-[#23262E]">
            {!data && !error && (
              <p className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-white/70"><Loader2 size={18} className="animate-spin" /> Đang tải video…</p>
            )}
            {error && <p className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-amber-300">{error}</p>}
            {data && !current && (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm font-semibold text-white/75">
                <Lock size={22} />
                {lesson?.locked ? lesson.message : 'Chặng này chưa có video.'}
              </div>
            )}
            {current && (extractYouTubeId(current.url) ? (
              <StudentVideoPlayer
                key={`${unit.id}-${current.id}`}
                videoId={current.url}
                lessonId={`dp-${unit.id}-${current.id}`}
                courseId="daily-practice"
                antiSeekEnabled={!currentWatched}
                lessonCompleted={currentWatched}
                requiredRatio={WATCH_REQUIRED_RATIO}
                onEligibilityReached={markWatched}
                playerApiRef={playerApiRef}
                appearance="window"
              />
            ) : (
              <FallbackPlayer key={`${unit.id}-${current.id}`} url={current.url} onWatched={markWatched} onTick={onMediaTick} />
            ))}
            {cheer && gate && <AnswerCheer onDone={() => finishCheck(gate.id)} />}
            {gate && !cheer && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
                <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 text-slate-900 shadow-xl">
                  <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Dừng ở giây {gate.atSec}</p>
                  {missed && (
                    <div className="flex items-center gap-3 rounded-xl bg-rose-50 px-3 py-2">
                      <img src={CRY_MASCOT} alt="" className="h-16 w-16 object-contain" />
                      <p className="text-sm font-black text-rose-700">
                        {gate.kind === 'screen'
                          ? `AI chưa chấp nhận. Mất ${VIDEO_CHECK_ANSWER_XP} XP. Hãy tải đáp án mới.`
                          : gate.kind === 'text'
                            ? `Chưa đúng ý. Mất ${VIDEO_CHECK_ANSWER_XP} XP. Hãy nhập lại.`
                            : `Chưa đúng. Mất ${VIDEO_CHECK_ANSWER_XP} XP. Hãy chọn lại.`}
                      </p>
                    </div>
                  )}
                  <p className="text-base font-black">{gate.prompt}</p>
                  {hintStep && paidHint ? (
                    <div className="space-y-3">
                      <p className="rounded-xl bg-sky-50 px-3 py-3 text-sm font-semibold leading-relaxed text-sky-900">{paidHint}</p>
                      <button type="button" onClick={() => finishCheck(gate.id)} className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black text-white !shadow-none">Tiếp tục xem</button>
                    </div>
                  ) : (
                    <>
                      {gate.kind === 'choice' && (
                        <div className="space-y-1.5">
                          {(gate.choices || []).map((choice, index) => (
                            <button key={index} type="button" onClick={() => setPicked(index)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-bold !shadow-none ${picked === index ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                              {choice}
                            </button>
                          ))}
                        </div>
                      )}
                      {gate.kind === 'text' && (
                        <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold" value={answerText} placeholder="Nhập đáp án" onChange={(e) => setAnswerText(e.target.value)} />
                      )}
                      {gate.kind === 'screen' && (uploadPct != null ? (
                        <UploadProgress percent={uploadPct} grading={grading} />
                      ) : (
                        <label className="block cursor-pointer rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-bold text-slate-700">
                          {missed ? 'Tải đáp án mới' : 'Gửi ảnh'}
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { sendScreenshot(e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                      ))}
                      {checkHint && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{checkHint}</p>}
                      {paidHint && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">{paidHint}</p>}
                      {checkError && <p className="text-sm font-semibold text-red-600">{checkError}</p>}
                      <div className="flex flex-wrap gap-2">
                        {gate.kind !== 'screen' && (
                          <button type="button" disabled={checkBusy || (gate.kind === 'choice' ? picked == null : !answerText.trim())} onClick={() => submitCheck('')} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50 !shadow-none">
                            {checkBusy ? 'Đang chấm…' : 'Trả lời'}
                          </button>
                        )}
                        <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 !shadow-none">Thôi</button>
                        {Number(gate.hintCostXp) > 0 && (
                          <button type="button" disabled={checkBusy} onClick={buyHint} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white !shadow-none">
                            {checkBusy ? 'Đang lấy gợi ý…' : `Gợi ý thêm · ${gate.hintCostXp} XP`}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Đúng lần đầu +{VIDEO_CHECK_ANSWER_XP} XP và xem tiếp. Sai mất {VIDEO_CHECK_ANSWER_XP} XP rồi {gate.kind === 'screen' ? 'tải đáp án mới' : gate.kind === 'text' ? 'nhập lại' : 'chọn lại'}.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {playlist.length > 0 && (
            <div className="space-y-1.5 px-4 pt-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-white/50">Danh sách video ({playlist.length})</p>
              {playlist.map((video, index) => {
                const active = current?.id === video.id;
                const locked = video.state === 'locked';
                const done = video.source === 'unit' && watchedIds.has(video.id);
                return (
                  <button
                    key={video.id}
                    type="button"
                    disabled={locked}
                    onClick={() => { gameSounds.tap(); setCurrentId(video.id); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition !shadow-none ${active ? 'bg-white/15 ring-1 ring-white/25' : 'hover:bg-white/10'} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: active ? '#EF3B36' : 'rgba(255,255,255,0.12)' }}>
                      {locked ? <Lock size={12} /> : active ? <Play size={12} fill="white" className="text-white" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{video.title}</span>
                      <span className="block text-[11px] font-semibold text-white/50">
                        {video.source === 'lesson' ? `Bài giảng · ${lesson?.title || ''}` : video.stepLabel ? `${video.stepLabel} · Video cấp` : 'Video chặng'}
                      </span>
                    </span>
                    {done && <CheckCircle2 size={16} className="shrink-0 text-emerald-400" aria-label="Đã xem" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          {current?.source === 'unit' || current?.source === 'step' ? (currentWatched ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300">
              <CheckCircle2 size={14} /> Đã xem video này
            </span>
          ) : null) : <span />}
          <div className={`flex flex-wrap gap-2 ${lesson ? 'ml-auto' : 'w-full justify-end'}`}>
            {lesson && (
              <button type="button" onClick={openLessonPage} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 !shadow-none">
                <ExternalLink size={15} /> Mở trang bài giảng
              </button>
            )}
          </div>
        </div>
      </div>
      {buyXpOpen && (
        <BuyXpModal packs={xpPacks} onClose={() => setBuyXpOpen(false)} onPaid={() => setBuyXpOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
