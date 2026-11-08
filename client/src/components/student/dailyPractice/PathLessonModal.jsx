import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CheckCircle2, Loader2, Play, X } from 'lucide-react';
import StudentVideoPlayer from '../../lms/StudentVideoPlayer';
import { resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import BuyXpModal from './BuyXpModal';
import { extractYouTubeId } from '../../../utils/youtubeDuration';
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

function CheckCard({
  gate, picked, setPicked, answerText, setAnswerText, checkHint, paidHint, checkError, checkBusy, missed, uploadPct, grading, hintStep, onHintNext, onSubmit, onFile, onHint, onQuit,
}) {
  if (!gate) return null;
  return (
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
        <p className="text-lg font-black leading-snug">{gate.prompt}</p>
        {hintStep && paidHint ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-sky-50 px-3 py-3 text-sm font-semibold leading-relaxed text-sky-900">{paidHint}</p>
            <button type="button" onClick={onHintNext} className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black text-white !shadow-none">Tiếp tục xem</button>
          </div>
        ) : (
        <>
        {gate.kind === 'choice' && (
          <div className="space-y-1.5">
            {(gate.choices || []).map((choice, index) => (
              <button key={index} type="button" onClick={() => setPicked(index)} className={`block w-full rounded-xl px-3 py-2.5 text-left text-base font-bold !shadow-none ${picked === index ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                {choice}
              </button>
            ))}
          </div>
        )}
        {gate.kind === 'text' && (
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base font-semibold" value={answerText} placeholder="Nhập đáp án" onChange={(e) => setAnswerText(e.target.value)} />
        )}
        {gate.kind === 'screen' && (uploadPct != null ? (
          <UploadProgress percent={uploadPct} grading={grading} />
        ) : (
          <label className="block cursor-pointer rounded-xl bg-slate-100 px-3 py-3 text-center text-base font-bold text-slate-700">
            {missed ? 'Tải đáp án mới' : 'Gửi ảnh'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        ))}
        {checkHint && !hintStep && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{checkHint}</p>}
        {paidHint && !hintStep && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">{paidHint}</p>}
        {checkError && <p className="text-sm font-semibold text-red-600">{checkError}</p>}
        <div className="flex flex-wrap gap-2">
          {gate.kind !== 'screen' && (
            <button type="button" disabled={checkBusy || (gate.kind === 'choice' ? picked == null : !answerText.trim())} onClick={() => onSubmit('')} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50 !shadow-none">
              {checkBusy ? 'Đang chấm…' : 'Trả lời'}
            </button>
          )}
          <button type="button" onClick={onQuit} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 !shadow-none">Thôi</button>
          {Number(gate.hintCostXp) > 0 && (
            <button type="button" disabled={checkBusy} onClick={onHint} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white !shadow-none">
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
  );
}

/** Popup một bài học: nội dung chữ to + video chống tua, dừng để trả lời mốc. */
export default function PathLessonModal({
  lesson, unitId, color, onClose, onComplete,
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(lesson?.state === 'completed');
  const [watchedEnough, setWatchedEnough] = useState(lesson?.state === 'completed');
  const [passedKeys, setPassedKeys] = useState(() => new Set());
  const [gate, setGate] = useState(null);
  const [picked, setPicked] = useState(null);
  const [answerText, setAnswerText] = useState('');
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
  const [started, setStarted] = useState(false);
  const playerApiRef = useRef(null);
  const passedRef = useRef(passedKeys);
  const gateRef = useRef(null);
  const maxSeenRef = useRef(0);
  const video = lesson?.videos?.[0] || null;
  const content = String(lesson?.content || video?.content || '').trim();
  const url = String(video?.url || '').trim();
  const title = lesson?.title || video?.title || lesson?.label || 'Bài học';
  const body = useMemo(() => content.split(/\n+/).filter(Boolean), [content]);
  const yt = extractYouTubeId(url);
  const vimeo = vimeoId(url);
  const checks = video?.checks || [];

  useEffect(() => { passedRef.current = passedKeys; }, [passedKeys]);
  useEffect(() => { gateRef.current = gate; }, [gate]);

  useEffect(() => {
    if (!unitId) return undefined;
    let alive = true;
    dailyPracticeApi.student.unitVideos(unitId)
      .then((res) => { if (alive) setPassedKeys(new Set(res.passedCheckIds || [])); })
      .catch(() => {});
    return () => { alive = false; };
  }, [unitId]);

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

  const pending = checks.filter((check) => !passedKeys.has(`${video?.id}:${check.id}`));

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
    setPicked(null);
    setAnswerText('');
    setCheckHint('');
    setPaidHint('');
    setCheckError('');
    setMissed(false);
    setCheer(false);
    setUploadPct(null);
    setGrading(false);
    setHintStep(false);
  };

  const onTick = (time, media) => {
    if (!video) return;
    maxSeenRef.current = Math.max(maxSeenRef.current, Math.min(time, (gateRef.current ? Number(gateRef.current.atSec) : time)));
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
    const next = checks
      .filter((check) => !passedRef.current.has(`${video.id}:${check.id}`))
      .sort((a, b) => a.atSec - b.atSec)
      .find((check) => time + 0.3 >= Number(check.atSec));
    if (next) openGate(next, media);
  };

  useEffect(() => {
    if (!yt || !video) return undefined;
    const timer = window.setInterval(() => {
      const time = playerApiRef.current?.getCurrentTime?.();
      if (typeof time === 'number') onTick(time, null);
    }, 400);
    return () => window.clearInterval(timer);
  }, [yt, video?.id, passedKeys]);

  const finishCheck = (checkId) => {
    const next = new Set(passedRef.current);
    next.add(`${video.id}:${checkId}`);
    passedRef.current = next;
    setPassedKeys(next);
    gateRef.current = null;
    setGate(null);
    playerApiRef.current?.play?.();
  };

  const submitCheck = async (imageDataUrl) => {
    if (!gate || !video || !unitId || checkBusy || cheer) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const res = await dailyPracticeApi.student.answerVideoCheck(unitId, video.id, gate.id, {
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
      .catch(() => {});
  };

  const buyHint = async () => {
    if (!gate || !video || !unitId || checkBusy) return;
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
      const res = await dailyPracticeApi.student.buyVideoHint(unitId, video.id, gate.id);
      setPaidHint(res.hint || '');
      setHintStep(true);
    } catch (err) {
      if (err.status === 402) openBuyXp();
      else setCheckError(err.message || 'Chưa đổi được gợi ý');
    } finally {
      setCheckBusy(false);
    }
  };

  const markDone = async () => {
    if (!video?.id || saving || done || pending.length || (url && !watchedEnough && !vimeo)) return;
    setSaving(true);
    try {
      await onComplete?.(video.id);
      setDone(true);
      gameSounds.tap();
    } finally {
      setSaving(false);
    }
  };

  const canFinish = Boolean(video?.id) && !done && pending.length === 0 && (!url || watchedEnough || vimeo);

  return createPortal(
    <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" role="presentation" onClick={onClose}>
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 text-white"
          style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}
        >
          <BookOpen size={20} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-white/80">{lesson?.label || 'Bài học'}</p>
            <p className="truncate text-lg font-black">{title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1.5 hover:bg-white/15 !shadow-none"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {body.length > 0 && (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-base leading-relaxed text-slate-800 ring-1 ring-slate-100 sm:p-5 sm:text-lg sm:leading-8">
              {body.map((para, index) => (
                <p key={index}>{para}</p>
              ))}
            </div>
          )}
          {url ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#23262E]">
              {yt ? (
                <StudentVideoPlayer
                  videoId={url}
                  lessonId={`dp-lesson-${video?.id || 'video'}`}
                  courseId="daily-practice"
                  antiSeekEnabled={!done}
                  lessonCompleted={done}
                  requiredRatio={WATCH_REQUIRED_RATIO}
                  onEligibilityReached={() => setWatchedEnough(true)}
                  playerApiRef={playerApiRef}
                  appearance="window"
                />
              ) : null}
              {!yt && vimeo && !started && (
                <button type="button" onClick={() => setStarted(true)} aria-label="Phát video" className="flex h-full w-full items-center justify-center !shadow-none">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600"><Play size={36} className="ml-1 text-white" fill="white" /></span>
                </button>
              )}
              {!yt && vimeo && started && (
                <iframe src={`https://player.vimeo.com/video/${vimeo}?autoplay=1`} title="Video bài học" className="h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              )}
              {!yt && !vimeo && isDirectVideo(url) && (
                <video
                  src={resolveMediaUrl(url) || url}
                  className="h-full w-full bg-black object-contain"
                  controls
                  controlsList="nodownload noplaybackrate"
                  playsInline
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    onTick(el.currentTime, el);
                    if (el.duration > 0 && el.currentTime / el.duration >= WATCH_REQUIRED_RATIO) setWatchedEnough(true);
                  }}
                  onSeeking={(e) => {
                    const el = e.currentTarget;
                    const cap = gateRef.current ? Number(gateRef.current.atSec) || 0 : maxSeenRef.current;
                    if (el.currentTime > cap + 0.8) el.currentTime = cap;
                  }}
                />
              )}
              {cheer && gate && <AnswerCheer onDone={() => finishCheck(gate.id)} />}
              <CheckCard
                gate={cheer ? null : gate}
                picked={picked}
                setPicked={setPicked}
                answerText={answerText}
                setAnswerText={setAnswerText}
                checkHint={checkHint}
                paidHint={paidHint}
                checkError={checkError}
                checkBusy={checkBusy}
                missed={missed}
                uploadPct={uploadPct}
                grading={grading}
                hintStep={hintStep}
                onHintNext={() => finishCheck(gate.id)}
                onSubmit={submitCheck}
                onFile={sendScreenshot}
                onHint={buyHint}
                onQuit={onClose}
              />
            </div>
          ) : null}
          {!body.length && !url && (
            <p className="text-base font-semibold text-slate-500">Bài này chưa có nội dung.</p>
          )}
          {url && pending.length > 0 && (
            <p className="text-sm font-semibold text-slate-500">Video dừng ở từng mốc. Trả lời đúng mới xem tiếp. Chưa tua được quá phần đã xem.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline !py-2 text-sm">Đóng</button>
          <button
            type="button"
            disabled={saving || !canFinish}
            onClick={markDone}
            className="cms-btn cms-btn-primary !py-2 text-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {done ? 'Đã học xong' : 'Đánh dấu đã học'}
          </button>
        </div>
      </div>
      {buyXpOpen && (
        <BuyXpModal packs={xpPacks} onClose={() => setBuyXpOpen(false)} onPaid={() => setBuyXpOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
