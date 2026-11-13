import { useState } from 'react';
import { BookOpen, Check, ChevronRight, Loader2, RotateCcw, Sparkles, Star, X, Zap } from 'lucide-react';
import MascotEmotion from './MascotEmotion';
import XPRewardAnimation from './XPRewardAnimation';
import { gameSounds } from '../../../utils/sound';
import {
  resolveFeedbackMascotEmotion,
  resolveWrongEncouragement,
  shouldSuppressWrongShake,
} from './quizFeedbackOrchestration';
import { useQuizFeedbackBannerFade } from './useQuizFeedbackBannerFade';
import { PLAY_QUESTION_CHROME } from '../../../../../shared/dailyPractice/playQuestionChrome.mjs';
import './quizFeedbackDew.css';
import './quizGameFeedback.css';

const FEEDBACK_STATUS = PLAY_QUESTION_CHROME.feedbackStatus;

export function buildConciseAnswerSummary(question, result) {
  const answerText = String(result?.correctAnswer?.text || '').trim();
  const promptText = String(question?.prompt || '').trim();
  const explanationText = String(result?.explanation || '').trim();

  if (result?.correct) {
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
        const cleanAns = answerText.replace(/\.+$/, '');
        return `${cleanAns}.`;
      }
    }
    if (explanationText) return explanationText;
    return 'Bạn đã nắm vững kiến thức câu hỏi này.';
  }

  if (answerText) {
    return `Đáp án đúng: ${answerText}`;
  }
  if (explanationText) {
    return explanationText;
  }
  return 'Hãy xem phần giải thích để nhớ kỹ kiến thức nhé!';
}

/** Bỏ dòng "Đáp án đúng: …" trùng với ô xanh (API hay gửi cả hai). */
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

export function QuizActionButtons({
  isCorrect = true,
  explainOpen = false,
  onToggleExplain,
  onNext,
  busy = false,
  isLastQuestion = false,
  highlightExplain = false,
  compactWrong = false,
  onRetry,
  canRetry = false,
  wrongTryCount = 0,
}) {
  if (!isCorrect && compactWrong) {
    return (
      <button
        type="button"
        disabled={busy || !canRetry}
        onClick={() => {
          gameSounds.tap();
          onRetry?.();
        }}
        className="cms-btn cms-btn-primary inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs !shadow-none disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}
        <span>{wrongTryCount > 0 ? 'Thử lại' : 'Kiểm tra'}</span>
      </button>
    );
  }

  return (
    <div className={`grid w-full shrink-0 gap-2 ${isCorrect ? 'grid-cols-2 sm:w-[172px] sm:grid-cols-1' : 'grid-cols-2 sm:grid-cols-1 sm:w-[178px]'}`}>
      <button
        type="button"
        onClick={() => {
          gameSounds.tap();
          onToggleExplain?.();
        }}
        aria-expanded={explainOpen}
        className={`dp-quiz-btn-explain inline-flex min-h-[44px] items-center justify-center gap-1.5 px-3 py-2.5 text-sm transition active:translate-y-[2px] ${isCorrect ? '' : 'dp-quiz-btn-explain--wrong'
          } ${highlightExplain ? 'dp-explain-nudge' : ''}`}
      >
        <BookOpen size={15} aria-hidden="true" />
        <span>{explainOpen ? 'Ẩn giải thích' : 'Giải thích'}</span>
      </button>

      {isCorrect ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            gameSounds.tap();
            onNext?.();
          }}
          className="dp-quiz-btn-continue inline-flex min-h-[46px] items-center justify-center gap-1.5 px-4 py-2.5 text-sm transition disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          <span>{isLastQuestion ? 'Tiếp tục' : 'Tiếp tục'}</span>
          <ChevronRight size={18} strokeWidth={3} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function AnswerFeedback({
  question = null,
  result,
  feedbackTitle = '',
  confirmedXp = 0,
  rewardKey = '',
  isLastQuestion = false,
  busy = false,
  onNext,
  onRetry,
  canRetry = false,
  wrongTryCount = 0,
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
  const bannerFaded = useQuizFeedbackBannerFade(result, question?.id, explainOpen);

  if (!result) return null;

  const isCorrect = Boolean(result.correct);
  const practiceOnly = Boolean(result.practiceOnly);
  const bannerLabel = isCorrect ? 'Chính xác!' : 'Chưa chính xác, thử lại nhé!';
  const conciseLine = isCorrect
    ? buildConciseAnswerSummary(question, result)
    : resolveWrongEncouragement(wrongTryCount);
  const mascotEmotion = resolveFeedbackMascotEmotion({ isCorrect, wrongTryCount });
  const suppressShake = !isCorrect && shouldSuppressWrongShake(wrongTryCount);
  const answerText = String(result.correctAnswer?.text || '').trim();
  const detailExplanation = normalizeExplanationBody(result.explanation, answerText);
  const explainTitle = String(question?.prompt || '').replace(/\?+$/, '').trim();

  return (
    <div
      data-answer-feedback={isCorrect ? 'correct' : 'incorrect'}
      className={`dp-quiz-feedback dp-quiz-feedback--panel-in mt-5 ${isCorrect && bannerFaded ? 'dp-quiz-feedback--compact' : ''
        } ${isCorrect ? 'dp-quiz-feedback--correct' : `dp-quiz-feedback--wrong dp-quiz-feedback--wrong-inline${suppressShake ? '' : ' dp-shake'}`
        }`}
    >
      <div className={`relative z-[1] flex text-left ${isCorrect ? 'flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:text-left' : 'flex-row items-start gap-2.5 sm:gap-3'}`}>
        <div className={`dp-quiz-feedback__banner flex w-full min-w-0 flex-1 ${isCorrect ? 'flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:text-left' : 'flex-row items-start gap-2.5 sm:gap-3'}`}>
          <div className={`relative shrink-0 ${isCorrect ? 'flex flex-col items-center gap-1.5 sm:items-start' : 'flex items-center justify-center'}`}>
            <div className={`relative flex shrink-0 items-center justify-center ${isCorrect ? 'h-24 w-28 sm:h-[104px] sm:w-[120px]' : 'h-12 w-12'}`}>
              {isCorrect && (
                <>
                  <Star size={14} className="dp-star-burst pointer-events-none absolute left-0 top-0 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <Star size={12} className="dp-star-burst pointer-events-none absolute right-0 top-1 fill-amber-300 text-amber-400" aria-hidden="true" />
                  <Sparkles size={13} className="dp-star-burst pointer-events-none absolute bottom-1 left-0 text-amber-400" aria-hidden="true" />
                </>
              )}
              <MascotEmotion
                emotion={mascotEmotion}
                size={isCorrect ? 92 : 48}
                className={`relative z-[1] ${isCorrect ? 'dp-mascot-correct-pop' : ''}`}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start">
            <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`dp-check-pop flex shrink-0 items-center justify-center rounded-full border ${isCorrect ? 'h-7 w-7 border-emerald-200 bg-white' : 'h-6 w-6 border-red-200 bg-white'
                  }`}
                aria-hidden="true"
              >
                {isCorrect ? (
                  <Check
                    size={FEEDBACK_STATUS.correct.size}
                    strokeWidth={FEEDBACK_STATUS.strokeWidth}
                    className="text-emerald-600"
                  />
                ) : (
                  <X
                    size={FEEDBACK_STATUS.wrong.size}
                    strokeWidth={FEEDBACK_STATUS.strokeWidth}
                    className="text-red-600"
                  />
                )}
              </span>
              <h3 className={`font-extrabold tracking-tight ${isCorrect ? 'text-xl text-emerald-800 sm:text-[22px]' : 'text-sm text-red-700'}`}>
                {bannerLabel}
              </h3>
              {!isCorrect && result.wrongPenaltyXp > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-red-200/90 bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-red-600">
                  <Zap size={11} className="fill-red-400 text-red-500" aria-hidden="true" />
                  -{result.wrongPenaltyXp} XP
                </span>
              ) : null}
            </div>

            <p className={`leading-snug text-slate-800 ${isCorrect ? 'mt-1.5 text-sm font-bold sm:text-[15px]' : 'mt-1 text-[13px] font-semibold'}`}>
              {conciseLine}
            </p>

            <div className={`flex flex-wrap items-center gap-2 ${isCorrect ? 'mt-3 justify-center sm:justify-start' : 'hidden'}`}>
              {practiceOnly ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-800">
                  Ôn lại · không đổi XP
                </span>
              ) : isCorrect ? (
                confirmedXp > 0 ? (
                  <XPRewardAnimation xpAmount={confirmedXp} rewardKey={rewardKey} playSound={false} />
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-gradient-to-r from-[#FFF3C4] via-[#FDE68A]/80 to-[#FFF3C4] px-3.5 py-1 text-xs font-black text-amber-900 shadow-2xs ring-2 ring-white/80">
                    <Zap size={13} className="fill-amber-400 text-amber-500" aria-hidden="true" />
                    <span>{feedbackTitle || 'Ôn tập · 0 XP'}</span>
                  </span>
                )
              ) : null}
            </div>
          </div>
        </div>

        <QuizActionButtons
          isCorrect={isCorrect}
          explainOpen={explainOpen}
          onToggleExplain={() => setExplainOpen((prev) => !prev)}
          onNext={onNext}
          busy={busy}
          isLastQuestion={isLastQuestion}
          highlightExplain={false}
          compactWrong={!isCorrect}
          onRetry={onRetry}
          canRetry={canRetry}
          wrongTryCount={wrongTryCount}
        />
      </div>

      {explainOpen && (
        <div className={`dp-quiz-explain-panel dp-slide-up relative z-[1] text-left ${isCorrect ? 'mt-4' : 'mt-2.5'}`}>
          <span className="dp-quiz-explain-tag">
            <BookOpen size={13} aria-hidden="true" />
            Giải thích chi tiết
          </span>
          {explainTitle ? (
            <h4 className="mt-2 text-base font-black text-slate-900">
              {explainTitle.endsWith('?') || explainTitle.endsWith('？') ? explainTitle : `${explainTitle}?`}
            </h4>
          ) : null}
          {answerText ? (
            <p className="mt-2 text-sm font-extrabold text-emerald-700">
              ✓ Đáp án đúng: {answerText}
            </p>
          ) : null}
          {detailExplanation ? (
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">
              {detailExplanation}
            </p>
          ) : (
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Giáo viên chưa bổ sung giải thích chi tiết cho câu này. Bạn có thể xem đáp án đúng phía trên.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AnswerFeedback;
