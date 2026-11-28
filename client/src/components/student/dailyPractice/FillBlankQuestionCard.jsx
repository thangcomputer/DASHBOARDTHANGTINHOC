import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripVertical, Lock, X } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

function detectBlankDropTarget(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return { slot: null, onTray: false };
  const blankEl = el.closest('[data-drop-blank]');
  if (blankEl) {
    if (blankEl.getAttribute('data-blank-locked') === 'true') {
      return { slot: null, onTray: false };
    }
    return { slot: Number(blankEl.getAttribute('data-drop-blank')), onTray: false };
  }
  if (el.closest('[data-drop-tray]')) {
    return { slot: null, onTray: true };
  }
  return { slot: null, onTray: false };
}

/**
 * Câu hỏi Điền vào chỗ trống theo phong cách Giọt Nước 3D (Dewdrop Glossy).
 * Hỗ trợ kéo–thả trực quan với Floating Preview sắc nét, preview từ ngay trong ô trống khi hover,
 * kéo giữa các ô (tự hoán đổi), nút × gỡ thẻ và Click-to-Place trên mobile/touchpad.
 */
export default function FillBlankQuestionCard({ question, reveal, result, onChange }) {
  const locked = Boolean(result);
  const segments = question?.segments || [];
  const bankWords = question?.bank || [];
  const blankCount = segments.filter((segment) => segment.blank !== undefined).length;

  const [blanks, setBlanks] = useState(() => Array(blankCount).fill(null));
  const [selectedChip, setSelectedChip] = useState(null);
  const [draggingChip, setDraggingChip] = useState(null);
  const [hoveredBlank, setHoveredBlank] = useState(null);
  const [hoveredTray, setHoveredTray] = useState(false);

  const lockedBlank = reveal?.blank || null;
  const dragRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    if (!lockedBlank) return;
    setBlanks((prev) => {
      const chipIdx = bankWords.findIndex(
        (word, idx) =>
          word === lockedBlank.word
          && !prev.some((assignedChip, slotIdx) => assignedChip === idx && slotIdx !== lockedBlank.index),
      );
      if (chipIdx < 0) return prev;
      return prev.map((value, idx) => {
        if (idx === lockedBlank.index) return chipIdx;
        return value === chipIdx ? null : value;
      });
    });
  }, [lockedBlank?.index, lockedBlank?.word, bankWords]);

  useEffect(() => {
    onChange?.(blanks.every((b) => b !== null) ? { blanks: blanks.map((i) => bankWords[i]) } : null);
  }, [blanks]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeChipInBlank = (chipIndex, targetSlot, fromSlot = null) => {
    if (locked || chipIndex === null || chipIndex === undefined) return;
    if (lockedBlank && targetSlot === lockedBlank.index) return;
    if (targetSlot < 0 || targetSlot >= blankCount) return;

    setBlanks((prev) => {
      const next = [...prev];
      const existingAtTarget = next[targetSlot];

      if (fromSlot !== null && fromSlot >= 0 && fromSlot < next.length && !(lockedBlank && fromSlot === lockedBlank.index)) {
        if (fromSlot === targetSlot) return prev;
        next[targetSlot] = chipIndex;
        next[fromSlot] = existingAtTarget !== null && existingAtTarget !== chipIndex ? existingAtTarget : null;
        return next;
      }

      return next.map((value, idx) => {
        if (idx === targetSlot) return chipIndex;
        return value === chipIndex ? null : value;
      });
    });
  };

  const removeBlankToTray = (slotIndex) => {
    if (locked || (lockedBlank && slotIndex === lockedBlank.index)) return;
    setBlanks((prev) => prev.map((value, idx) => (idx === slotIndex ? null : value)));
  };

  handlersRef.current = {
    placeChipInBlank,
    removeBlankToTray,
    handleTap: (chipIndex, fromSlot) => {
      if (locked) return;
      if (selectedChip !== null) {
        if (selectedChip === chipIndex) {
          gameSounds.tap();
          setSelectedChip(null);
          return;
        }
        if (fromSlot !== null) {
          const selectedFromSlot = blanks.indexOf(selectedChip);
          placeChipInBlank(selectedChip, fromSlot, selectedFromSlot >= 0 ? selectedFromSlot : null);
          gameSounds.drop();
          setSelectedChip(null);
          return;
        }
      }
      gameSounds.tap();
      setSelectedChip(chipIndex);
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
        setSelectedChip(null);
      }

      if (current.moved) {
        event.preventDefault();
        const { slot, onTray } = detectBlankDropTarget(event.clientX, event.clientY);
        setHoveredBlank(slot);
        setHoveredTray(onTray);
        setDraggingChip({
          chipIndex: current.chipIndex,
          word: current.word,
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
      setDraggingChip(null);
      setHoveredBlank(null);
      setHoveredTray(false);

      if (!current.moved) {
        handlersRef.current.handleTap?.(current.chipIndex, current.fromSlot);
        return;
      }

      const { slot, onTray } = detectBlankDropTarget(event.clientX, event.clientY);
      if (slot !== null) {
        gameSounds.drop();
        handlersRef.current.placeChipInBlank?.(current.chipIndex, slot, current.fromSlot);
        setSelectedChip(null);
      } else if (onTray && current.fromSlot !== null) {
        gameSounds.tap();
        handlersRef.current.removeBlankToTray?.(current.fromSlot);
        setSelectedChip(null);
      }
    };

    const handlePointerCancel = () => {
      dragRef.current = null;
      setDraggingChip(null);
      setHoveredBlank(null);
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

  const startDrag = (event, chipIndex, word, fromSlot = null) => {
    if (locked || event.button > 0) return;
    if (event.target.closest('[data-remove-blank]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      chipIndex,
      word,
      fromSlot,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      moved: false,
    };
  };

  const answers = result?.correctAnswer?.answers || [];
  const isDragging = Boolean(draggingChip);

  return (
    <div className="space-y-4">
      <div className="rounded-[26px] border border-white/95 bg-gradient-to-b from-white/95 to-[#F8FAFC]/90 p-5 text-[17px] font-bold leading-[2.85] text-slate-800 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.1),inset_0_2px_0_#fff]">
        {segments.map((segment, index) => {
          if (segment.blank === undefined) {
            return <span key={index}>{segment.text}</span>;
          }

          const slot = segment.blank;
          const chipIndex = blanks[slot];
          const word = chipIndex === null ? '' : (bankWords[chipIndex] || '');
          const isRevealLocked = Boolean(lockedBlank && slot === lockedBlank.index);
          const ok = locked && answers[slot]?.toLowerCase() === word.toLowerCase();
          const isHoveredDrop = Boolean(isDragging && !isRevealLocked && hoveredBlank === slot);
          const isDraggingSource = Boolean(draggingChip && draggingChip.fromSlot === slot && !isHoveredDrop);
          const isSelectedInSlot = Boolean(selectedChip !== null && chipIndex === selectedChip);
          const canMovePlaced = Boolean(chipIndex !== null && !locked && !isRevealLocked);

          let pillClass =
            'border-2 border-dashed border-emerald-300/85 bg-emerald-50/45 text-emerald-700/60 hover:border-emerald-400';

          if (locked) {
            pillClass = ok
              ? 'border-2 border-emerald-400 bg-gradient-to-b from-white to-[#ECFDF5] text-emerald-900 font-extrabold shadow-[0_6px_14px_-6px_rgba(16,185,129,0.28)]'
              : 'border-2 border-rose-300 bg-rose-50/95 text-rose-800 font-extrabold';
          } else if (isRevealLocked) {
            pillClass =
              'border-2 border-amber-300 bg-gradient-to-b from-white to-[#FEF3C7]/75 text-amber-900 font-extrabold shadow-[0_6px_14px_-6px_rgba(245,158,11,0.25)]';
          } else if (isHoveredDrop) {
            pillClass =
              'border-2 border-solid border-emerald-500 bg-emerald-100/90 text-emerald-900 ring-4 ring-emerald-200/80 scale-[1.04] shadow-[0_10px_22px_-6px_rgba(16,185,129,0.32)]';
          } else if (isDraggingSource) {
            pillClass =
              'border-2 border-dashed border-slate-300 bg-slate-100/70 text-slate-400 opacity-55';
          } else if (chipIndex !== null) {
            pillClass = isSelectedInSlot
              ? 'border-2 border-emerald-400 bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5] text-emerald-950 font-extrabold ring-2 ring-emerald-300/80 shadow-[0_10px_20px_-6px_rgba(16,185,129,0.34),inset_0_2px_0_#fff]'
              : 'border-2 border-emerald-300 bg-gradient-to-b from-white to-[#ECFDF5] text-[15px] font-extrabold text-emerald-950 shadow-[0_8px_18px_-6px_rgba(16,185,129,0.28),inset_0_2px_0_#fff] hover:border-emerald-400';
          } else if (isDragging) {
            pillClass =
              'border-2 border-dashed border-emerald-400 bg-emerald-50/70 text-emerald-700/80';
          } else if (selectedChip !== null) {
            pillClass =
              'border-2 border-dashed border-emerald-400 bg-emerald-50/85 text-emerald-700 animate-pulse';
          }

          let displayNode = <span className="tracking-widest text-emerald-600/60">···</span>;
          if (isHoveredDrop && draggingChip) {
            const isReplacing = Boolean(word && draggingChip.fromSlot !== slot && draggingChip.chipIndex !== chipIndex);
            displayNode = (
              <span className="font-extrabold text-emerald-800">
                {isReplacing ? `↻ ${draggingChip.word}` : draggingChip.word}
              </span>
            );
          } else if (isDraggingSource) {
            displayNode = <span className="text-xs italic text-slate-400">···</span>;
          } else if (word) {
            displayNode = <span>{word}</span>;
          }

          return (
            <span
              key={index}
              role={locked || isRevealLocked ? undefined : 'button'}
              tabIndex={locked || isRevealLocked ? undefined : 0}
              data-drop-blank={slot}
              data-blank-locked={isRevealLocked ? 'true' : 'false'}
              onPointerDown={canMovePlaced ? (event) => startDrag(event, chipIndex, word, slot) : undefined}
              onClick={
                !canMovePlaced && !locked && !isRevealLocked
                  ? () => {
                    if (selectedChip === null) return;
                    const selectedFromSlot = blanks.indexOf(selectedChip);
                    placeChipInBlank(selectedChip, slot, selectedFromSlot >= 0 ? selectedFromSlot : null);
                    gameSounds.drop();
                    setSelectedChip(null);
                  }
                  : undefined
              }
              onKeyDown={(event) => {
                if (locked || isRevealLocked) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (selectedChip !== null) {
                  const selectedFromSlot = blanks.indexOf(selectedChip);
                  placeChipInBlank(selectedChip, slot, selectedFromSlot >= 0 ? selectedFromSlot : null);
                  gameSounds.drop();
                  setSelectedChip(null);
                } else if (chipIndex !== null) {
                  gameSounds.tap();
                  setSelectedChip(chipIndex);
                }
              }}
              style={{ touchAction: canMovePlaced ? 'none' : 'auto' }}
              className={`mx-1.5 inline-flex min-h-[40px] min-w-[110px] items-center justify-center gap-1.5 rounded-full px-4 py-1 align-middle text-sm leading-normal transition-all select-none ${
                locked || isRevealLocked
                  ? 'cursor-default'
                  : canMovePlaced
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'
              } ${pillClass}`}
            >
              {isRevealLocked ? <Lock size={13} className="shrink-0 text-amber-500" aria-hidden="true" /> : null}
              {displayNode}

              {locked ? (
                ok ? (
                  <Check size={14} strokeWidth={3} className="shrink-0 text-emerald-600" aria-label="Đúng" />
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <X size={14} strokeWidth={3} className="shrink-0 text-rose-500" aria-label="Sai" />
                    {answers[slot] ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                        {answers[slot]}
                      </span>
                    ) : null}
                  </span>
                )
              ) : canMovePlaced && !isHoveredDrop && !isDraggingSource ? (
                <button
                  type="button"
                  data-remove-blank="true"
                  aria-label={`Gỡ từ ${word}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    gameSounds.tap();
                    removeBlankToTray(slot);
                    if (selectedChip === chipIndex) setSelectedChip(null);
                  }}
                  className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-700 transition hover:bg-rose-100 hover:text-rose-600 cursor-pointer"
                >
                  <X size={11} strokeWidth={2.8} />
                </button>
              ) : null}
            </span>
          );
        })}
      </div>

      {!locked ? (
        <div
          data-drop-tray="true"
          onClick={() => {
            if (selectedChip === null) return;
            const slotIdx = blanks.indexOf(selectedChip);
            if (slotIdx >= 0 && !(lockedBlank && slotIdx === lockedBlank.index)) {
              gameSounds.tap();
              removeBlankToTray(slotIdx);
              setSelectedChip(null);
            }
          }}
          className={`rounded-[24px] border backdrop-blur-md p-3.5 min-h-[66px] flex flex-wrap items-center gap-2.5 transition-all ${
            hoveredTray && draggingChip?.fromSlot !== null
              ? 'border-2 border-emerald-400 bg-emerald-50/75 ring-4 ring-emerald-200/60'
              : 'border-white/90 bg-white/75 shadow-[inset_0_2px_6px_rgba(15,23,42,0.04)]'
          }`}
        >
          {bankWords.some((_, idx) => !blanks.includes(idx)) ? (
            bankWords.map((word, idx) => {
              if (blanks.includes(idx)) return null;
              const isBeingDragged = Boolean(draggingChip?.chipIndex === idx && draggingChip.fromSlot === null);
              if (isBeingDragged) {
                return (
                  <div
                    key={`${word}-${idx}`}
                    className="rounded-full opacity-35 border-2 border-dashed border-slate-300 bg-slate-100/60 px-5 py-2.5 text-sm font-bold text-slate-400 select-none pointer-events-none inline-flex items-center gap-1.5"
                  >
                    <GripVertical size={14} aria-hidden="true" />
                    <span>{word}</span>
                  </div>
                );
              }

              return (
                <button
                  key={`${word}-${idx}`}
                  type="button"
                  onPointerDown={(event) => startDrag(event, idx, word, null)}
                  style={{ touchAction: 'none' }}
                  className={`${dewClass(
                    'dew-btn-white',
                    'rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50',
                  )} inline-flex items-center gap-1.5 select-none px-5 py-2.5 text-sm font-bold text-slate-800 cursor-grab active:cursor-grabbing transition ${
                    selectedChip === idx
                      ? '!border-emerald-400 ring-2 ring-emerald-400 !text-emerald-950 -translate-y-0.5'
                      : ''
                  }`}
                >
                  <GripVertical size={14} className="shrink-0 text-emerald-600/65" aria-hidden="true" />
                  <span>{word}</span>
                </button>
              );
            })
          ) : (
            <span className="px-2 py-1.5 text-xs font-semibold text-emerald-700/80">
              {draggingChip?.fromSlot !== null
                ? 'Thả vào đây để trả từ về khay'
                : 'Đã điền hết chỗ trống — bấm Kiểm tra nhé!'}
            </span>
          )}
        </div>
      ) : null}

      {draggingChip
        ? createPortal(
          <div
            data-theme={getDewSkillThemeAttr()}
            className={`${dewClass(
              'dew-btn-white',
              'rounded-full border bg-white',
            )} pointer-events-none fixed z-[9600] opacity-100 scale-105 rotate-[1.5deg] !border-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950 ring-2 ring-emerald-400 shadow-[0_18px_35px_-6px_rgba(16,185,129,0.42)] inline-flex items-center gap-1.5 whitespace-nowrap`}
            style={{ left: draggingChip.x, top: draggingChip.y, minWidth: draggingChip.width }}
          >
            <GripVertical size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{draggingChip.word}</span>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
