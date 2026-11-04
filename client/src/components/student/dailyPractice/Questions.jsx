import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, GripVertical, Lock, X } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';

const CHIP = 'select-none rounded-xl border-2 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition !shadow-[0_3px_0_#CBD5E1]';
const CHIP_SELECTED = 'border-sky-400 bg-sky-50 text-sky-800 !shadow-[0_3px_0_#7DD3FC]';
const CHIP_IDLE = 'border-slate-200 hover:border-slate-300';
const ZONE = 'rounded-xl border-2 border-dashed transition';

/**
 * Kéo thả bằng pointer (chuột + cảm ứng) kèm chế độ chạm-chọn-rồi-chạm-đặt.
 * Phần tử thả có thuộc tính data-drop; chạm không di chuyển được tính là "tap".
 */
function usePointerDrag({ onDrop, onTap, disabled }) {
  const [ghost, setGhost] = useState(null);
  const stateRef = useRef(null);
  const handlers = useRef({ onDrop, onTap });
  handlers.current = { onDrop, onTap };

  useEffect(() => {
    const move = (event) => {
      const s = stateRef.current;
      if (!s) return;
      const dist = Math.hypot(event.clientX - s.startX, event.clientY - s.startY);
      if (!s.moved && dist > 6) {
        s.moved = true;
        gameSounds.pick();
      }
      if (s.moved) {
        event.preventDefault();
        setGhost({ id: s.id, label: s.label, x: event.clientX - s.offsetX, y: event.clientY - s.offsetY, w: s.w });
      }
    };
    const up = (event) => {
      const s = stateRef.current;
      if (!s) return;
      stateRef.current = null;
      setGhost(null);
      if (!s.moved) {
        handlers.current.onTap?.(s.id);
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop]');
      if (target) {
        gameSounds.drop();
        handlers.current.onDrop?.(s.id, target.getAttribute('data-drop'));
      }
    };
    const cancel = () => {
      stateRef.current = null;
      setGhost(null);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  const bind = (id, label) => ({
    onPointerDown: (event) => {
      if (disabled || event.button > 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      stateRef.current = {
        id, label, startX: event.clientX, startY: event.clientY,
        offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, w: rect.width, moved: false,
      };
    },
    style: { touchAction: 'none' },
  });

  const ghostEl = ghost ? createPortal(
    <div
      className={`${CHIP} ${CHIP_SELECTED} pointer-events-none fixed z-[9600] rotate-2 scale-105 opacity-95 !shadow-[0_12px_24px_rgba(15,23,42,0.25)]`}
      style={{ left: ghost.x, top: ghost.y, width: ghost.w }}
    >
      {ghost.label}
    </div>,
    document.body,
  ) : null;

  return { bind, ghostEl, draggingId: ghost?.id ?? null };
}

function ResultMark({ ok }) {
  return ok
    ? <Check size={16} className="shrink-0 text-emerald-600" aria-label="Đúng" />
    : <X size={16} className="shrink-0 text-red-500" aria-label="Sai" />;
}

// ── Trắc nghiệm ──────────────────────────────────────────────────────────────
export function McqQuestion({ question, reveal, result, chosen, onSubmit }) {
  const eliminated = new Set(reveal?.eliminate || []);
  const locked = Boolean(result);
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {question.options.map((option, index) => {
        const isCorrect = locked && result.correctAnswer?.correctIndex === index;
        const isWrongPick = locked && chosen === index && !isCorrect;
        const out = eliminated.has(index);
        return (
          <button
            key={option}
            type="button"
            disabled={locked || out}
            onClick={() => { gameSounds.tap(); onSubmit({ index }); }}
            className={`${CHIP} flex items-center gap-3 !py-3 text-left text-[15px] ${
              isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-800 !shadow-[0_3px_0_#6EE7B7] dp-pop'
                : isWrongPick ? 'border-red-400 bg-red-50 text-red-700 !shadow-[0_3px_0_#FCA5A5] dp-shake'
                  : out ? 'border-slate-100 bg-slate-50 text-slate-300 line-through opacity-60'
                    : CHIP_IDLE
            }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
              isCorrect ? 'bg-emerald-500 text-white' : isWrongPick ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="flex-1">{option}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Đúng / Sai ───────────────────────────────────────────────────────────────
export function TrueFalseQuestion({ result, chosen, onSubmit }) {
  const locked = Boolean(result);
  const options = [
    { value: true, label: 'Đúng', icon: Check, tone: 'emerald' },
    { value: false, label: 'Sai', icon: X, tone: 'red' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map(({ value, label, icon: Icon, tone }) => {
        const isCorrect = locked && result.correctAnswer?.answerBool === value;
        const isWrongPick = locked && chosen === value && !isCorrect;
        return (
          <button
            key={label}
            type="button"
            disabled={locked}
            onClick={() => { gameSounds.tap(); onSubmit({ value }); }}
            className={`${CHIP} flex flex-col items-center gap-2 !py-6 text-lg ${
              isCorrect ? 'border-emerald-500 bg-emerald-50 dp-pop' : isWrongPick ? 'border-red-400 bg-red-50 dp-shake' : CHIP_IDLE
            }`}
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${tone === 'emerald' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' : 'bg-gradient-to-b from-red-400 to-red-600'}`}>
              <Icon size={26} strokeWidth={3} aria-hidden="true" />
            </span>
            {label}
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
  const lockedItem = reveal?.first || null;

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

  const { bind, ghostEl, draggingId } = usePointerDrag({
    disabled: locked,
    onDrop: (item, dropIndex) => { swap(list.indexOf(item), Number(dropIndex)); setSelected(null); },
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
  });

  return (
    <ol className="space-y-2">
      {list.map((item, index) => {
        const isLocked = item === lockedItem;
        const ok = locked && result.correctAnswer?.items?.[index] === item;
        return (
          <li key={item} data-drop={index} className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{index + 1}</span>
            <button
              type="button"
              disabled={locked || isLocked}
              {...(isLocked ? {} : bind(item, item))}
              className={`${CHIP} flex flex-1 items-center gap-2 text-left ${
                locked ? (ok ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50')
                  : isLocked ? 'border-amber-300 bg-amber-50'
                    : selected === item ? CHIP_SELECTED : CHIP_IDLE
              } ${draggingId === item ? 'opacity-30' : ''}`}
            >
              {isLocked ? <Lock size={15} className="shrink-0 text-amber-500" /> : <GripVertical size={16} className="shrink-0 text-slate-300" />}
              <span className="flex-1">{item}</span>
              {locked && <ResultMark ok={ok} />}
            </button>
            {!locked && !isLocked && (
              <span className="flex flex-col">
                <button type="button" aria-label="Lên" onClick={() => swap(index, index - 1)} className="rounded p-0.5 text-slate-400 hover:text-slate-700 !shadow-none"><ArrowUp size={14} /></button>
                <button type="button" aria-label="Xuống" onClick={() => swap(index, index + 1)} className="rounded p-0.5 text-slate-400 hover:text-slate-700 !shadow-none"><ArrowDown size={14} /></button>
              </span>
            )}
          </li>
        );
      })}
      {ghostEl}
    </ol>
  );
}

// ── Ghép cặp ─────────────────────────────────────────────────────────────────
export function MatchQuestion({ question, reveal, result, onChange }) {
  const locked = Boolean(result);
  const [assign, setAssign] = useState(() => question.lefts.map(() => null));
  const [selected, setSelected] = useState(null);
  const lockedPair = reveal?.pair || null;
  const lockedIndex = lockedPair ? question.lefts.indexOf(lockedPair.left) : -1;

  useEffect(() => {
    if (lockedIndex < 0) return;
    setAssign((prev) => prev.map((value, index) => {
      if (index === lockedIndex) return lockedPair.right;
      return value === lockedPair.right ? null : value;
    }));
  }, [lockedIndex, lockedPair?.right]);

  useEffect(() => {
    onChange(assign.every(Boolean) ? { pairs: question.lefts.map((left, index) => ({ left, right: assign[index] })) } : null);
  }, [assign]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (right, slot) => {
    if (slot === lockedIndex) return;
    setAssign((prev) => prev.map((value, index) => {
      if (index === slot) return right;
      return value === right ? null : value;
    }));
  };

  const { bind, ghostEl, draggingId } = usePointerDrag({
    disabled: locked,
    onDrop: (right, slot) => { place(right, Number(slot)); setSelected(null); },
    onTap: (right) => { gameSounds.tap(); setSelected(selected === right ? null : right); },
  });

  const bank = question.rights.filter((right) => !assign.includes(right));
  const correctMap = new Map((result?.correctAnswer?.pairs || []).map((pair) => [pair.left, pair.right]));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {question.lefts.map((left, index) => {
          const value = assign[index];
          const ok = locked && correctMap.get(left) === value;
          return (
            <div key={left} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2">
              <span className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-black text-white">{left}</span>
              <button
                type="button"
                data-drop={index}
                disabled={locked || index === lockedIndex}
                onClick={() => {
                  if (selected) { place(selected, index); gameSounds.drop(); setSelected(null); } else if (value) {
                    gameSounds.tap();
                    setAssign((prev) => prev.map((v, i) => (i === index ? null : v)));
                  }
                }}
                className={`${ZONE} flex min-h-[44px] items-center gap-2 px-3 py-2 text-left text-sm font-bold !shadow-none ${
                  locked ? (ok ? 'border-solid border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-solid border-red-300 bg-red-50 text-red-700')
                    : index === lockedIndex ? 'border-solid border-amber-300 bg-amber-50 text-amber-800'
                      : value ? 'border-solid border-sky-300 bg-sky-50 text-sky-800'
                        : selected ? 'border-sky-400 bg-sky-50/50 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-400'
                }`}
              >
                {index === lockedIndex && <Lock size={14} className="shrink-0 text-amber-500" />}
                <span className="flex-1">{value || 'Thả thẻ vào đây'}</span>
                {locked && <ResultMark ok={ok} />}
              </button>
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="flex min-h-[52px] flex-wrap gap-2 rounded-2xl bg-slate-100/70 p-2.5">
          {bank.length ? bank.map((right) => (
            <button
              key={right}
              type="button"
              {...bind(right, right)}
              className={`${CHIP} ${selected === right ? CHIP_SELECTED : CHIP_IDLE} ${draggingId === right ? 'opacity-30' : ''}`}
            >
              {right}
            </button>
          )) : <span className="px-2 py-2 text-xs font-semibold text-slate-400">Đã ghép hết — bấm Kiểm tra nhé!</span>}
        </div>
      )}
      {locked && !result.correct && (
        <p className="text-xs text-slate-500">Đáp án: {result.correctAnswer?.text}</p>
      )}
      {ghostEl}
    </div>
  );
}

// ── Điền vào chỗ trống ───────────────────────────────────────────────────────
export function FillQuestion({ question, reveal, result, onChange }) {
  const locked = Boolean(result);
  const blankCount = question.segments.filter((s) => s.blank !== undefined).length;
  const [blanks, setBlanks] = useState(() => Array(blankCount).fill(null));
  const [selected, setSelected] = useState(null);
  const lockedBlank = reveal?.blank || null;

  useEffect(() => {
    if (!lockedBlank) return;
    const chip = question.bank.findIndex((word, i) => word === lockedBlank.word && !blanks.some((b, bi) => b === i && bi !== lockedBlank.index));
    if (chip < 0) return;
    setBlanks((prev) => prev.map((value, index) => {
      if (index === lockedBlank.index) return chip;
      return value === chip ? null : value;
    }));
  }, [lockedBlank?.index, lockedBlank?.word]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onChange(blanks.every((b) => b !== null) ? { blanks: blanks.map((i) => question.bank[i]) } : null);
  }, [blanks]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (chip, slot) => {
    if (lockedBlank && slot === lockedBlank.index) return;
    setBlanks((prev) => prev.map((value, index) => {
      if (index === slot) return chip;
      return value === chip ? null : value;
    }));
  };

  const { bind, ghostEl, draggingId } = usePointerDrag({
    disabled: locked,
    onDrop: (chip, slot) => { place(Number(chip), Number(slot)); setSelected(null); },
    onTap: (chip) => { gameSounds.tap(); setSelected(selected === Number(chip) ? null : Number(chip)); },
  });

  const answers = result?.correctAnswer?.answers || [];

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-white p-4 text-[17px] font-semibold leading-[2.6] text-slate-800 ring-1 ring-slate-200">
        {question.segments.map((segment, index) => {
          if (segment.blank === undefined) return <span key={index}>{segment.text}</span>;
          const slot = segment.blank;
          const chip = blanks[slot];
          const word = chip === null ? '' : question.bank[chip];
          const isLocked = lockedBlank && slot === lockedBlank.index;
          const ok = locked && answers[slot]?.toLowerCase() === word.toLowerCase();
          return (
            <button
              key={index}
              type="button"
              data-drop={slot}
              disabled={locked || isLocked}
              onClick={() => {
                if (selected !== null) { place(selected, slot); gameSounds.drop(); setSelected(null); } else if (chip !== null) {
                  gameSounds.tap();
                  setBlanks((prev) => prev.map((v, i) => (i === slot ? null : v)));
                }
              }}
              className={`${ZONE} mx-1 inline-flex min-w-[84px] items-center justify-center px-3 py-0.5 align-middle text-[15px] font-black leading-8 !shadow-none ${
                locked ? (ok ? 'border-solid border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-solid border-red-300 bg-red-50 text-red-600')
                  : isLocked ? 'border-solid border-amber-300 bg-amber-50 text-amber-700'
                    : chip !== null ? 'border-solid border-sky-300 bg-sky-50 text-sky-700'
                      : selected !== null ? 'border-sky-400 bg-sky-50/50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              {word || '\u00A0'}
              {locked && !ok && <span className="ml-1 text-xs text-emerald-600">({answers[slot]})</span>}
            </button>
          );
        })}
      </p>
      {!locked && (
        <div className="flex min-h-[52px] flex-wrap gap-2 rounded-2xl bg-slate-100/70 p-2.5">
          {question.bank.map((word, index) => (blanks.includes(index) ? null : (
            <button
              key={`${word}-${index}`}
              type="button"
              {...bind(String(index), word)}
              className={`${CHIP} ${selected === index ? CHIP_SELECTED : CHIP_IDLE} ${draggingId === String(index) ? 'opacity-30' : ''}`}
            >
              {word}
            </button>
          )))}
        </div>
      )}
      {ghostEl}
    </div>
  );
}

// ── Phân loại vào nhóm ───────────────────────────────────────────────────────
const BIN_TONES = ['#0EA5E9', '#A855F7', '#F97316', '#10B981'];

export function SortQuestion({ question, reveal, result, onChange }) {
  const locked = Boolean(result);
  const [placed, setPlaced] = useState({});
  const [selected, setSelected] = useState(null);
  const lockedItem = reveal?.item || null;

  useEffect(() => {
    if (!lockedItem) return;
    setPlaced((prev) => ({ ...prev, [lockedItem.name]: lockedItem.group }));
  }, [lockedItem?.name, lockedItem?.group]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const complete = question.items.every((item) => placed[item]);
    onChange(complete ? { placements: placed } : null);
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (item, group) => {
    if (lockedItem && item === lockedItem.name) return;
    setPlaced((prev) => ({ ...prev, [item]: group }));
  };

  const { bind, ghostEl, draggingId } = usePointerDrag({
    disabled: locked,
    onDrop: (item, groupIndex) => { place(item, question.groups[Number(groupIndex)]); setSelected(null); },
    onTap: (item) => { gameSounds.tap(); setSelected(selected === item ? null : item); },
  });

  const expected = useMemo(() => {
    const map = new Map();
    (result?.correctAnswer?.groups || []).forEach((group) => group.items.forEach((item) => map.set(item, group.name)));
    return map;
  }, [result]);
  const bank = question.items.filter((item) => !placed[item]);

  return (
    <div className="space-y-4">
      <div className={`grid gap-2.5 ${question.groups.length > 2 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {question.groups.map((group, groupIndex) => {
          const tone = BIN_TONES[groupIndex % BIN_TONES.length];
          const items = question.items.filter((item) => placed[item] === group);
          return (
            <div
              key={group}
              data-drop={groupIndex}
              role="presentation"
              onClick={() => { if (selected) { place(selected, group); gameSounds.drop(); setSelected(null); } }}
              className={`${ZONE} min-h-[120px] p-2.5 ${selected ? 'bg-sky-50/40' : 'bg-white'}`}
              style={{ borderColor: `${tone}66` }}
            >
              <p className="mb-2 rounded-lg px-2 py-1 text-center text-xs font-black text-white" style={{ background: tone }}>{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const isLocked = lockedItem?.name === item;
                  const ok = locked && expected.get(item) === group;
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={locked || isLocked}
                      onClick={(event) => {
                        event.stopPropagation();
                        gameSounds.tap();
                        setPlaced((prev) => { const next = { ...prev }; delete next[item]; return next; });
                      }}
                      className={`${CHIP} flex items-center gap-1 !px-2.5 !py-1.5 text-xs ${
                        locked ? (ok ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50') : isLocked ? 'border-amber-300 bg-amber-50' : CHIP_IDLE
                      }`}
                    >
                      {isLocked && <Lock size={12} className="text-amber-500" />}
                      {item}
                      {locked && <ResultMark ok={ok} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="flex min-h-[52px] flex-wrap gap-2 rounded-2xl bg-slate-100/70 p-2.5">
          {bank.length ? bank.map((item) => (
            <button
              key={item}
              type="button"
              {...bind(item, item)}
              className={`${CHIP} ${selected === item ? CHIP_SELECTED : CHIP_IDLE} ${draggingId === item ? 'opacity-30' : ''}`}
            >
              {item}
            </button>
          )) : <span className="px-2 py-2 text-xs font-semibold text-slate-400">Đã phân loại hết — bấm Kiểm tra nhé!</span>}
        </div>
      )}
      {ghostEl}
    </div>
  );
}
