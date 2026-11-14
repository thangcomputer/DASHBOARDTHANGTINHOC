import { BookOpen, FastForward, Play } from 'lucide-react';
import { unitStageCtaLabel } from '../../../../../shared/dailyPractice/lastPathTopic.mjs';

function darken(hex, amount = 0.28) {
  const value = String(hex || '#B91C1C').replace('#', '');
  const channel = (start) => Math.max(0, Math.round(parseInt(value.slice(start, start + 2), 16) * (1 - amount)));
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

const DIFF_META = [
  { key: 'easy', step: 'learn', label: 'Dễ' },
  { key: 'medium', step: 'practice', label: 'Vừa' },
  { key: 'hard', step: 'challenge', label: 'Khó' },
];
const DEFAULT_SEC_ORDER = ['content', 'file', 'video', 'practice'];

/** Danh sách video của một mốc bài học (ưu tiên levelConfigs, tương thích ngược levels). */
export function collectNodeVideos(unit, node) {
  if (!unit || !node) return [];
  const completedSet = new Set(unit.completedSections || []);
  const watchedSet = new Set(unit.watchedVideoIds || []);
  const nodeUnlocked = unit.state !== 'locked' && node.state !== 'locked';
  const isLevelDone = (diff) => {
    const cfg = node.levelConfigs?.[diff];
    const hidden = new Set(cfg?.hiddenSections || []);
    const order = (Array.isArray(cfg?.sectionOrder) && cfg.sectionOrder.length ? cfg.sectionOrder : DEFAULT_SEC_ORDER)
      .filter((k) => !hidden.has(k));
    return !order.length || order.every((secKey) => completedSet.has(`${node.key}:${diff}:${secKey}`));
  };
  const easyDone = isLevelDone('easy');
  const mediumDone = isLevelDone('medium');

  const items = [];
  const seenUrls = new Set();
  const hasLevelConfigVideo = DIFF_META.some((d) => Boolean(node.levelConfigs?.[d.key]?.video?.url));

  for (const d of DIFF_META) {
    const cfg = node.levelConfigs?.[d.key];
    const vid = cfg?.video;
    if (!vid?.url) continue;
    const hidden = new Set(cfg.hiddenSections || []);
    if (hidden.has('video')) continue;
    const diffUnlocked = unit.testedOut || d.key === 'easy'
      || (d.key === 'medium' && easyDone)
      || (d.key === 'hard' && easyDone && mediumDone);
    const order = (Array.isArray(cfg.sectionOrder) && cfg.sectionOrder.length ? cfg.sectionOrder : DEFAULT_SEC_ORDER)
      .filter((k) => !hidden.has(k));
    const idx = order.indexOf('video');
    const seqUnlocked = unit.testedOut || cfg.sequentialSections === false
      || idx <= 0
      || order.slice(0, idx).every((secKey) => completedSet.has(`${node.key}:${d.key}:${secKey}`));
    const unlocked = nodeUnlocked && diffUnlocked && seqUnlocked;
    const id = `${node.key}:level:${d.key}`;
    const watched = completedSet.has(`${node.key}:${d.key}:video`) || watchedSet.has(id);
    seenUrls.add(String(vid.url).trim());
    items.push({
      id,
      title: vid.title || `${node.label} (${d.label})`,
      url: unlocked ? vid.url : '',
      stepLabel: d.label,
      state: !unlocked ? 'locked' : watched ? 'completed' : 'active',
    });
  }

  for (const level of node.levels || []) {
    if (hasLevelConfigVideo && (node.kind === 'study' || Boolean(node.levelConfigs?.[DIFF_META.find((d) => d.step === level.key)?.key]?.video?.url))) {
      continue;
    }
    for (const video of level.videos || []) {
      if (!video?.id) continue;
      if (video.url && seenUrls.has(String(video.url).trim())) continue;
      const unlocked = nodeUnlocked && level.state !== 'locked';
      items.push({
        ...video,
        state: !unlocked ? 'locked' : video.state,
        stepLabel: video.stepLabel || level.label || '',
      });
    }
  }
  return items;
}

/** Danh sách video của chặng (unit + từng cấp). */
export function collectUnitVideos(unit) {
  const items = [];
  const seen = new Set();
  const push = (video) => {
    if (!video?.id || seen.has(video.id)) return;
    seen.add(video.id);
    items.push(video);
  };
  for (const video of unit?.videos || []) push(video);
  for (const node of unit?.pathNodes || []) {
    for (const video of collectNodeVideos(unit, node)) {
      push(video);
    }
  }
  return items;
}

export function UnitStageHeader({
  unit,
  color,
  onTestOut,
  highlight: isNextUnit = false,
  hasVideo: _hasVideo,
  testOutButtonRef,
  isStarted = false,
  onStartUnit,
  onStageAction,
  onRoadmap,
}) {
  const hasRoadmap = (unit.pathNodes || []).length > 0;
  const locked = unit.state === 'locked';
  const done = unit.state === 'completed';
  const steps = Array.isArray(unit.steps) ? unit.steps : [];
  const doneSteps = steps.filter((step) => step.state === 'completed').length;
  const totalSteps = steps.length;
  const progress = totalSteps ? doneSteps / totalSteps : 0;

  // Lên màu khi:
  // 1. Chặng đã xong (done / đã vượt): xong chặng này rồi đến chặng khác thì mới lên màu
  // 2. Chặng đang học và đã bấm bắt đầu (doneSteps > 0 hoặc isStarted): khi bấm bắt đầu thì mới lên màu
  // Bình thường (chưa bắt đầu hoặc locked): màu xám
  const activeAndStarted = !locked && (doneSteps > 0 || isStarted);
  const isColored = done || activeAndStarted;

  const barBg = isColored ? color.to : '#94A3B8';
  const barDeep = isColored ? darken(color.to, 0.18) : '#64748B';
  let statusLabel = '';
  if (done) statusLabel = 'Đã vượt';
  else if (activeAndStarted) statusLabel = 'Đang học';
  else if (locked) statusLabel = 'Chưa mở';
  else statusLabel = 'Chưa bắt đầu';

  const ctaLabel = unitStageCtaLabel(unit, { isNextUnit });

  return (
    <div className="w-full">
      <div
        className={`duo-stage-banner relative flex items-stretch overflow-hidden rounded-2xl text-white shadow-[0_3px_0_rgba(15,23,42,0.12)] ${!locked && !isColored ? 'cursor-pointer hover:brightness-105 transition-all' : ''}`}
        style={{ background: `linear-gradient(180deg, ${barBg} 0%, ${barDeep} 100%)` }}
        onClick={!locked && !isColored && onStartUnit ? onStartUnit : undefined}
      >
        <div className="min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/85">
            Chặng {unit.index}
            {statusLabel ? ` · ${statusLabel}` : ''}
          </p>
          <h3 className="mt-0.5 truncate text-lg font-black leading-tight sm:text-xl">{unit.title}</h3>
          {unit.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs font-medium text-white/80 sm:line-clamp-1">{unit.description}</p>
          ) : null}
          <div className="mt-2 flex max-w-[220px] items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-black tabular-nums text-white/90">{doneSteps}/{totalSteps}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch justify-center gap-2 border-l border-white/25 px-3 py-3 sm:px-4">
          {ctaLabel && onStageAction ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStageAction();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <Play size={14} fill="currentColor" aria-hidden="true" />
              {ctaLabel}
            </button>
          ) : null}
          {hasRoadmap && onRoadmap ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRoadmap();
              }}
              title="Lộ trình mốc trong chặng"
              aria-label="Lộ trình mốc trong chặng — mốc đã mở và đang khóa"
              className="duo-stage-roadmap-btn flex h-11 w-11 items-center justify-center self-center rounded-xl text-emerald-800"
            >
              <BookOpen size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {locked && unit.canTestOut ? (
        <div className="mt-2 flex justify-center">
          <button
            ref={testOutButtonRef}
            type="button"
            onClick={onTestOut}
            className="duo-btn duo-btn--dark duo-btn--sm"
          >
            <FastForward size={13} aria-hidden="true" />
            <span className="duo-btn__label">Kiểm tra vượt</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
