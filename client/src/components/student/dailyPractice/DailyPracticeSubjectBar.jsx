import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { topicColor, topicIcon } from '../../../utils/dailyPractice';
import { gameSounds } from '../../../utils/sound';

function normalizeTopics(topics, variant) {
  if (variant === 'free') {
    return (topics || []).map((topic) => {
      const total = (topic.counts?.easy || 0) + (topic.counts?.medium || 0) + (topic.counts?.hard || 0);
      return {
        id: topic.id,
        name: topic.name,
        icon: topic.icon,
        color: topic.color,
        metaPrimary: total > 0 ? `${total} câu` : 'Chưa có câu',
        metaPrimaryClass: 'text-slate-500 font-semibold',
        metaSecondary: null,
      };
    });
  }
  return (topics || []).map((item) => ({
    id: item.topic?.id,
    name: item.topic?.name,
    icon: item.topic?.icon,
    color: item.topic?.color,
    metaPrimary: item.totalUnits > 0 ? 'Đã sẵn sàng' : 'Đang soạn',
    metaPrimaryClass: 'text-emerald-600 font-bold',
    metaSecondary: item.totalUnits > 0 ? `${item.completedUnits}/${item.totalUnits}` : null,
  }));
}

/** Hàng môn cố định trên cùng — lộ trình hoặc luyện tự do, vuốt ngang + mũi tên. */
export default function DailyPracticeSubjectBar({
  topics = [],
  activeTopicId = '',
  onSelect,
  className = '',
  variant = 'path',
}) {
  const stripRef = useRef(null);
  const activeBtnRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const items = useMemo(() => normalizeTopics(topics, variant), [topics, variant]);

  const refreshScrollHints = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < max - 6);
  }, []);

  useEffect(() => {
    refreshScrollHints();
    const el = stripRef.current;
    if (!el) return undefined;
    const onScroll = () => refreshScrollHints();
    el.addEventListener('scroll', onScroll, { passive: true });
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => refreshScrollHints());
      ro.observe(el);
    }
    window.addEventListener('resize', refreshScrollHints);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
      window.removeEventListener('resize', refreshScrollHints);
    };
  }, [items.length, refreshScrollHints]);

  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    window.setTimeout(refreshScrollHints, 280);
  }, [activeTopicId, refreshScrollHints]);

  const nudge = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    gameSounds.tap();
    const step = Math.max(200, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  if (!items.length) return null;

  const overflow = canScrollLeft || canScrollRight;
  const listLabel = variant === 'free'
    ? 'Chủ đề luyện tự do — vuốt ngang hoặc dùng mũi tên'
    : 'Chủ đề lộ trình — vuốt ngang hoặc dùng mũi tên';

  return (
    <div className={`dp-dew-subject-carousel ${className}`.trim()} data-has-overflow={overflow ? 'true' : 'false'}>
      <button
        type="button"
        className="dp-dew-subject-arrow shrink-0"
        aria-label="Xem các môn bên trái"
        disabled={!canScrollLeft}
        onClick={() => nudge(-1)}
      >
        <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
      </button>

      <div ref={stripRef} className="dp-dew-subject-strip" role="list" aria-label={listLabel}>
        {items.map((item) => {
          const Icon = topicIcon(item.icon);
          const tone = topicColor(item.color);
          const active = item.id === activeTopicId;
          return (
            <button
              key={item.id}
              ref={active ? activeBtnRef : undefined}
              type="button"
              role="listitem"
              onClick={() => {
                gameSounds.tap();
                onSelect?.(item.id);
              }}
              className={`dp-dew-subject-chip flex items-center gap-2.5 px-3.5 py-3 text-left !shadow-none ${active ? 'dp-dew-subject-chip--active' : ''}`}
              style={{ borderColor: active ? tone.to : '#E2E8F0', background: active ? tone.soft : '#FFFFFF' }}
              aria-pressed={active}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: `linear-gradient(180deg, ${tone.from}, ${tone.to})` }}
              >
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight text-slate-900">{item.name}</span>
                <span className={`block text-[11px] ${item.metaPrimaryClass}`}>
                  {item.metaPrimary}
                  {item.metaSecondary ? (
                    <span className="ml-1 font-semibold text-slate-400">· {item.metaSecondary}</span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="dp-dew-subject-arrow shrink-0"
        aria-label="Xem các môn bên phải"
        disabled={!canScrollRight}
        onClick={() => nudge(1)}
      >
        <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
