import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Loader2,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';
import MascotEmotion from './MascotEmotion';
import { gameSounds } from '../../../utils/sound';
import { dewClass } from '../../../utils/dewskillTheme';
import { resolveFeedbackMascotEmotion } from './quizFeedbackOrchestration';
import { useQuizFeedbackBannerFade } from './useQuizFeedbackBannerFade';

export function buildConciseAnswerSummary(question, result) {
  const answerText = String(result?.correctAnswer?.text || '').trim();
  const promptText = String(question?.prompt || '').trim();
  const explanationText = String(result?.explanation || '').trim();

  if (result?.correct) {
    if (explanationText) return explanationText;
    if (promptText && answerText) {
      const cleanedPrompt = promptText
        .replace(/\s*(nghĩa là gì|là gì|dùng để làm gì|có tác dụng gì|viết tắt của từ gì)\s*\??$/i, '')
        .replace(/\?+$/, '')
        .trim();
      if (cleanedPrompt && cleanedPrompt.length <= 42 && cleanedPrompt.toLowerCase() !== promptText.toLowerCase()) {
        const cleanAns = answerText.replace(/\.+$/, '');
        return `${cleanedPrompt} = ${cleanAns}.`;
      }
      if (answerText.length <= 80) {
        return `${answerText.replace(/\.+$/, '')}.`;
      }
    }
    return 'Bạn đã nắm vững kiến thức câu hỏi này.';
  }

  if (answerText) return `Đáp án đúng: ${answerText}`;
  if (explanationText) return explanationText;
  return 'Hãy xem phần giải thích để nhớ kỹ kiến thức nhé!';
}

export function normalizeExplanationBody(explanation, answerText) {
  const raw = String(explanation || '').trim();
  const ans = String(answerText || '').trim();
  if (!raw) return '';

  const stripPrefix = (text) => text.replace(/^đáp án đúng\s*[:：]\s*/i, '').replace(/\.+\s*$/, '').trim();

  let body = raw;
  if (ans) {
    const exactPrefix = new RegExp(`^đáp án đúng\\s*[:：]\\s*${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?`, 'i');
    body = body.replace(exactPrefix, '').trim();
  }
  if (!body && /^đáp án đúng/i.test(raw)) {
    const inner = stripPrefix(raw);
    if (!ans || inner.toLowerCase() === ans.toLowerCase()) return '';
    return inner;
  }
  if (/^đáp án đúng/i.test(body)) {
    const inner = stripPrefix(body);
    if (ans && inner.toLowerCase() === ans.toLowerCase()) return '';
    body = inner;
  }
  return body;
}

/**
 * Banner phản hồi Chính xác / Chưa đúng theo phong cách Giọt Nước 3D (Hình 2).
 */
export default function AnswerFeedbackBanner({
  question = null,
  result,
  feedbackTitle = '',
  confirmedXp = 0,
  isLastQuestion: _isLastQuestion = false,
  busy = false,
  onNext,
  xpDisabled = false,
  explainOpen: explainOpenProp,
  onExplainOpenChange,
}) {
  const [explainLocal, setExplainLocal] = useState(false);
  const explainControlled = typeof onExplainOpenChange === 'function';
  const explainOpen = explainControlled ? Boolean(explainOpenProp) : explainLocal;
  const setExplainOpen = (next) => {
    const value = typeof next === 'function' ? next(explainOpen) : next;
    if (explainControlled) onExplainOpenChange(value);
    else setExplainLocal(value);
  };

  useQuizFeedbackBannerFade(result, question?.id, explainOpen);

  if (!result) return null;

  const isCorrect = Boolean(result.correct);
  const practiceOnly = Boolean(result.practiceOnly);
  const mascotEmotion = resolveFeedbackMascotEmotion({ isCorrect, wrongTryCount: isCorrect ? 0 : 1 });
  const conciseLine = buildConciseAnswerSummary(question, result);
  const answerText = String(result.correctAnswer?.text || '').trim();
  const detailExplanation = normalizeExplanationBody(result.explanation, answerText);
  const explainTitle = String(question?.prompt || '').replace(/\?+$/, '').trim();

  return (
    <div
      data-answer-feedback={isCorrect ? 'correct' : 'incorrect'}
      className={`mt-5 relative overflow-hidden rounded-[24px] border-2 p-5 transition-all ${
        isCorrect
          ? 'border-emerald-400 bg-gradient-to-r from-[#D1FAE5]/90 to-[#ECFDF5]/95 shadow-[0_14px_30px_-8px_rgba(16,185,129,0.28)]'
          : 'dp-shake border-rose-300 bg-rose-50/95 shadow-[0_14px_28px_-10px_rgba(244,63,94,0.2)]'
      }`}
    >
      <div className="relative z-[1] flex flex-col items-center justify-between gap-4 sm:flex-row">
        {/* Trái: Mascot 3D ăn mừng + tiêu đề + giải thích ngắn + pill XP */}
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3.5 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative flex h-20 w-24 shrink-0 items-center justify-center sm:h-24 sm:w-24">
            {isCorrect ? (
              <>
                <Star size={13} className="dp-star-burst pointer-events-none absolute left-0 top-1 fill-amber-400 text-amber-400" aria-hidden="true" />
                <Star size={11} className="dp-star-burst pointer-events-none absolute right-1 top-0 fill-amber-300 text-amber-400" aria-hidden="true" />
                <Sparkles size={12} className="dp-star-burst pointer-events-none absolute bottom-1 left-1 text-amber-400" aria-hidden="true" />
              </>
            ) : null}
            <MascotEmotion
              emotion={mascotEmotion}
              size={84}
              className={`relative z-[1] ${isCorrect ? 'dp-mascot-correct-pop' : ''}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  isCorrect ? 'bg-emerald-500 text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                }`}
                aria-hidden="true"
              >
                {isCorrect ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
              </span>
              <h3 className={`text-lg font-extrabold tracking-tight sm:text-xl ${isCorrect ? 'text-emerald-800' : 'text-rose-700'}`}>
                {isCorrect ? 'Chính xác!' : 'Chưa đúng!'}
              </h3>
              {!isCorrect && !practiceOnly && !xpDisabled && result.wrongPenaltyXp > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-200 bg-white/90 px-2.5 py-0.5 text-xs font-extrabold text-rose-600">
                  <Zap size={11} className="fill-rose-400 text-rose-500" aria-hidden="true" />
                  −{result.wrongPenaltyXp} XP
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm font-semibold leading-snug text-slate-700">
              {conciseLine}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {practiceOnly ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-800">
                  Ôn lại · không đổi XP
                </span>
              ) : isCorrect ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#FEF3C7] px-3 py-1 text-xs font-extrabold text-amber-900 shadow-2xs">
                  <Zap size={12} className="fill-amber-500 text-amber-600" aria-hidden="true" />
                  <span>{confirmedXp > 0 ? `+${confirmedXp} XP` : (feedbackTitle || 'Ôn tập · 0 XP')}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Phải: 2 nút xếp dọc gọn */}
        <div className="flex w-full shrink-0 flex-row gap-2 sm:w-36 sm:flex-col">
          <button
            type="button"
            onClick={() => {
              gameSounds.tap();
              setExplainOpen((prev) => !prev);
            }}
            aria-expanded={explainOpen}
            className={dewClass(
              'dew-btn-white inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer sm:w-36 sm:text-sm',
              'inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer sm:w-36 sm:text-sm',
            )}
          >
            <BookOpen size={14} aria-hidden="true" />
            <span>{explainOpen ? 'Ẩn giải thích' : (isCorrect ? 'Giải thích' : 'Xem gợi ý')}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              gameSounds.tap();
              onNext?.();
            }}
            className={dewClass(
              'dew-btn-primary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-extrabold cursor-pointer disabled:opacity-60 sm:w-36 sm:text-sm',
              'inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-60 sm:w-36 sm:text-sm',
            )}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            <span>Tiếp tục</span>
            <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Khung giải thích chi tiết mở rộng */}
      {explainOpen ? (
        <div className="dp-slide-up relative z-[1] mt-4 rounded-2xl border border-white bg-white/88 p-4 text-left shadow-sm backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
            <BookOpen size={12} aria-hidden="true" />
            Giải thích chi tiết
          </span>
          {explainTitle ? (
            <h4 className="mt-2 text-sm font-black text-slate-900 sm:text-base">
              {explainTitle.endsWith('?') || explainTitle.endsWith('？') ? explainTitle : `${explainTitle}?`}
            </h4>
          ) : null}
          {answerText ? (
            <p className="mt-1.5 text-sm font-extrabold text-emerald-700">
              ✓ Đáp án đúng: {answerText}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
            {detailExplanation || 'Giáo viên chưa bổ sung giải thích chi tiết cho câu này. Bạn có thể xem đáp án đúng phía trên.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
