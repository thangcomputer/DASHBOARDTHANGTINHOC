import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripVertical, Lightbulb, Lock, X } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import Mascot from './Mascot';

function detectDropTarget(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return { slotIndex: null, onTray: false };
  const slotEl = el.closest('[data-drop-slot]');
  if (slotEl) {
    const isLocked = slotEl.getAttribute('data-slot-locked') === 'true';
    if (!isLocked) {
      return { slotIndex: Number(slotEl.getAttribute('data-drop-slot')), onTray: false };
    }
    return { slotIndex: null, onTray: false };
  }
  if (el.closest('[data-drop-tray]')) {
    return { slotIndex: null, onTray: true };
  }
  return { slotIndex: null, onTray: false };
}

/**
 * Câu hỏi Ghép cặp theo phong cách Giọt Nước 3D (Dewdrop Glossy).
 * Hỗ trợ kéo–thả trực quan có Floating Preview sắc nét, highlight ô đích + hàng trái tương ứng,
 * kéo sửa lại / hoán đổi giữa các ô và Click-to-Place mượt trên mobile/touchpad.
 */
export default function MatchingQuestionCard({
  question,
  reveal,
  result,
  onChange,
  standalone = false,
  onHint,
  onSubmit,
  hintCost = 2,
  busy = false,
}) {
  const locked = Boolean(result);
  const lefts = question?.lefts || [];
  const rights = question?.rights || [];
  const [assign, setAssign] = useState(() => lefts.map(() => null));
  const [selected, setSelected] = useState(null);
  const [draggingCard, setDraggingCard] = useState(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState(null);
  const [hoveredTray, setHoveredTray] = useState(false);

  const lockedPair = reveal?.pair || null;
  const lockedIndex = lockedPair ? lefts.indexOf(lockedPair.left) : -1;
  const dragRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    if (lockedIndex < 0) return;
    setAssign((prev) => prev.map((value, index) => {
      if (index === lockedIndex) return lockedPair.right;
      return value === lockedPair.right ? null : value;
    }));
  }, [lockedIndex, lockedPair?.right]);

  useEffect(() => {
    const ready = assign.every(Boolean)
      ? { pairs: lefts.map((left, index) => ({ left, right: assign[index] })) }
      : null;
    onChange?.(ready);
  }, [assign]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeIntoSlot = (cardLabel, targetSlot, fromSlot = null) => {
    if (locked || targetSlot === lockedIndex || targetSlot < 0 || targetSlot >= lefts.length) return;
    setAssign((prev) => {
      const next = [...prev];
      const existingAtTarget = next[targetSlot];

      if (fromSlot !== null && fromSlot >= 0 && fromSlot < next.length && fromSlot !== lockedIndex) {
        if (fromSlot === targetSlot) return prev;
        next[targetSlot] = cardLabel;
        next[fromSlot] = existingAtTarget && existingAtTarget !== cardLabel ? existingAtTarget : null;
        return next;
      }

      return next.map((value, index) => {
        if (index === targetSlot) return cardLabel;
        return value === cardLabel ? null : value;
      });
    });
  };

  const removeSlotToTray = (slotIndex) => {
    if (locked || slotIndex === lockedIndex || slotIndex < 0 || slotIndex >= lefts.length) return;
    setAssign((prev) => prev.map((value, index) => (index === slotIndex ? null : value)));
  };

  handlersRef.current = {
    placeIntoSlot,
    removeSlotToTray,
    handleTap: (label, fromSlot) => {
      if (locked) return;
      if (selected) {
        if (selected === label) {
          gameSounds.tap();
          setSelected(null);
          return;
        }
        if (fromSlot !== null) {
          const selectedFromSlot = assign.indexOf(selected);
          placeIntoSlot(selected, fromSlot, selectedFromSlot >= 0 ? selectedFromSlot : null);
          gameSounds.drop();
          setSelected(null);
          return;
        }
      }
      gameSounds.tap();
      setSelected(label);
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
        setSelected(null);
      }

      if (current.moved) {
        event.preventDefault();
        const { slotIndex, onTray } = detectDropTarget(event.clientX, event.clientY);
        setHoveredSlotIndex(slotIndex);
        setHoveredTray(onTray);
        setDraggingCard({
          label: current.label,
          fromSlot: current.fromSlot,
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
      setDraggingCard(null);
      setHoveredSlotIndex(null);
      setHoveredTray(false);

      if (!current.moved) {
        handlersRef.current.handleTap?.(current.label, current.fromSlot);
        return;
      }

      const { slotIndex, onTray } = detectDropTarget(event.clientX, event.clientY);
      if (slotIndex !== null) {
        gameSounds.drop();
        handlersRef.current.placeIntoSlot?.(current.label, slotIndex, current.fromSlot);
        setSelected(null);
      } else if (onTray && current.fromSlot !== null) {
        gameSounds.tap();
        handlersRef.current.removeSlotToTray?.(current.fromSlot);
        setSelected(null);
      }
    };

    const handlePointerCancel = () => {
      dragRef.current = null;
      setDraggingCard(null);
      setHoveredSlotIndex(null);
      setHoveredTray(false);
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

  const startDrag = (event, label, fromSlot = null) => {
    if (locked || event.button > 0) return;
    if (event.target.closest('[data-remove-slot]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      label,
      fromSlot,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      moved: false,
    };
  };

  const bank = rights.filter((right) => !assign.includes(right));
  const correctMap = new Map((result?.correctAnswer?.pairs || []).map((pair) => [pair.left, pair.right]));
  const canSubmit = assign.every(Boolean);
  const isDragging = Boolean(draggingCard);

  const matchingBody = (
    <div className="space-y-4">
      {/* Lưới 2 cột: Trái pill xanh dương→chàm, Phải ô thả kính mờ nét đứt xanh ngọc */}
      <div className="space-y-2.5">
        {lefts.map((left, index) => {
          const value = assign[index];
          const ok = locked && correctMap.get(left) === value;
          const expected = correctMap.get(left);
          const isRevealLocked = index === lockedIndex;
          const isHoveredDrop = Boolean(isDragging && !isRevealLocked && hoveredSlotIndex === index);
          const isDraggingSource = Boolean(draggingCard && draggingCard.fromSlot === index && !isHoveredDrop);
          const isCardSelectedInSlot = Boolean(selected && value === selected);

          let dropZoneClass =
            'rounded-full border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-3.5 text-slate-400 hover:border-emerald-300';
          if (locked) {
            dropZoneClass = ok
              ? 'rounded-full border border-emerald-300 bg-emerald-50/90 px-5 py-3.5 text-emerald-900 font-semibold shadow-2xs'
              : 'rounded-full border border-rose-300 bg-rose-50/90 px-5 py-3.5 text-rose-800 font-semibold';
          } else if (isRevealLocked) {
            dropZoneClass =
              'rounded-full border-2 border-amber-300 bg-amber-50/90 px-5 py-3.5 text-amber-900 font-semibold';
          } else if (isHoveredDrop) {
            dropZoneClass =
              'rounded-full border-2 border-solid border-emerald-500 bg-emerald-100/85 px-5 py-3.5 text-emerald-900 ring-4 ring-emerald-200/80 scale-[1.02] transition-all shadow-[0_12px_26px_-8px_rgba(16,185,129,0.3)]';
          } else if (isDraggingSource) {
            dropZoneClass =
              'rounded-full border-2 border-dashed border-slate-300 bg-slate-50/70 px-5 py-3.5 text-slate-400 opacity-60';
          } else if (value) {
            dropZoneClass = isCardSelectedInSlot
              ? 'rounded-full border-2 border-emerald-400 bg-emerald-50/95 px-5 py-3.5 text-emerald-950 font-semibold ring-2 ring-emerald-300/80 shadow-[0_8px_18px_-6px_rgba(16,185,129,0.3)]'
              : 'rounded-full border-2 border-emerald-300 bg-white/95 px-5 py-3.5 text-slate-800 font-semibold shadow-[0_6px_16px_-8px_rgba(16,185,129,0.28)] hover:border-emerald-400';
          } else if (isDragging) {
            dropZoneClass =
              'rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50/35 px-5 py-3.5 text-emerald-700/80 transition-all';
          } else if (selected) {
            dropZoneClass =
              'rounded-full border-2 border-dashed border-emerald-400 bg-emerald-50/75 px-5 py-3.5 text-emerald-700 animate-pulse';
          }

          let slotDisplayText = value || 'Thả thẻ vào đây';
          let slotTextClass = 'truncate';
          if (isHoveredDrop && draggingCard) {
            const isSameSource = draggingCard.fromSlot === index;
            const isReplacingOther = Boolean(value && value !== draggingCard.label);
            slotDisplayText = isReplacingOther && !isSameSource
              ? `Thay bằng "${draggingCard.label}"`
              : `Thả "${draggingCard.label}" vào đây`;
            slotTextClass = 'truncate font-bold text-emerald-800';
          } else if (isDraggingSource) {
            slotDisplayText = 'Đang nhấc thẻ...';
            slotTextClass = 'truncate italic text-slate-400';
          }

          const hasMovableValue = Boolean(value && !locked && !isRevealLocked);

          return (
            <div
              key={left}
              className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:gap-3"
            >
              {/* Pill trái màu xanh dương → chàm giọt nước 3D */}
              <div
                className={`rounded-full bg-gradient-to-b from-[#38BDF8] via-[#2563EB] to-[#4338CA] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-6px_rgba(37,99,235,0.4),inset_0_2px_0_rgba(255,255,255,0.45)] transition-all sm:text-[15px] ${
                  isHoveredDrop ? 'ring-4 ring-sky-200/90 scale-[1.01]' : ''
                }`}
              >
                {left}
              </div>

              {/* Ô thả kính mờ bên phải */}
              <div
                role={locked || isRevealLocked ? undefined : 'button'}
                tabIndex={locked || isRevealLocked ? undefined : 0}
                data-drop-slot={index}
                data-slot-locked={isRevealLocked ? 'true' : 'false'}
                onPointerDown={hasMovableValue ? (event) => startDrag(event, value, index) : undefined}
                onClick={
                  !hasMovableValue && !locked && !isRevealLocked
                    ? () => {
                      if (!selected) return;
                      const selectedFromSlot = assign.indexOf(selected);
                      placeIntoSlot(selected, index, selectedFromSlot >= 0 ? selectedFromSlot : null);
                      gameSounds.drop();
                      setSelected(null);
                    }
                    : undefined
                }
                onKeyDown={(event) => {
                  if (locked || isRevealLocked) return;
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  if (selected) {
                    const selectedFromSlot = assign.indexOf(selected);
                    placeIntoSlot(selected, index, selectedFromSlot >= 0 ? selectedFromSlot : null);
                    gameSounds.drop();
                    setSelected(null);
                  } else if (value) {
                    gameSounds.tap();
                    setSelected(value);
                  }
                }}
                style={{ touchAction: hasMovableValue ? 'none' : 'auto' }}
                className={`flex min-h-[50px] w-full items-center justify-between gap-2.5 text-left text-sm transition select-none ${
                  locked || isRevealLocked
                    ? 'cursor-default'
                    : hasMovableValue
                      ? 'cursor-grab active:cursor-grabbing'
                      : 'cursor-pointer'
                } ${dropZoneClass}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {isRevealLocked ? (
                    <Lock size={14} className="shrink-0 text-amber-500" aria-hidden="true" />
                  ) : hasMovableValue && !isHoveredDrop && !isDraggingSource ? (
                    <GripVertical size={14} className="shrink-0 text-emerald-600/60" aria-hidden="true" />
                  ) : null}

                  <span className={slotTextClass}>{slotDisplayText}</span>

                  {locked && !ok && expected ? (
                    <span className="ml-1 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      Đúng: {expected}
                    </span>
                  ) : null}
                </span>

                {locked ? (
                  ok ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                      <Check size={14} strokeWidth={3} aria-label="Đúng" />
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs">
                      <X size={14} strokeWidth={3} aria-label="Sai" />
                    </span>
                  )
                ) : hasMovableValue && !isHoveredDrop && !isDraggingSource ? (
                  <button
                    type="button"
                    data-remove-slot="true"
                    aria-label={`Trả thẻ ${value} về khay`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      gameSounds.tap();
                      removeSlotToTray(index);
                      if (selected === value) setSelected(null);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 cursor-pointer"
                  >
                    <X size={13} strokeWidth={2.8} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Khay thẻ kéo bên dưới */}
      {!locked ? (
        <div
          data-drop-tray="true"
          onClick={() => {
            if (!selected) return;
            const slotIdx = assign.indexOf(selected);
            if (slotIdx >= 0 && slotIdx !== lockedIndex) {
              gameSounds.tap();
              removeSlotToTray(slotIdx);
              setSelected(null);
            }
          }}
          className={`flex min-h-[58px] flex-wrap items-center gap-2.5 rounded-2xl border p-3 transition-all ${
            hoveredTray && draggingCard?.fromSlot !== null
              ? 'border-2 border-emerald-400 bg-emerald-50/75 ring-4 ring-emerald-200/60'
              : 'border-white/80 bg-slate-50/70 shadow-inner'
          }`}
        >
          {bank.length ? (
            bank.map((right) => {
              const isBeingDragged = Boolean(draggingCard?.label === right && draggingCard.fromSlot === null);
              if (isBeingDragged) {
                return (
                  <div
                    key={right}
                    className="rounded-full opacity-35 border-2 border-dashed border-slate-300 bg-slate-100/60 px-5 py-2.5 text-sm font-semibold text-slate-400 select-none pointer-events-none inline-flex items-center gap-1.5"
                  >
                    <GripVertical size={14} aria-hidden="true" />
                    <span>{right}</span>
                  </div>
                );
              }

              return (
                <button
                  key={right}
                  type="button"
                  onPointerDown={(event) => startDrag(event, right, null)}
                  style={{ touchAction: 'none' }}
                  className={`${dewClass(
                    'dew-btn-white',
                    'rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50',
                  )} inline-flex items-center gap-1.5 select-none px-5 py-2.5 text-sm font-semibold text-slate-800 cursor-grab active:cursor-grabbing transition ${
                    selected === right ? '!border-emerald-400 ring-2 ring-emerald-400 !text-emerald-900 -translate-y-0.5' : ''
                  }`}
                >
                  <GripVertical size={14} className="shrink-0 text-emerald-600/60" aria-hidden="true" />
                  <span>{right}</span>
                </button>
              );
            })
          ) : (
            <span className="px-2 py-1.5 text-xs font-semibold text-emerald-700">
              {draggingCard?.fromSlot !== null
                ? 'Thả vào đây để trả thẻ về khay'
                : 'Đã ghép đủ các cặp. Bấm Kiểm tra để chấm điểm nhé!'}
            </span>
          )}
        </div>
      ) : null}

      {draggingCard
        ? createPortal(
          <div
            data-theme={getDewSkillThemeAttr()}
            className={`${dewClass(
              'dew-btn-white',
              'rounded-full border bg-white',
            )} pointer-events-none fixed z-[9600] opacity-100 scale-105 rotate-[1.5deg] !border-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950 ring-2 ring-emerald-400 shadow-[0_18px_35px_-6px_rgba(16,185,129,0.42)] inline-flex items-center gap-1.5 whitespace-nowrap`}
            style={{ left: draggingCard.x, top: draggingCard.y, minWidth: draggingCard.width }}
          >
            <GripVertical size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{draggingCard.label}</span>
          </div>,
          document.body,
        )
        : null}
    </div>
  );

  if (!standalone) return matchingBody;

  return (
    <section className="dew-app-card relative mx-auto w-full max-w-4xl overflow-hidden rounded-[30px] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0EA5E9]" />
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100/90 pb-5">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b from-[#ECFDF5] to-[#E0F2FE]/80 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.25),inset_0_2px_4px_#fff]">
            <Mascot mood={locked ? (result?.correct ? 'correct' : 'incorrect') : 'learning'} size={44} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Câu hỏi · Ghép cặp</p>
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

      {matchingBody}

      {!locked && onSubmit ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs font-medium text-slate-400">Phím tắt: H gợi ý · Enter kiểm tra</p>
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => onSubmit({ pairs: lefts.map((left, index) => ({ left, right: assign[index] })) })}
            className="dew-btn-primary inline-flex items-center gap-2 px-7 py-3 text-sm font-extrabold cursor-pointer disabled:opacity-50"
          >
            <Check size={16} strokeWidth={2.8} aria-hidden="true" />
            <span>Kiểm tra</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
