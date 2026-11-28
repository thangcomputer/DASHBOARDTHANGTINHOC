import AnswerFeedbackBanner, {
  buildConciseAnswerSummary,
  normalizeExplanationBody,
} from './AnswerFeedbackBanner';
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';

export { buildConciseAnswerSummary, normalizeExplanationBody };

export function QuizActionButtons({
  isCorrect = true,
  explainOpen = false,
  onToggleExplain,
  onNext,
  busy = false,
  highlightExplain = false,
}) {
  return (
    <div className={`grid w-full shrink-0 gap-2 ${isCorrect ? 'grid-cols-2 sm:w-[144px] sm:grid-cols-1' : 'grid-cols-2 sm:w-[144px] sm:grid-cols-1'}`}>
      <button
        type="button"
        onClick={() => {
          gameSounds.tap();
          onToggleExplain?.();
        }}
        aria-expanded={explainOpen}
        className={`dew-btn-white inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold sm:text-sm ${highlightExplain ? 'dp-explain-nudge' : ''}`}
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
        className="dew-btn-primary inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-extrabold disabled:opacity-60 sm:text-sm"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        <span>Tiếp tục</span>
        <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

export function AnswerFeedback(props) {
  return <AnswerFeedbackBanner {...props} />;
}

export default AnswerFeedback;
