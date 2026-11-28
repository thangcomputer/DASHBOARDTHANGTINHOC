import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
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
  if (variant === 'center-free') {
    return (topics || []).map((subject) => {
      const videos = Number(subject.videoCount) || 0;
      const contents = Number(subject.contentCount) || 0;
      const questions = Number(subject.questionCount) || 0;
      const hasAny = videos + contents + questions > 0;
      const totalUnits = Number(subject.totalUnitCount) || 0;
      const doneUnits = Number(subject.completedUnitCount) || 0;
      let metaPrimary = 'Đang cập nhật';
      let metaPrimaryClass = 'text-slate-500 font-semibold';
      if (hasAny && totalUnits > 0 && doneUnits > 0) {
        metaPrimary = `${doneUnits}/${totalUnits} bài`;
        metaPrimaryClass = 'text-emerald-700 font-bold';
      } else if (hasAny) {
        metaPrimary = 'Chưa học';
        metaPrimaryClass = 'w-fit rounded-md bg-slate-100 px-1.5 text-slate-600 font-bold';
      }
      return {
        id: subject.id,
        name: subject.name,
        icon: subject.icon || 'book',
        color: subject.color || 'green',
        locked: false,
        metaPrimary,
        metaPrimaryClass,
        metaSecondary: null,
      };
    });
  }
  return (topics || []).map((item) => {
    const isLocked = Boolean(item.locked)
      || (Array.isArray(item.units) && item.units.length > 0 && item.units.every((u) => u.state === 'locked'));
    return {
      id: item.topic?.id,
      name: item.topic?.name,
      icon: item.topic?.icon,
      color: item.topic?.color,
      locked: isLocked,
      metaPrimary: isLocked ? 'Đã khóa' : (item.totalUnits > 0 ? 'Đã sẵn sàng' : 'Đang soạn'),
      metaPrimaryClass: isLocked ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold',
      metaSecondary: item.totalUnits > 0 ? `${item.completedUnits}/${item.totalUnits}` : null,
    };
  });
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
          const dewPathActive = variant === 'path' && active;
          const dewPathIdle = variant === 'path' && !active;
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
              className={`dp-dew-subject-chip flex items-center gap-2 sm:gap-2.5 px-2.5 py-2 sm:px-3.5 sm:py-3 text-left !shadow-none cursor-pointer ${
                dewPathActive
                  ? 'dp-dew-subject-chip--dew-active rounded-2xl border border-white/60 text-white'
                  : dewPathIdle
                    ? 'rounded-2xl border border-white bg-white/85 backdrop-blur-md !shadow-[0_6px_16px_-8px_rgba(15,23,42,0.12),inset_0_1.5px_0_#fff] hover:border-emerald-200'
                    : (active ? 'dp-dew-subject-chip--active' : '')
              }`}
              style={dewPathActive
                ? { background: 'linear-gradient(90deg, #0284C7 0%, #0D9488 55%, #10B981 100%)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.72)' }
                : dewPathIdle
                  ? undefined
                  : { borderColor: active ? tone.to : '#E2E8F0', background: active ? tone.soft : '#FFFFFF' }}
              aria-pressed={active}
            >
              <span
                className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${dewPathActive ? 'bg-white/20 border border-white/35' : ''}`}
                style={dewPathActive ? undefined : { background: `linear-gradient(180deg, ${tone.from}, ${tone.to})` }}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span title={item.name} className={`block truncate text-[11.5px] sm:text-xs md:text-sm font-black leading-tight ${dewPathActive ? 'text-white' : 'text-slate-900'}`}>{item.name}</span>
                <span className={`block truncate text-[10px] sm:text-[11px] ${dewPathActive ? 'text-emerald-100 font-bold' : item.metaPrimaryClass}`}>
                  {item.locked ? <Lock size={10} className="mr-1 -mt-0.5 inline shrink-0" aria-hidden="true" /> : null}
                  {item.metaPrimary}
                  {item.metaSecondary ? (
                    <span className={`ml-1 font-semibold ${dewPathActive ? 'text-white/85' : 'text-slate-400'}`}>· {item.metaSecondary}</span>
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
