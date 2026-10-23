import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Smile } from 'lucide-react';
import { CHAT_STICKERS, matchesChatStickerSearch } from '../utils/chatStickers';
import ChatStickerImage from './ChatStickerImage';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😂', '😊', '😍',
  '🥰', '😘', '😎', '🤩', '🥳', '😢', '😭', '😡',
  '🤔', '👍', '❤️', '🔥', '🎉', '🙏', '👌', '💯',
  '😅', '😲', '😇', '😱', '👏', '🤝', '💪', '✨',
  '✅', '📚', '💡', '💕', '💖', '💔', '🙄', '🤗',
  '😴', '😣', '🤧', '😒', '😚', '😳', '🙁', '😤',
];
const STICKER_CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'greetings', label: 'Chào hỏi' },
  { id: 'thanks', label: 'Cảm ơn' },
  { id: 'confirm', label: 'Xác nhận' },
  { id: 'emotions', label: 'Cảm xúc' },
  { id: 'study', label: 'Học tập' },
  { id: 'teacher', label: 'Giáo viên' },
  { id: 'celebration', label: 'Chúc mừng' },
  { id: 'work', label: 'Công việc' },
  ...(CHAT_STICKERS.some((sticker) => sticker.category === 'other')
    ? [{ id: 'other', label: 'Khác' }]
    : []),
];
const RECENT_STICKERS_KEY = 'thvp_recent_chat_stickers_v1';
const MAX_RECENT_STICKERS = 16;

function readRecentStickers() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_STICKERS_KEY) || '[]');
    return Array.isArray(value)
      ? [...new Set(value.filter((id) => CHAT_STICKERS.some((sticker) => sticker.id === id)))]
        .slice(0, MAX_RECENT_STICKERS)
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
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState(readRecentStickers);
  const [missingStickerSources, setMissingStickerSources] = useState(() => new Set());
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const pickerRef = useRef(null);

  const stickersById = useMemo(
    () => new Map(CHAT_STICKERS.map((sticker) => [sticker.id, sticker])),
    [],
  );
  const hideUnavailableSticker = (stickerSrc) => {
    setMissingStickerSources((current) => new Set(current).add(stickerSrc));
  };
  const recentStickers = recentIds
    .map((id) => stickersById.get(id))
    .filter((sticker) => sticker && !missingStickerSources.has(sticker.src));
  const filteredStickers = useMemo(
    () => CHAT_STICKERS.filter((sticker) => (
      !missingStickerSources.has(sticker.src)
      && (category === 'all' || sticker.category === category)
      && matchesChatStickerSearch(sticker, search)
    )),
    [category, missingStickerSources, search],
  );
  const filteredRecentStickers = recentStickers.filter((sticker) => (
    (category === 'all' || sticker.category === category)
    && matchesChatStickerSearch(sticker, search)
  ));
  const visibleCategories = STICKER_CATEGORIES.slice(1).filter((item) => (
    category === 'all' || item.id === category
  ));

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
    if (disabled || typeof onSendSticker !== 'function') return;
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
          className={`cms-sticker-picker absolute bottom-full right-0 z-[60] mb-3 flex h-[min(480px,calc(100dvh-100px))] flex-col ${
            inline ? 'w-[min(392px,calc(100vw-56px))]' : 'w-[min(392px,calc(100vw-24px))]'
          } overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.18)] animate-in fade-in slide-in-from-bottom-2 duration-150`}
          role="dialog"
          aria-label="Bảng chọn emoji, sticker và GIF"
        >
          <div className="grid shrink-0 grid-cols-3 border-b border-slate-100" role="tablist" aria-label="Loại nội dung">
            {[
              { id: 'emoji', label: 'Emoji' },
              { id: 'stickers', label: 'Sticker' },
              { id: 'gif', label: 'GIF' },
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
            <div key={tab} className="min-h-0 flex-1 overflow-y-auto p-2.5 animate-in fade-in duration-150">
              <label className="relative mb-3 block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm sticker..."
                  aria-label="Tìm sticker"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="cms-sticker-categories mb-3 flex w-full min-w-0 flex-nowrap gap-1.5 overflow-x-auto whitespace-nowrap pb-1" aria-label="Danh mục sticker">
                {STICKER_CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    aria-pressed={category === item.id}
                    className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      category === item.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {filteredRecentStickers.length > 0 && (
                <StickerSection
                  label="Gần đây"
                  stickers={filteredRecentStickers}
                  disabled={disabled}
                  onSelect={sendSticker}
                  onMissing={hideUnavailableSticker}
                />
              )}

              {visibleCategories.map((item) => {
                const stickers = filteredStickers.filter((sticker) => sticker.category === item.id);
                if (stickers.length === 0) return null;
                return (
                  <StickerSection
                    key={item.id}
                    label={item.label}
                    stickers={stickers}
                    disabled={disabled}
                    onSelect={sendSticker}
                    onMissing={hideUnavailableSticker}
                  />
                );
              })}

              {filteredStickers.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-slate-500">
                  {search.trim()
                    ? 'Không tìm thấy sticker phù hợp.'
                    : category === 'all'
                      ? 'Chưa có sticker.'
                      : 'Danh mục này chưa có sticker.'}
                </p>
              )}
            </div>
          ) : tab === 'emoji' ? (
            <div key={tab} className="grid min-h-0 flex-1 content-start grid-cols-6 gap-1 overflow-y-auto p-2.5 animate-in fade-in duration-150">
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
          ) : (
            <div key={tab} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
              <span className="rounded-2xl bg-slate-100 p-3 text-2xl" aria-hidden="true">GIF</span>
              <p className="text-sm font-semibold text-slate-700">Thư viện GIF đang trống</p>
              <p className="max-w-xs text-xs leading-relaxed text-slate-500">
                Có thể thêm GIF vào thư mục public/gifs khi bộ ảnh được cung cấp.
              </p>
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
        aria-label={open ? 'Đóng bảng emoji, sticker và GIF' : 'Mở bảng emoji, sticker và GIF'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Emoji, sticker và GIF"
      >
        <Smile size={18} />
      </button>
    </div>
  );
}

function StickerSection({ label, stickers, disabled, onSelect, onMissing }) {
  return (
    <section className="mb-2 last:mb-0">
      <h3 className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</h3>
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
        {stickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            data-picker-item="true"
            disabled={disabled}
            onClick={() => onSelect(sticker)}
            className="group flex aspect-square min-w-0 items-center justify-center rounded-xl p-1 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Gửi sticker: ${sticker.name}`}
            title={sticker.name}
          >
            <ChatStickerImage
              sticker={sticker}
              decorative
              onMissing={onMissing}
              className="h-20 w-20 max-w-full object-contain transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
