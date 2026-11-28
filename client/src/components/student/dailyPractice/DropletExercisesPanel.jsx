import { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Send,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi, { emitDailyPracticeStats } from '../../../services/dailyPracticeApi';
import { dewClass } from '../../../utils/dewskillTheme';
import { gameSounds } from '../../../utils/sound';

const MODE_BADGE = {
  auto: { label: 'Tự khớp nhanh', icon: Zap, cls: 'border-sky-200 bg-sky-50 text-sky-700' },
  ai: { label: 'AI chấm bài', icon: Bot, cls: 'border-violet-200 bg-violet-50 text-violet-700' },
  hybrid: { label: 'Tự khớp + AI chấm', icon: Sparkles, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

/**
 * Khối làm Đề bài tập tự nhập đáp án (Tự khớp / AI chấm) trong mỗi Hạt nước DewSkill.
 */
export default function DropletExercisesPanel({
  unitId,
  nodeKey,
  exercises = [],
  passedExercises = [],
  onExercisePassed,
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [answersById, setAnswersById] = useState({});
  const [resultsById, setResultsById] = useState({});
  const [submittingId, setSubmittingId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const list = Array.isArray(exercises) ? exercises : [];
  const passedSet = new Set(Array.isArray(passedExercises) ? passedExercises : []);

  useEffect(() => {
    setActiveIdx((prev) => (prev >= list.length ? 0 : prev));
  }, [list.length]);

  if (!list.length) return null;

  const current = list[activeIdx] || list[0];
  const exId = String(current?.id || '');
  const isPassed = Boolean(current?.passed || (nodeKey && exId && passedSet.has(`${nodeKey}:${exId}`)));
  const modeMeta = MODE_BADGE[current?.gradingMode] || MODE_BADGE.hybrid;
  const ModeIcon = modeMeta.icon;
  const currentAnswer = answersById[exId] ?? '';
  const currentResult = resultsById[exId] || null;
  const submitting = submittingId === exId;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!unitId || !nodeKey || !exId || submitting) return;
    if (!String(currentAnswer || '').trim()) {
      setErrorMsg('Hãy nhập đáp án của bạn trước khi kiểm tra nhé.');
      return;
    }
    setSubmittingId(exId);
    setErrorMsg('');
    try {
      const res = await dailyPracticeApi.student.submitExercise(unitId, nodeKey, exId, currentAnswer);
      setResultsById((prev) => ({ ...prev, [exId]: res }));
      if (typeof res?.profileXp === 'number') {
        emitDailyPracticeStats({ xpTotal: res.profileXp });
      }
      if (res?.correct) {
        gameSounds.win();
        onExercisePassed?.(res);
      } else {
        gameSounds.wrong();
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Chưa chấm được đáp án, vui lòng thử lại.');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <section className="dew-app-card relative overflow-hidden rounded-[28px] border border-white bg-white/92 p-5 shadow-[0_18px_40px_-12px_rgba(124,58,237,0.16),inset_0_2px_0_#fff] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#10B981] to-[#06B6D4]" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-900">
          <ClipboardCheck size={18} strokeWidth={2.2} className="text-violet-600" />
          <h3 className="text-base font-extrabold tracking-tight">Đề bài tập tự nhập đáp án</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-extrabold text-violet-700">
          {list.filter((item) => item.passed || passedSet.has(`${nodeKey}:${item.id}`)).length}/{list.length} bài đạt
        </span>
      </div>

      {/* Tabs chuyển giữa nhiều đề bài tập */}
      {list.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {list.map((ex, idx) => {
            const done = Boolean(ex.passed || passedSet.has(`${nodeKey}:${ex.id}`));
            const selected = idx === activeIdx;
            return (
              <button
                key={ex.id || idx}
                type="button"
                onClick={() => {
                  setActiveIdx(idx);
                  setErrorMsg('');
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  done
                    ? selected
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : selected
                      ? 'bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9] text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {done && <CheckCircle2 size={12} />}
                <span>Bài {idx + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Nội dung đề bài hiện tại */}
      <div className="mt-4 rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/45 to-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-black text-slate-900">{current.title || `Bài tập ${activeIdx + 1}`}</h4>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${modeMeta.cls}`}>
              <ModeIcon size={11} /> {modeMeta.label}
            </span>
            {isPassed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                <CheckCircle2 size={11} /> Đã đạt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                +{current.xpReward || 10} XP
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 whitespace-pre-line rounded-xl border border-slate-100 bg-white/95 p-3.5 text-[13.5px] font-medium leading-relaxed text-slate-800">
          {current.prompt}
        </div>

        {current.attachmentUrl ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/75 px-3 py-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-bold text-amber-950">
              <FileText size={15} className="shrink-0 text-amber-600" />
              <span className="truncate">{current.attachmentName || 'File đề bài tập'}</span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={resolveMediaUrl(current.attachmentUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-bold text-amber-900 hover:bg-amber-50"
              >
                <ExternalLink size={12} /> Xem
              </a>
              <a
                href={buildMediaDownloadUrl(current.attachmentUrl, current.attachmentName || 'bai-tap')}
                download={current.attachmentName || 'bai-tap'}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 font-bold text-white hover:bg-amber-700"
              >
                <Download size={12} /> Tải về
              </a>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-slate-700" htmlFor={`ex-input-${exId}`}>
              Nhập đáp án hoặc công thức của bạn:
            </label>
            <textarea
              id={`ex-input-${exId}`}
              rows={2}
              disabled={submitting}
              value={currentAnswer}
              onChange={(e) => {
                setAnswersById((prev) => ({ ...prev, [exId]: e.target.value }));
                setErrorMsg('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ví dụ: =SUMIF(A2:A20, &quot;Laptop&quot;, D2:D20) hoặc câu trả lời ngắn..."
              className="dew-input w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {errorMsg ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {errorMsg}
            </p>
          ) : null}

          {currentResult ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${
                currentResult.correct
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : currentResult.status === 'NEEDS_REVIEW'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {currentResult.correct ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                ) : currentResult.status === 'NEEDS_REVIEW' ? (
                  <HelpCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-black">
                    {currentResult.correct
                      ? `Chính xác!${currentResult.gainedXp > 0 ? ` (+${currentResult.gainedXp} XP)` : ''}`
                      : currentResult.status === 'NEEDS_REVIEW'
                        ? 'Cần diễn đạt rõ hơn'
                        : 'Chưa chính xác'}
                    {' · '}
                    <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-black uppercase">
                      {currentResult.matchedBy === 'ai' ? `AI chấm (${currentResult.score}%)` : 'Tự khớp chuẩn'}
                    </span>
                  </p>
                  <p className="leading-relaxed">{currentResult.feedback}</p>
                  {currentResult.explanation || current.explanation ? (
                    currentResult.correct || isPassed ? (
                      <p className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[11.5px] text-emerald-900">
                        <b>Giải thích:</b> {currentResult.explanation || current.explanation}
                      </p>
                    ) : null
                  ) : null}
                </div>
              </div>
            </div>
          ) : isPassed && current.explanation ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
              <b>Đã hoàn thành bài này · Giải thích:</b> {current.explanation}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              Nhấn <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold">Enter</kbd> để chấm nhanh
            </span>
            <button
              type="submit"
              disabled={submitting || !String(currentAnswer || '').trim()}
              className={dewClass(
                'dew-btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                'inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{submitting ? 'Đang chấm...' : isPassed ? 'Kiểm tra lại' : 'Kiểm tra đáp án'}</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
