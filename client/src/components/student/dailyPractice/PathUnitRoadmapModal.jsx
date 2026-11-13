import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen, Check, Crown, Dumbbell, Flame, Lock, Play, Route, Video as VideoIcon, X,
} from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { collectUnitVideos } from './PathUnitStageHeader';

const NODE_ICONS = { book: BookOpen, dumbbell: Dumbbell, flame: Flame, crown: Crown };
const LEVEL_LABELS = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };

function nodeStatus(node) {
  if (node.state === 'locked') return { text: 'Đang khóa', tone: 'bg-slate-100 text-slate-600' };
  if (node.state === 'completed') return { text: 'Đã xong', tone: 'bg-emerald-50 text-emerald-800' };
  return { text: 'Đang mở', tone: 'bg-amber-50 text-amber-900' };
}

function levelSummary(node) {
  const levels = node.levels || [];
  if (!levels.length) return '';
  const done = levels.filter((l) => l.state === 'completed').length;
  const names = levels.map((l) => LEVEL_LABELS[l.key] || l.label).join(' · ');
  return `${done}/${levels.length} cấp (${names})`;
}

function RoadmapModalHeader({ unit, color, openCount, total, onClose }) {
  const bar = color?.to || '#059669';
  return (
    <div
      className="shrink-0 px-4 pb-3 pt-4 text-white sm:px-5 sm:pt-5"
      style={{ background: `linear-gradient(165deg, ${color?.from || bar} 0%, ${bar} 100%)` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Route size={22} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/85">
            {`Chặng ${unit.index} · Lộ trình trong chặng`}
          </p>
          <h2 id="unit-roadmap-title" className="mt-0.5 text-lg font-black leading-tight sm:text-xl">
            {unit.title}
          </h2>
          <p className="mt-1 text-xs font-semibold text-white/85">
            {`${openCount}/${total} mốc đã mở · từ đầu đến cuối chặng`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/15 text-white transition hover:bg-black/25"
          aria-label="Đóng"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function PathUnitRoadmapModal({
  unit,
  color,
  onClose,
  onPickNode,
  onOpenVideo,
}) {
  const nodes = useMemo(
    () => [...(unit?.pathNodes || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [unit],
  );
  const videos = useMemo(() => collectUnitVideos(unit), [unit]);
  const hasVideo = Boolean(unit?.lesson) || videos.length > 0;

  if (!unit || !nodes.length) return null;

  const openCount = nodes.filter((n) => n.state !== 'locked').length;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="unit-roadmap-title"
        className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <RoadmapModalHeader unit={unit} color={color} openCount={openCount} total={nodes.length} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <ol className="relative space-y-0 pl-1">
            {nodes.map((node, index) => {
              const locked = node.state === 'locked';
              const done = node.state === 'completed';
              const active = node.state === 'active';
              const Icon = NODE_ICONS[node.icon] || Dumbbell;
              const status = nodeStatus(node);
              const summary = levelSummary(node);
              const canPick = !locked && onPickNode;
              const RowTag = canPick ? 'button' : 'div';
              return (
                <li key={node.key} className="relative flex gap-3 pb-5 last:pb-1">
                  {index < nodes.length - 1 ? (
                    <span
                      className={`absolute left-[1.35rem] top-10 bottom-0 w-0.5 ${locked ? 'bg-slate-200' : done ? 'bg-emerald-300' : 'bg-amber-200'}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative z-[1] shrink-0">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 shadow-sm ${
                        locked
                          ? 'border-slate-200 bg-slate-100 text-slate-400'
                          : done
                            ? 'border-emerald-400 bg-emerald-500 text-white'
                            : active
                              ? 'border-amber-300 bg-white text-amber-700 dp-roadmap-node-glow'
                              : 'border-white bg-white text-emerald-700'
                      }`}
                    >
                      {locked ? <Lock size={20} aria-hidden="true" /> : done ? <Check size={22} strokeWidth={3} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}
                    </span>
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 px-1 text-[10px] font-black text-white">
                      {index + 1}
                    </span>
                  </div>
                  <RowTag
                    type={canPick ? 'button' : undefined}
                    onClick={canPick ? () => { gameSounds.tap(); onPickNode(node.key); } : undefined}
                    className={`min-w-0 flex-1 pt-0.5 text-left ${canPick ? 'rounded-xl transition hover:bg-slate-50 active:bg-slate-100' : ''}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black text-slate-900">{node.label}</p>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${status.tone}`}>
                        {status.text}
                      </span>
                    </div>
                    {summary ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{summary}</p> : null}
                    {canPick ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                        <Play size={12} fill="currentColor" aria-hidden="true" />
                        Vào mốc này
                      </p>
                    ) : locked ? (
                      <p className="mt-1 text-xs font-semibold text-slate-400">Hoàn thành mốc trước để mở khóa</p>
                    ) : null}
                  </RowTag>
                </li>
              );
            })}
          </ol>
        </div>
        {hasVideo && onOpenVideo ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                gameSounds.tap();
                onOpenVideo();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-200"
            >
              <VideoIcon size={18} aria-hidden="true" />
              Video &amp; hướng dẫn chặng
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
