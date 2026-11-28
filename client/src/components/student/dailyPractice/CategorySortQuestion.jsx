import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripVertical, Lock, X } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

const GROUP_THEMES = {
  sky: {
    pill: 'bg-gradient-to-b from-[#38BDF8] via-[#0EA5E9] to-[#0284C7] shadow-[0_8px_18px_-4px_rgba(14,165,233,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]',
    zoneIdle: 'border-2 border-dashed border-sky-300/80 bg-white/80 shadow-[inset_0_2px_0_#fff,0_8px_20px_-10px_rgba(15,23,42,0.08)]',
    zoneActive: 'border-2 border-solid border-sky-400 bg-sky-50/90 ring-4 ring-sky-200/70 scale-[1.02] shadow-[0_16px_30px_-10px_rgba(14,165,233,0.28)]',
    placedChip: 'bg-sky-50/95 border-sky-300 text-sky-900 hover:border-sky-400',
    removeBtn: 'text-sky-600 hover:bg-sky-200/70 hover:text-sky-900',
    ghostSlot: 'border-2 border-dashed border-sky-400 bg-white/90 text-sky-700',
    emptyHint: 'text-sky-700/70',
  },
  purple: {
    pill: 'bg-gradient-to-b from-[#C084FC] via-[#9333EA] to-[#7E22CE] shadow-[0_8px_18px_-4px_rgba(147,51,234,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]',
    zoneIdle: 'border-2 border-dashed border-purple-300/80 bg-white/80 shadow-[inset_0_2px_0_#fff,0_8px_20px_-10px_rgba(15,23,42,0.08)]',
    zoneActive: 'border-2 border-solid border-purple-400 bg-purple-50/90 ring-4 ring-purple-200/70 scale-[1.02] shadow-[0_16px_30px_-10px_rgba(147,51,234,0.28)]',
    placedChip: 'bg-purple-50/95 border-purple-300 text-purple-900 hover:border-purple-400',
    removeBtn: 'text-purple-600 hover:bg-purple-200/70 hover:text-purple-900',
    ghostSlot: 'border-2 border-dashed border-purple-400 bg-white/90 text-purple-700',
    emptyHint: 'text-purple-700/70',
  },
  orange: {
    pill: 'bg-gradient-to-b from-[#FB923C] via-[#F97316] to-[#EA580C] shadow-[0_8px_18px_-4px_rgba(249,115,22,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]',
    zoneIdle: 'border-2 border-dashed border-orange-300/80 bg-white/80 shadow-[inset_0_2px_0_#fff,0_8px_20px_-10px_rgba(15,23,42,0.08)]',
    zoneActive: 'border-2 border-solid border-orange-400 bg-orange-50/90 ring-4 ring-orange-200/70 scale-[1.02] shadow-[0_16px_30px_-10px_rgba(249,115,22,0.28)]',
    placedChip: 'bg-orange-50/95 border-orange-300 text-orange-900 hover:border-orange-400',
    removeBtn: 'text-orange-600 hover:bg-orange-200/70 hover:text-orange-900',
    ghostSlot: 'border-2 border-dashed border-orange-400 bg-white/90 text-orange-700',
    emptyHint: 'text-orange-700/70',
  },
  emerald: {
    pill: 'bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#059669] shadow-[0_8px_18px_-4px_rgba(16,185,129,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]',
    zoneIdle: 'border-2 border-dashed border-emerald-300/80 bg-white/80 shadow-[inset_0_2px_0_#fff,0_8px_20px_-10px_rgba(15,23,42,0.08)]',
    zoneActive: 'border-2 border-solid border-emerald-400 bg-emerald-50/90 ring-4 ring-emerald-200/70 scale-[1.02] shadow-[0_16px_30px_-10px_rgba(16,185,129,0.28)]',
    placedChip: 'bg-emerald-50/95 border-emerald-300 text-emerald-900 hover:border-emerald-400',
    removeBtn: 'text-emerald-600 hover:bg-emerald-200/70 hover:text-emerald-900',
    ghostSlot: 'border-2 border-dashed border-emerald-400 bg-white/90 text-emerald-700',
    emptyHint: 'text-emerald-700/70',
  },
};

const FALLBACK_THEME_ORDER = ['sky', 'purple', 'orange', 'emerald'];
const TRAY_DROP_ID = '__TRAY__';

function resolveGroupTheme(groupName, index) {
  const normalized = String(groupName || '').trim().toLowerCase();
  if (normalized === 'home') return GROUP_THEMES.sky;
  if (normalized === 'insert') return GROUP_THEMES.purple;
  if (normalized === 'layout') return GROUP_THEMES.orange;
  const fallbackKey = FALLBACK_THEME_ORDER[index % FALLBACK_THEME_ORDER.length];
  return GROUP_THEMES[fallbackKey];
}

function detectDropZoneAtPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const groupEl = el.closest('[data-drop-group]');
  if (groupEl) return groupEl.getAttribute('data-drop-group');
  if (el.closest('[data-drop-tray]')) return TRAY_DROP_ID;
  return null;
}

/**
 * Câu hỏi phân loại thẻ vào nhóm theo phong cách Giọt Nước 3D (Dewdrop Glossy).
 * Hỗ trợ kéo–thả bằng pointer có preview bay sắc nét + khung đích phát sáng + click-to-place.
 */
export default function CategorySortQuestion({ question, reveal, result, onChange }) {
  const locked = Boolean(result);
  const [placed, setPlaced] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [activeDropZone, setActiveDropZone] = useState(null);

  const lockedItem = reveal?.item || null;
  const dragRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    if (!lockedItem?.name || !lockedItem?.group) return;
    setPlaced((prev) => ({ ...prev, [lockedItem.name]: lockedItem.group }));
  }, [lockedItem?.name, lockedItem?.group]);

  useEffect(() => {
    const items = question.items || [];
    const complete = items.length > 0 && items.every((item) => Boolean(placed[item]));
    onChange(
      complete
        ? {
          placements: placed,
          entries: Object.entries(placed).map(([item, group]) => ({ item, group })),
        }
        : null,
    );
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeItemInGroup = (item, group) => {
    if (locked || !group) return;
    if (lockedItem && item === lockedItem.name) return;
    setPlaced((prev) => {
      if (prev[item] === group) return prev;
      return { ...prev, [item]: group };
    });
  };

  const removeItemToTray = (item) => {
    if (locked) return;
    if (lockedItem && item === lockedItem.name) return;
    setPlaced((prev) => {
      if (!prev[item]) return prev;
      const next = { ...prev };
      delete next[item];
      return next;
    });
  };

  handlersRef.current = {
    onDropGroup: (item, targetGroup) => {
      placeItemInGroup(item, targetGroup);
      setSelectedItem(null);
    },
    onDropTray: (item, fromGroup) => {
      if (fromGroup) {
        removeItemToTray(item);
      }
      setSelectedItem(null);
    },
    onTap: (item) => {
      if (locked) return;
      if (lockedItem && item === lockedItem.name) return;
      gameSounds.tap();
      setSelectedItem((prev) => (prev === item ? null : item));
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
        setSelectedItem(null);
      }

      if (current.moved) {
        event.preventDefault();
        const x = event.clientX - current.offsetX;
        const y = event.clientY - current.offsetY;
        const hovered = detectDropZoneAtPoint(event.clientX, event.clientY);
        setActiveDropZone(hovered);
        setDragState({
          item: current.item,
          fromGroup: current.fromGroup,
          x,
          y,
          width: current.width,
        });
      }
    };

    const handlePointerUp = (event) => {
      const current = dragRef.current;
      if (!current) return;
      dragRef.current = null;
      setDragState(null);
      setActiveDropZone(null);

      if (!current.moved) {
        handlersRef.current.onTap?.(current.item);
        return;
      }

      const dropZone = detectDropZoneAtPoint(event.clientX, event.clientY);
      if (dropZone && dropZone !== TRAY_DROP_ID) {
        gameSounds.drop();
        handlersRef.current.onDropGroup?.(current.item, dropZone);
      } else if (dropZone === TRAY_DROP_ID && current.fromGroup) {
        gameSounds.tap();
        handlersRef.current.onDropTray?.(current.item, current.fromGroup);
      }
    };

    const handlePointerCancel = () => {
      dragRef.current = null;
      setDragState(null);
      setActiveDropZone(null);
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

  const startDrag = (event, item, fromGroup = null) => {
    if (locked || event.button > 0) return;
    if (lockedItem && item === lockedItem.name) return;
    if (event.target.closest('[data-remove-chip]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      item,
      fromGroup,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      moved: false,
    };
  };

  const expected = useMemo(() => {
    const map = new Map();
    (result?.correctAnswer?.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => map.set(item, group.name));
    });
    return map;
  }, [result]);

  const groups = question.groups || [];
  const items = question.items || [];
  const bankItems = items.filter((item) => !placed[item]);
  const draggingItem = dragState?.item || null;
  const showTrayActive = Boolean(dragState?.fromGroup && activeDropZone === TRAY_DROP_ID);

  return (
    <div className="space-y-4">
      <div className={`grid gap-3.5 ${groups.length > 2 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {groups.map((group, groupIndex) => {
          const theme = resolveGroupTheme(group, groupIndex);
          const groupItems = items.filter((item) => placed[item] === group);
          const isDropHovered = Boolean(draggingItem && activeDropZone === group);
          const showGhostSlot = Boolean(draggingItem && activeDropZone === group && placed[draggingItem] !== group);
          const isClickReady = Boolean(selectedItem && !draggingItem && !locked && placed[selectedItem] !== group);

          return (
            <div
              key={group}
              data-drop-group={group}
              role="presentation"
              onClick={() => {
                if (!selectedItem || locked) return;
                placeItemInGroup(selectedItem, group);
                gameSounds.drop();
                setSelectedItem(null);
              }}
              className={`rounded-[24px] min-h-[156px] p-3.5 flex flex-col gap-3 transition-all duration-150 backdrop-blur-sm ${
                isDropHovered ? theme.zoneActive : theme.zoneIdle
              } ${isClickReady ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
            >
              <div
                className={`rounded-full py-2.5 px-5 text-sm font-extrabold text-white text-center relative overflow-hidden select-none before:content-[''] before:pointer-events-none before:absolute before:inset-x-3 before:top-0.5 before:h-1/2 before:rounded-full before:bg-gradient-to-b before:from-white/45 before:to-transparent ${theme.pill}`}
              >
                <span className="relative z-[1]">{group}</span>
              </div>

              <div className="flex flex-1 flex-wrap content-start gap-2">
                {groupItems.map((item) => {
                  const isLockedHint = lockedItem?.name === item;
                  const isBeingDragged = draggingItem === item;
                  const ok = locked && expected.get(item) === group;
                  const expectedGroup = locked ? expected.get(item) : null;

                  if (isBeingDragged) {
                    return (
                      <div
                        key={item}
                        className="rounded-full opacity-35 border-2 border-dashed border-slate-300 bg-slate-100/60 px-4 py-2 text-xs font-bold text-slate-400 select-none pointer-events-none inline-flex items-center gap-1.5"
                      >
                        <GripVertical size={13} aria-hidden="true" />
                        <span>{item}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item}
                      onPointerDown={(event) => startDrag(event, item, group)}
                      style={{ touchAction: locked || isLockedHint ? 'auto' : 'none' }}
                      className={`rounded-full border px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_6px_14px_-4px_rgba(15,23,42,0.1),inset_0_1px_0_#fff] transition select-none ${
                        locked
                          ? ok
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                            : 'border-rose-300 bg-rose-50 text-rose-800'
                          : isLockedHint
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : selectedItem === item
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-300/80 cursor-grab active:cursor-grabbing'
                              : `${theme.placedChip} cursor-grab active:cursor-grabbing`
                      }`}
                    >
                      {isLockedHint ? (
                        <Lock size={12} className="shrink-0 text-amber-500" aria-hidden="true" />
                      ) : !locked ? (
                        <GripVertical size={13} className="shrink-0 opacity-50" aria-hidden="true" />
                      ) : null}

                      <span>{item}</span>

                      {locked ? (
                        <span className="inline-flex items-center gap-1 ml-0.5">
                          {ok ? (
                            <Check size={14} strokeWidth={3} className="text-emerald-600" aria-hidden="true" />
                          ) : (
                            <>
                              <X size={14} strokeWidth={3} className="text-rose-500" aria-hidden="true" />
                              {expectedGroup ? (
                                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700">
                                  → {expectedGroup}
                                </span>
                              ) : null}
                            </>
                          )}
                        </span>
                      ) : !isLockedHint ? (
                        <button
                          type="button"
                          data-remove-chip="true"
                          aria-label={`Gỡ ${item} khỏi ${group}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            gameSounds.tap();
                            removeItemToTray(item);
                            if (selectedItem === item) setSelectedItem(null);
                          }}
                          className={`ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full transition cursor-pointer ${theme.removeBtn}`}
                        >
                          <X size={12} strokeWidth={2.8} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}

                {showGhostSlot ? (
                  <div
                    className={`w-full rounded-full px-3.5 py-2 text-xs font-extrabold text-center animate-pulse ${theme.ghostSlot}`}
                  >
                    Thả &ldquo;{draggingItem}&rdquo; vào {group}
                  </div>
                ) : null}

                {!groupItems.length && !showGhostSlot ? (
                  <p className={`m-auto px-2 py-4 text-center text-xs font-semibold ${theme.emptyHint}`}>
                    {isClickReady ? `Bấm để đặt "${selectedItem}" vào đây` : 'Kéo thẻ vào đây'}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div
          data-drop-tray="true"
          onClick={() => {
            if (selectedItem && placed[selectedItem]) {
              gameSounds.tap();
              removeItemToTray(selectedItem);
              setSelectedItem(null);
            }
          }}
          className={`rounded-[24px] backdrop-blur-md p-3.5 min-h-[68px] flex flex-wrap items-center gap-2.5 transition-all ${
            showTrayActive
              ? 'border-2 border-emerald-400 bg-emerald-50/75 ring-4 ring-emerald-200/60'
              : 'border border-white/90 bg-white/75 shadow-[inset_0_2px_6px_rgba(15,23,42,0.04)]'
          }`}
        >
          {bankItems.length ? (
            bankItems.map((item) => {
              const isBeingDragged = draggingItem === item;
              const isSelected = selectedItem === item;

              if (isBeingDragged) {
                return (
                  <div
                    key={item}
                    className="rounded-full opacity-35 border-2 border-dashed border-slate-300 bg-slate-100/60 px-5 py-2.5 text-sm font-bold text-slate-400 select-none pointer-events-none inline-flex items-center gap-2"
                  >
                    <GripVertical size={14} aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                );
              }

              return (
                <button
                  key={item}
                  type="button"
                  onPointerDown={(event) => startDrag(event, item, null)}
                  style={{ touchAction: 'none' }}
                  className={`rounded-full bg-gradient-to-b from-white to-[#F0FDF4] border px-5 py-2.5 text-sm font-bold text-slate-800 shadow-[0_8px_18px_-6px_rgba(15,23,42,0.14),inset_0_2px_0_#fff] transition cursor-grab active:cursor-grabbing select-none inline-flex items-center gap-2 ${
                    isSelected
                      ? '!border-emerald-400 !from-[#ECFDF5] !to-[#D1FAE5] text-emerald-950 ring-2 ring-emerald-300/80 -translate-y-0.5'
                      : 'border-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_22px_-6px_rgba(16,185,129,0.25)]'
                  }`}
                >
                  <GripVertical size={14} className="shrink-0 text-emerald-600/65" aria-hidden="true" />
                  <span>{item}</span>
                </button>
              );
            })
          ) : (
            <span className="px-2 py-1.5 text-xs font-semibold text-emerald-700/75">
              Đã phân loại hết thẻ — bấm Kiểm tra nhé!
            </span>
          )}
        </div>
      )}

      {dragState
        ? createPortal(
          <div
            data-theme={getDewSkillThemeAttr()}
            className="pointer-events-none fixed z-[9600] opacity-100 scale-105 rotate-[2deg] rounded-full bg-gradient-to-b from-white to-[#ECFDF5] border-2 border-emerald-400 ring-2 ring-emerald-400/80 px-5 py-2.5 text-sm font-extrabold text-slate-900 shadow-[0_18px_35px_-6px_rgba(16,185,129,0.4),inset_0_2px_0_#fff] inline-flex items-center gap-2 whitespace-nowrap"
            style={{ left: dragState.x, top: dragState.y, minWidth: dragState.width }}
          >
            <GripVertical size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{dragState.item}</span>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
