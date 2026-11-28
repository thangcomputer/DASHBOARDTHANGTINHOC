import { Check, Lightbulb, X } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import Mascot from './Mascot';

/**
 * Thẻ chọn một đáp án trắc nghiệm kính nổi 3D (Hình 3).
 */
export function DewOptionCard({
  index,
  option,
  locked = false,
  isCorrect = false,
  isWrongPick = false,
  isChosen = false,
  eliminated = false,
  onSelect,
}) {
  const letter = String.fromCharCode(65 + index);
  const isHighlighted = !locked && !eliminated && isChosen;

  let cardClass =
    'border-white bg-white/90 text-slate-800 shadow-[0_10px_24px_-8px_rgba(15,23,42,0.1),inset_0_2px_0_#fff] hover:-translate-y-0.5 hover:border-emerald-300 hover:ring-4 hover:ring-emerald-100/70';

  if (isCorrect) {
    cardClass =
      'dp-option-select border-emerald-400 ring-4 ring-emerald-100 bg-gradient-to-r from-[#D1FAE5]/85 via-[#ECFDF5] to-white text-emerald-950 shadow-[0_12px_26px_-8px_rgba(16,185,129,0.28),inset_0_2px_0_#fff]';
  } else if (isWrongPick) {
    cardClass =
      'dp-shake border-rose-300 ring-4 ring-rose-100 bg-rose-50/90 text-rose-900 shadow-[0_10px_22px_-8px_rgba(244,63,94,0.22),inset_0_2px_0_#fff]';
  } else if (eliminated) {
    cardClass =
      'border-slate-100 bg-slate-50/75 text-slate-300 line-through opacity-55 cursor-not-allowed';
  } else if (isHighlighted) {
    cardClass =
      'border-emerald-400 ring-4 ring-emerald-100 bg-emerald-50/65 text-slate-900 shadow-[0_12px_26px_-8px_rgba(16,185,129,0.25),inset_0_2px_0_#fff]';
  }

  let badgeClass =
    'border-white bg-gradient-to-b from-white via-slate-100 to-slate-200/90 text-slate-600 shadow-[0_4px_10px_rgba(15,23,42,0.08),inset_0_2px_2px_#fff] group-hover:from-[#A7F3D0] group-hover:via-[#6EE7B7] group-hover:to-[#34D399] group-hover:text-emerald-950';

  if (isCorrect || isHighlighted) {
    badgeClass =
      'border-white bg-gradient-to-b from-[#A7F3D0] via-[#34D399] to-[#10B981] text-emerald-950 shadow-[0_4px_12px_rgba(16,185,129,0.3),inset_0_2px_2px_rgba(255,255,255,0.75)]';
  } else if (isWrongPick) {
    badgeClass =
      'border-white bg-gradient-to-b from-rose-300 to-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.3)]';
  } else if (eliminated) {
    badgeClass = 'border-slate-100 bg-slate-100 text-slate-300';
  }

  return (
    <button
      type="button"
      disabled={locked || eliminated}
      onClick={onSelect}
      title={!locked && !eliminated ? `Phím tắt: ${index + 1} hoặc ${letter}` : undefined}
      data-option-state={isCorrect ? 'correct' : isWrongPick ? 'wrong' : 'idle'}
      className={`group relative flex h-full min-h-[68px] w-full items-center gap-4 rounded-[22px] border-2 p-4 text-left transition duration-200 cursor-pointer disabled:cursor-default ${cardClass}`}
    >
      {/* Badge chữ cái A/B/C/D hình tròn kính 3D */}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold transition ${badgeClass}`}
      >
        {letter}
      </span>

      <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug">
        {option}
      </span>

      {isCorrect ? (
        <span
          className="dp-check-pop flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs"
          aria-label="Đúng"
        >
          <Check size={15} strokeWidth={3.2} />
        </span>
      ) : null}
      {isWrongPick ? (
        <span
          className="dp-check-pop flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs"
          aria-label="Sai"
        >
          <X size={15} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Câu hỏi Trắc nghiệm 4 đáp án phong cách Giọt Nước 3D (Hình 3).
 */
export default function MultipleChoiceCard({
  question,
  reveal,
  result,
  chosen,
  onSubmit,
  standalone = false,
  onHint,
  hintCost = 2,
  busy = false,
}) {
  const eliminated = new Set(reveal?.eliminate || []);
  const locked = Boolean(result);
  const options = Array.isArray(question?.options) ? question.options : [];

  const gridEl = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {options.map((option, index) => {
        const isCorrect = locked && (
          result?.correctAnswer?.correctIndex === index
          || (result?.correct && chosen === index)
        );
        const isWrongPick = locked && chosen === index && !isCorrect;
        const out = eliminated.has(index);

        return (
          <DewOptionCard
            key={`${index}-${option}`}
            index={index}
            option={option}
            locked={locked}
            isCorrect={isCorrect}
            isWrongPick={isWrongPick}
            isChosen={chosen === index}
            eliminated={out}
            onSelect={() => {
              gameSounds.tap();
              onSubmit?.({ index });
            }}
          />
        );
      })}
    </div>
  );

  if (!standalone) return gridEl;

  return (
    <section className="dew-app-card relative mx-auto w-full max-w-4xl overflow-hidden rounded-[30px] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0EA5E9]" />
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100/90 pb-5">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b from-[#ECFDF5] to-[#E0F2FE]/80 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.25),inset_0_2px_4px_#fff]">
            <Mascot mood={locked ? (result?.correct ? 'correct' : 'incorrect') : 'learning'} size={44} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Câu hỏi · Trắc nghiệm</p>
            <h2 className="mt-0.5 text-lg font-extrabold leading-snug text-slate-900 sm:text-xl">
              {question?.prompt}
            </h2>
          </div>
        </div>
        {onHint && !locked ? (
          <button
            type="button"
            disabled={Boolean(reveal) || busy}
            onClick={onHint}
            className="dew-btn-white inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <Lightbulb size={14} className="text-amber-500" aria-hidden="true" />
            <span>{reveal ? 'Đã gợi ý' : `Gợi ý -${hintCost}`}</span>
          </button>
        ) : null}
      </div>

      {gridEl}

      <p className="mt-5 text-center text-xs font-medium italic text-slate-500">
        Chọn một đáp án phía trên để trả lời
      </p>
    </section>
  );
}
