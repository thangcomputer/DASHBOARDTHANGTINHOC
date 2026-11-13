import { createPortal } from 'react-dom';
import { Check, Lightbulb, X } from 'lucide-react';
import MascotEmotion from './MascotEmotion';
import { gameSounds } from '../../../utils/sound';
import './quizFeedbackDew.css';

/** Popup gợi ý — nền vàng, mascot, nút Đã hiểu (mockup trạng thái 3). */
export default function QuizHintModal({ hint = '', onClose }) {
  if (!hint) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9400] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Gợi ý câu hỏi"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="dp-quiz-hint-modal relative w-full max-w-md p-5 sm:p-6">
        <div className="relative z-[1] flex items-start justify-between gap-2">
          <span className="dp-quiz-hint-tag">
            <Lightbulb size={14} className="fill-amber-300 text-amber-600" aria-hidden="true" />
            Gợi ý
          </span>
          <button
            type="button"
            onClick={() => { gameSounds.tap(); onClose?.(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/80 bg-white/90 text-slate-500 !shadow-none"
            aria-label="Đóng gợi ý"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="relative z-[1] mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <MascotEmotion emotion="idea" size={88} className="shrink-0" />
          <p className="dp-quiz-hint-bubble w-full flex-1">{hint}</p>
        </div>

        <div className="relative z-[1] mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => { gameSounds.tap(); onClose?.(); }}
            className="dp-quiz-btn-continue inline-flex min-h-[46px] items-center justify-center gap-2 px-8 py-2.5 text-sm !shadow-none"
          >
            <Check size={17} strokeWidth={3} aria-hidden="true" />
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
