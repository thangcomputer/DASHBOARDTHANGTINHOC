import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, GripVertical, Lock, X } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import CategorySortQuestion from './CategorySortQuestion';
import FillBlankQuestionCard from './FillBlankQuestionCard';
import MatchingQuestionCard from './MatchingQuestionCard';
import MultipleChoiceCard, { DewOptionCard } from './MultipleChoiceCard';

function ResultMark({ ok }) {
  return ok
    ? <Check size={16} className="shrink-0 text-emerald-600" aria-label="Đúng" />
    : <X size={16} className="shrink-0 text-rose-500" aria-label="Sai" />;
}

/**
 * QuizAnswerOption - Ô đáp án trắc nghiệm chuẩn Game UI DewSkill:
 * - Khi đúng: nền xanh lá nhạt (#ECFDF5), viền xanh đậm (#10B981), chữ cái A nền xanh lá chữ trắng,
 *   dấu tích xanh tròn bên phải hiệu ứng pop (200-300ms), 3 tia sáng xanh góc trái trên, scale nhẹ 0.98 -> 1.
 * - Khi sai: nền đỏ nhạt, viền đỏ, chữ cái A nền đỏ, icon X tròn bên phải, rung ngang nhẹ 1 lần (dp-shake).
 * - Các đáp án khác giữ nguyên màu trung tính và tự khóa sau khi có kết quả.
 */
export function QuizAnswerOption(props) {
  return <DewOptionCard {...props} />;
}

// ── Trắc nghiệm ──────────────────────────────────────────────────────────────
export function McqQuestion({ question, reveal, result, chosen, onSubmit }) {
  return (
    <MultipleChoiceCard
      question={question}
      reveal={reveal}
      result={result}
      chosen={chosen}
      onSubmit={onSubmit}
    />
  );
}

// ── Đúng / Sai ───────────────────────────────────────────────────────────────
export function TrueFalseQuestion({ result, chosen, onSubmit }) {
  const locked = Boolean(result);
  const options = [
    { value: true, label: 'Đúng', icon: Check, tone: 'emerald' },
    { value: false, label: 'Sai', icon: X, tone: 'rose' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {options.map(({ value, label, icon: Icon, tone }) => {
        const isCorrect = locked && result.correctAnswer?.answerBool === value;
        const isWrongPick = locked && chosen === value && !isCorrect;

        let cardClass =
          'border-white bg-white/90 text-slate-800 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.12),inset_0_2px_0_#fff] hover:-translate-y-0.5 hover:border-emerald-300 hover:ring-4 hover:ring-emerald-100/70';
        if (isCorrect) {
          cardClass =
            'dp-pop border-emerald-400 ring-4 ring-emerald-100 bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5]/70 text-emerald-900 shadow-[0_12px_26px_-8px_rgba(16,185,129,0.28),inset_0_2px_0_#fff]';
        } else if (isWrongPick) {
          cardClass =
            'dp-shake border-rose-300 ring-4 ring-rose-100 bg-rose-50/90 text-rose-900 shadow-[0_10px_22px_-8px_rgba(244,63,94,0.22),inset_0_2px_0_#fff]';
        }

        const badgeClass = tone === 'emerald'
          ? 'bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#059669] shadow-[0_8px_18px_-4px_rgba(16,185,129,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]'
          : 'bg-gradient-to-b from-[#FB7185] via-[#F43F5E] to-[#E11D48] shadow-[0_8px_18px_-4px_rgba(244,63,94,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]';

        return (
          <button
            key={label}
            type="button"
            disabled={locked}
            onClick={() => {
              gameSounds.tap();
              onSubmit({ value });
            }}
            data-option-state={isCorrect ? 'correct' : isWrongPick ? 'wrong' : 'idle'}
            className={`relative flex flex-col items-center gap-2.5 rounded-[26px] border-2 px-4 py-6 text-lg font-extrabold transition duration-200 cursor-pointer disabled:cursor-default ${cardClass}`}
          >
            {isCorrect ? (
              <span
                className="dp-pop absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs"
                aria-hidden="true"
              >
                <Check size={14} strokeWidth={3.2} />
              </span>
            ) : null}
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${badgeClass}`}>
              <Icon size={26} strokeWidth={3} aria-hidden="true" />
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Sắp xếp thứ tự ───────────────────────────────────────────────────────────
export function OrderQuestion({ question, reveal, result, onChange }) {
  const locked = Boolean(result);
  const [list, setList] = useState(() => question.items);
  const [selected, setSelected] = useState(null);
  const [draggingRow, setDraggingRow] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const lockedItem = reveal?.first || null;
  const dragRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    if (!lockedItem) return;
    setList((prev) => [lockedItem, ...prev.filter((item) => item !== lockedItem)]);
  }, [lockedItem]);

  useEffect(() => { onChange({ items: list }); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps -- báo đáp án khi thứ tự đổi

  const swap = (a, b) => {
    if (a === b || a < 0 || b < 0 || a >= list.length || b >= list.length) return;
    if (lockedItem && (list[a] === lockedItem || list[b] === lockedItem)) return;
    setList((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  handlersRef.current = {
    onDrop: (item, dropIndex) => {
      swap(list.indexOf(item), dropIndex);
      setSelected(null);
    },
    onTap: (item) => {
      if (selected && selected !== item) {
        swap(list.indexOf(selected), list.indexOf(item));
        gameSounds.drop();
        setSelected(null);
      } else {
        gameSounds.tap();
        setSelected(selected === item ? null : item);
      }
    },
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dist = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (!current.moved && dist > 6) {
        current.moved = true;
        gameSounds.pick();
      }
      if (current.moved) {
        event.preventDefault();
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-order]');
        const nextHover = target ? Number(target.getAttribute('data-drop-order')) : null;
        setHoveredIndex(Number.isFinite(nextHover) ? nextHover : null);
        setDraggingRow({
          item: current.item,
          x: event.clientX - current.offsetX,
          y: event.clientY - current.offsetY,
          width: current.width,
        });
      }
    };

    const handlePointerUp = (event) => {
      const current = dragRef.current;
      if (!current) return;
      dragRef.current = null;
      setDraggingRow(null);
      setHoveredIndex(null);

      if (!current.moved) {
        handlersRef.current.onTap?.(current.item);
        return;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-order]');
      if (target) {
        gameSounds.drop();
        handlersRef.current.onDrop?.(current.item, Number(target.getAttribute('data-drop-order')));
      }
    };

    const handlePointerCancel = () => {
      dragRef.current = null;
      setDraggingRow(null);
      setHoveredIndex(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, []);

  const startDrag = (event, item) => {
    if (locked || event.button > 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      item,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      moved: false,
    };
  };

  return (
    <ol className="space-y-2.5">
      {list.map((item, index) => {
        const isLocked = item === lockedItem;
        const ok = locked && result.correctAnswer?.items?.[index] === item;
        const isBeingDragged = draggingRow?.item === item;
        const isDropHovered = Boolean(draggingRow && hoveredIndex === index && !isBeingDragged && !isLocked);

        let cardClass =
          'border-white bg-gradient-to-b from-white to-[#F8FAFC] text-slate-800 shadow-[0_8px_20px_-6px_rgba(15,23,42,0.12),inset_0_2px_0_#fff] hover:border-emerald-300';
        if (locked) {
          cardClass = ok
            ? 'border-emerald-400 bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5]/70 text-emerald-900'
            : 'border-rose-300 bg-rose-50/90 text-rose-900';
        } else if (isLocked) {
          cardClass = 'border-amber-300 bg-amber-50/95 text-amber-900';
        } else if (isDropHovered) {
          cardClass =
            'border-emerald-400 bg-emerald-50/85 ring-4 ring-emerald-200/70 scale-[1.01] text-emerald-950';
        } else if (selected === item) {
          cardClass =
            'border-emerald-400 bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5] text-emerald-950 ring-2 ring-emerald-300/80';
        }

        return (
          <li key={item} data-drop-order={index} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#38BDF8] via-[#2563EB] to-[#4338CA] text-xs font-black text-white shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45),inset_0_2px_0_rgba(255,255,255,0.45)]">
              {index + 1}
            </span>

            <button
              type="button"
              disabled={locked || isLocked}
              onPointerDown={isLocked || locked ? undefined : (event) => startDrag(event, item)}
              style={{ touchAction: isLocked || locked ? 'auto' : 'none' }}
              className={`flex flex-1 items-center gap-2.5 rounded-[22px] border-2 px-4 py-3 text-left text-sm font-bold transition select-none ${
                locked || isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
              } ${isBeingDragged ? 'opacity-35 border-dashed border-slate-300 bg-slate-100/60 shadow-none' : cardClass}`}
            >
              {isLocked ? (
                <Lock size={15} className="shrink-0 text-amber-500" aria-hidden="true" />
              ) : (
                <GripVertical size={16} className="shrink-0 text-emerald-600/55" aria-hidden="true" />
              )}
              <span className="flex-1">{item}</span>
              {locked ? <ResultMark ok={ok} /> : null}
            </button>

            {!locked && !isLocked ? (
              <span className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-label="Lên"
                  disabled={index === 0 || (lockedItem && list[index - 1] === lockedItem)}
                  onClick={() => { gameSounds.tap(); swap(index, index - 1); }}
                  className={dewClass(
                    'dew-btn-white flex h-7 w-7 items-center justify-center rounded-full text-slate-600 cursor-pointer disabled:opacity-35',
                    'flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-35',
                  )}
                >
                  <ArrowUp size={13} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label="Xuống"
                  disabled={index === list.length - 1}
                  onClick={() => { gameSounds.tap(); swap(index, index + 1); }}
                  className={dewClass(
                    'dew-btn-white flex h-7 w-7 items-center justify-center rounded-full text-slate-600 cursor-pointer disabled:opacity-35',
                    'flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-35',
                  )}
                >
                  <ArrowDown size={13} strokeWidth={2.5} />
                </button>
              </span>
            ) : null}
          </li>
        );
      })}

      {draggingRow
        ? createPortal(
          <div
            data-theme={getDewSkillThemeAttr()}
            className="pointer-events-none fixed z-[9600] opacity-100 scale-[1.03] rotate-[1deg] flex items-center gap-2.5 rounded-[22px] border-2 border-emerald-400 bg-gradient-to-b from-white to-[#ECFDF5] px-4 py-3 text-sm font-extrabold text-emerald-950 ring-2 ring-emerald-400 shadow-[0_18px_35px_-6px_rgba(16,185,129,0.4)]"
            style={{ left: draggingRow.x, top: draggingRow.y, width: draggingRow.width }}
          >
            <GripVertical size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="truncate">{draggingRow.item}</span>
          </div>,
          document.body,
        )
        : null}
    </ol>
  );
}

// ── Ghép cặp ─────────────────────────────────────────────────────────────────
export function MatchQuestion({ question, reveal, result, onChange }) {
  return (
    <MatchingQuestionCard
      question={question}
      reveal={reveal}
      result={result}
      onChange={onChange}
    />
  );
}

// ── Điền vào chỗ trống ───────────────────────────────────────────────────────
export function FillQuestion({ question, reveal, result, onChange }) {
  return (
    <FillBlankQuestionCard
      question={question}
      reveal={reveal}
      result={result}
      onChange={onChange}
    />
  );
}

// ── Phân loại vào nhóm ───────────────────────────────────────────────────────
export function SortQuestion({ question, reveal, result, onChange }) {
  return (
    <CategorySortQuestion
      question={question}
      reveal={reveal}
      result={result}
      onChange={onChange}
    />
  );
}
