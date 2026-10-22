import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { CHAT_STICKERS } from '../utils/chatStickers';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😂', '😊', '😍',
  '🥰', '😘', '😎', '🤩', '🥳', '😢', '😭', '😡',
  '🤔', '👍', '❤️', '🔥', '🎉', '🙏', '👌', '💯',
  '😅', '😲', '😇', '😱', '👏', '🤝', '💪', '✨',
  '✅', '📚', '💡', '💕', '💖', '💔', '🙄', '🤗',
  '😴', '😣', '🤧', '😒', '😚', '😳', '🙁', '😤',
];
const RECENT_STICKERS_KEY = 'thvp_recent_chat_stickers_v1';
const MAX_RECENT_STICKERS = 10;

function readRecentStickers() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_STICKERS_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((id) => CHAT_STICKERS.some((sticker) => sticker.id === id)).slice(0, MAX_RECENT_STICKERS)
      : [];
  } catch {
    return [];
  }
}

export default function StickerPicker({
  disabled = false,
  inline = false,
  onPickEmoji,
  onSendSticker,
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('stickers');
  const [recentIds, setRecentIds] = useState(readRecentStickers);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const pickerRef = useRef(null);

  const stickersById = useMemo(
    () => new Map(CHAT_STICKERS.map((sticker) => [sticker.id, sticker])),
    [],
  );
  const recentStickers = recentIds.map((id) => stickersById.get(id)).filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const items = Array.from(pickerRef.current?.querySelectorAll('[data-picker-item="true"]') || []);
      const currentIndex = items.indexOf(document.activeElement);
      if (currentIndex < 0 || items.length === 0) return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      items[(currentIndex + direction + items.length) % items.length]?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const rememberSticker = (stickerId) => {
    const next = [stickerId, ...recentIds.filter((id) => id !== stickerId)].slice(0, MAX_RECENT_STICKERS);
    setRecentIds(next);
    try {
      window.localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(next));
    } catch {
      // Recent stickers are an optional convenience when storage is unavailable.
    }
  };

  const sendSticker = async (sticker) => {
    if (disabled) return;
    const sent = await onSendSticker(sticker);
    if (sent) {
      rememberSticker(sticker.id);
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={inline ? 'relative shrink-0' : 'absolute right-2 top-1/2 -translate-y-1/2'}
    >
      {open ? (
        <section
          ref={pickerRef}
          className={`cms-sticker-picker absolute bottom-full right-0 z-[60] mb-3 ${
            inline ? 'w-[min(368px,calc(100vw-56px))]' : 'w-[min(368px,calc(100vw-24px))]'
          } overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.18)] animate-in fade-in slide-in-from-bottom-2 duration-150`}
          role="dialog"
          aria-label="Bảng chọn sticker và emoji"
        >
          <div className="grid grid-cols-2 border-b border-slate-100" role="tablist" aria-label="Loại nội dung">
            {[
              { id: 'stickers', label: 'STICKER' },
              { id: 'emoji', label: 'EMOJI' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`h-11 border-b-2 text-xs font-bold tracking-wide transition-colors ${
                  tab === item.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'stickers' ? (
            <div key={tab} className="max-h-[min(360px,55vh)] overflow-y-auto p-2.5 animate-in fade-in duration-150">
              {recentStickers.length > 0 ? (
                <>
                  <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Gần đây</p>
                  <StickerGrid stickers={recentStickers} disabled={disabled} onSelect={sendSticker} />
                  <p className="px-1 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sticker</p>
                </>
              ) : null}
              <StickerGrid stickers={CHAT_STICKERS} disabled={disabled} onSelect={sendSticker} />
            </div>
          ) : (
            <div key={tab} className="grid max-h-[min(300px,50vh)] grid-cols-6 gap-1 overflow-y-auto p-2.5 animate-in fade-in duration-150">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  data-picker-item="true"
                  onClick={() => onPickEmoji(emoji)}
                  className="flex h-10 items-center justify-center rounded-lg text-[1.55rem] transition hover:scale-110 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`Chèn emoji ${emoji}`}
                  title={`Chèn ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`flex ${inline ? 'h-9 w-9' : 'h-8 w-8'} items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 ${
          open ? 'text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'
        }`}
        aria-label={open ? 'Đóng bảng sticker và emoji' : 'Mở bảng sticker và emoji'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Sticker và emoji"
      >
        <Smile size={18} />
      </button>
    </div>
  );
}

function StickerGrid({ stickers, disabled, onSelect }) {
  return (
    <div className="grid grid-cols-3 min-[340px]:grid-cols-4 gap-1">
      {stickers.map((sticker) => (
        <button
          key={sticker.id}
          type="button"
          data-picker-item="true"
          disabled={disabled}
          onClick={() => onSelect(sticker)}
          className="group flex min-h-[6.6rem] flex-col items-center justify-center gap-2 rounded-xl p-2 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Gửi sticker: ${sticker.name}`}
          title={sticker.name}
        >
          <img
            src={sticker.src}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-14 w-full object-contain transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
          />
          <span className="w-full truncate text-center text-xs font-semibold leading-5 text-slate-700">
            {sticker.name}
          </span>
        </button>
      ))}
    </div>
  );
}
