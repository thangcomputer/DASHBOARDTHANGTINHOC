import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Award, BookOpen, Check, Crown, Dumbbell, FastForward, Flame, Loader2, Lock, Play, Route, Sparkles, Star, Trophy, X,
} from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import PathLessonModal from './PathLessonModal';
import WelcomeBackModal, { takeWelcomeBackTurn } from './WelcomeBackModal';
import PathVideoModal from './PathVideoModal';
import { gameSounds } from '../../../utils/sound';
import { QUESTION_STAKE_XP, SESSION_STAKE_XP, TEST_OUT_XP, topicColor, topicIcon, unitColor } from '../../../utils/dailyPractice';
import Mascot from './Mascot';
import { DropletMark, PathITBackdrop, PathStageArt } from './PathDecor';
import FreeMeetPlanModal from './FreeMeetPlanModal';

const STEP_ICONS = { learn: BookOpen, practice: Dumbbell, challenge: Flame };
const STEP_LABELS = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };


/** Nút học trên snake - không xen video (video nằm panel bên cạnh). */
function buildUnitPathItems(unit) {
  return (unit.pathNodes || []).map((node) => ({
    kind: 'hub',
    key: `hub-${node.key}`,
    node,
    state: node.state,
  }));
}

/** Danh sách video của chặng (unit + từng cấp) để hiện cạnh snake. */
function collectUnitVideos(unit) {
  const items = [];
  const seen = new Set();
  const push = (video) => {
    if (!video?.id || seen.has(video.id)) return;
    seen.add(video.id);
    items.push(video);
  };
  for (const video of unit.videos || []) push(video);
  for (const node of unit.pathNodes || []) {
    for (const level of node.levels || []) {
      for (const video of level.videos || []) {
        push({ ...video, stepLabel: video.stepLabel || level.label || STEP_LABELS[level.key] || '' });
      }
    }
  }
  return items;
}

const NODE_ICONS = { book: BookOpen, dumbbell: Dumbbell, flame: Flame, crown: Crown };
/** Hai linh vật mỗi chặng. Mỗi mục là [bản màu, bản đen] đúng tên file trong cam-xuc-animation. */
const STAGE_BUDDIES = [
  ['suy nghĩ.webp', 'suy nghĩ đen.webp'],
  ['khóc.webp', 'khóc đen.webp'],
  ['khắc phục.webp', 'khắc phục đen.webp'],
  ['học ngủ.webp', 'học ngủ đen.webp'],
  ['dọc sách.webp', 'đọc sách đen.webp'],
  ['được.webp', 'được đen.webp'],
  ['checklish.webp', 'checklish đen.webp'],
  ['buồn.webp', 'buồn đen.webp'],
  ['trái tim.webp', 'trái tim đen.webp'],
  ['động lực.webp', 'động lực đen.webp'],
  ['word-excel-ppt.webp', 'word-excel-ppt đen.webp'],
  ['ý tưởng.webp', 'ý tưởng đen.webp'],
  ['vui tươi.webp', 'vui tươi den.webp'],
  ['tức giận.webp', 'tức giận đen.webp'],
];

function stageBuddySrc(file) {
  return `/cam-xuc-animation/${encodeURI(file)}`;
}

function stageBuddyPair(index, colored) {
  const total = STAGE_BUDDIES.length;
  const left = STAGE_BUDDIES[(index * 2) % total];
  const right = STAGE_BUDDIES[(index * 2 + 1) % total];
  return [left[colored ? 0 : 1], right[colored ? 0 : 1]];
}
/** Lệch ngang nút - lộ trình uốn lượn giữa màn hình (Duolingo). */
const NODE_OFFSETS = [0, 58, 0, -58];

/** Màu tối hơn cho "đế" nút 3D. */
function darken(hex, amount = 0.28) {
  const value = String(hex || '#B91C1C').replace('#', '');
  const channel = (start) => Math.max(0, Math.round(parseInt(value.slice(start, start + 2), 16) * (1 - amount)));
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

/** Hai giọt nước bóng, nằm giữa khoảng trống dưới nút. */
function PathSnakeConnector({ previousOffset, offset, active, color }) {
  const gradientId = `dpDrop${useId().replace(/:/g, '')}`;
  const height = 46;
  const from = { x: previousOffset - offset, y: 4 };
  const to = { x: 0, y: height - 6 };
  const travel = offset - previousOffset;
  const lean = Math.sign(travel || 1);
  const control = { x: from.x / 2 + lean * 20, y: height * 0.46 };
  const fill = active ? color : '#8FA0B4';
  const deep = active ? darken(color, 0.28) : '#5C6D82';
  const steps = [0.36, 0.7];
  const at = (t) => {
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    };
  };
  return (
    <svg
      className="pointer-events-none absolute left-1/2 z-[4] overflow-visible"
      style={{ top: -30, width: 240, height, transform: 'translateX(-120px)' }}
      viewBox="-120 0 240 46"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="38%" stopColor={fill} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
        <filter id={`${gradientId}s`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.8" floodColor={deep} floodOpacity="0.28" />
        </filter>
      </defs>
      {steps.map((t, index) => {
        const spot = at(t);
        const size = index === 0 ? 13 : 18;
        const tilt = lean * (index === 0 ? 16 : 28);
        return (
          <g key={t} transform={`translate(${spot.x} ${spot.y}) rotate(${tilt})`} filter={`url(#${gradientId}s)`}>
            <g transform={`translate(${-size / 2} ${-size * 0.58}) scale(${size / 24})`}>
              <path
                d="M12 1.5 C12 1.5 3.2 13 3.2 18.2 a8.8 8.8 0 0 0 17.6 0 C20.8 13 12 1.5 12 1.5 Z"
                fill={`url(#${gradientId})`}
              />
              <ellipse cx="8.6" cy="14.2" rx="2.3" ry="3.6" fill="#FFFFFF" opacity="0.78" transform="rotate(-22 8.6 14.2)" />
              <circle cx="15.2" cy="18.4" r="1.15" fill="#FFFFFF" opacity="0.55" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function ProgressRing({ size, progress, color }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

/** Một nút trên lộ trình - bên trong popover có 3 nấc Dễ / Vừa / Khó. */
function PracticeHubNode({ node, color, isNext, selected, onClick }) {
  const locked = node.state === 'locked';
  const done = node.state === 'completed';
  const size = 64;
  const levels = node.levels || [];
  const doneCount = levels.filter((level) => level.state === 'completed').length;
  const progress = levels.length ? doneCount / levels.length : 0;
  const HubIcon = NODE_ICONS[node.icon] || Dumbbell;
  const face = locked
    ? '#E5E7EB'
    : done
      ? 'radial-gradient(circle at 50% 30%, #FFD84D 0%, #F59E0B 65%)'
      : `radial-gradient(circle at 50% 30%, ${color.from} 0%, ${color.to} 60%)`;
  const base = locked ? '#C4C9D1' : done ? darken('#F59E0B', 0.18) : darken(color.to, 0.15);
  return (
    <div className="relative flex flex-col items-center" data-path-hub="">
      {isNext && !selected && (
        <span className="dp-bob absolute -top-11 z-30 whitespace-nowrap rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-sm" style={{ color: color.to }}>
          Bắt đầu
          <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-slate-200 bg-white" />
        </span>
      )}
      <div className="relative" style={{ width: size + 26, height: size + 26 }}>
        {isNext && <ProgressRing size={size + 26} progress={progress} color={color.from} />}
        <button
          type="button"
          disabled={locked}
          onClick={onClick}
          aria-label={node.kind === 'study' || node.icon === 'book' ? `${node.label}. Bài 1, Bài 2…` : `${node.label}. 3 cấp Dễ, Vừa, Khó`}
          aria-expanded={selected}
          className="dp-node absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full disabled:cursor-not-allowed"
          style={{
            width: size,
            height: size - 6,
            background: face,
            '--dp-node-base': base,
            color: locked ? '#9CA3AF' : '#FFFFFF',
          }}
        >
          <HubIcon size={22} strokeWidth={2.6} aria-hidden="true" className="drop-shadow-sm" />
          <span className="flex gap-0.5" aria-hidden="true">
            {levels.map((level) => (
              <span
                key={level.key}
                className={`h-1.5 w-1.5 rounded-full ${level.state === 'completed' ? 'bg-white' : level.state === 'active' ? 'bg-white ring-1 ring-white/50' : 'bg-white/35'}`}
              />
            ))}
          </span>
        </button>
      </div>
      <span className={`mt-1 text-xs font-black ${locked ? 'text-slate-400' : 'text-slate-700'}`}>{node.label}</span>
    </div>
  );
}

/** Popover cố định theo nút - vừa viewport, không cuộn, không bị che. */
function PathHubPopoverPortal({ anchorRef, anchorKey = '', children }) {
  const popRef = useRef(null);
  const [box, setBox] = useState({
    position: 'fixed',
    left: 8,
    top: 8,
    width: 280,
    zIndex: 9200,
    preferAbove: false,
  });

  useLayoutEffect(() => {
    const place = () => {
      const el = anchorRef.current;
      const pop = popRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 8;
      const gap = 8;
      const width = Math.min(window.innerWidth - pad * 2, 300);
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

      // Chiều cao thật - không maxHeight / overflow để tránh thanh cuộn và cắt nấc.
      const h = pop?.offsetHeight || 240;
      const spaceBelow = window.innerHeight - r.bottom - gap - pad;
      const spaceAbove = r.top - gap - pad;
      const preferAbove = spaceBelow < h && spaceAbove >= spaceBelow;

      let top = preferAbove ? r.top - gap - h : r.bottom + gap;
      top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));

      setBox({
        position: 'fixed',
        left,
        top,
        width,
        zIndex: 9200,
        preferAbove,
      });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, anchorKey]);

  if (typeof document === 'undefined') return null;
  const { preferAbove, ...style } = box;
  return createPortal(
    <div
      ref={popRef}
      data-path-popover
      className="overflow-visible"
      style={style}
      role="dialog"
    >
      <div className={preferAbove ? '[&_[data-pop-arrow]]:!top-auto [&_[data-pop-arrow]]:!-bottom-1.5' : ''}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Popover nút Học bài - Bài 1, Bài 2… (nội dung / video). */
function StudyHubPopover({ node, color, onClose, onOpenLesson }) {
  const lessons = node.levels || [];
  return (
    <div className="dp-pop relative w-full rounded-2xl p-3 text-left text-white shadow-xl sm:p-3.5" style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}>
      <span data-pop-arrow className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45" style={{ background: color.from }} />
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-1.5 top-1.5 rounded-full p-1 text-white/80 hover:bg-white/15 !shadow-none"><X size={14} /></button>
      <p className="pr-6 text-base font-black leading-tight sm:text-[17px]">{node.label}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-snug text-white/85 sm:text-[11px]">Học lần lượt. Xong bài trước mới mở bài sau</p>
      {!lessons.length ? (
        <p className="mt-2 rounded-xl border border-white/20 bg-black/10 px-2.5 py-2 text-[11px] font-semibold text-white/90">
          Chặng này chưa gắn bài học. Bạn có thể sang nút Luyện tập.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {lessons.map((lesson, index) => {
            const locked = lesson.state === 'locked';
            const done = lesson.state === 'completed';
            const hasVideo = Boolean(lesson.videos?.[0]?.url);
            const hasContent = Boolean(lesson.content || lesson.videos?.[0]?.content);
            return (
              <li key={lesson.key} className={`rounded-xl border px-2.5 py-2 ${locked ? 'border-white/10 bg-black/10 opacity-60' : 'border-white/25 bg-white/10'}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-black">
                    {done ? <Check size={14} /> : locked ? <Lock size={12} /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black sm:text-[13px]">{lesson.label}{lesson.title ? ` · ${lesson.title}` : ''}</p>
                    <p className="text-[10px] text-white/80">
                      {done ? 'Đã học' : locked ? 'Chưa mở' : [hasContent && 'Nội dung', hasVideo && 'Video'].filter(Boolean).join(' · ') || 'Sẵn sàng'}
                    </p>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => onOpenLesson(lesson)}
                      className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-800 !shadow-none sm:text-[11px]"
                    >
                      {done ? 'Xem lại' : 'Học'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Popover 3 nấc Dễ / Vừa / Khó trong nút Luyện / Thử thách / Hoàn thành. */
function LevelHubPopover({ node, color, starting, onClose, onStartStep }) {
  return (
    <div className="dp-pop relative w-full rounded-2xl p-3 text-left text-white shadow-xl sm:p-3.5" style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}>
      <span data-pop-arrow className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45" style={{ background: color.from }} />
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-1.5 top-1.5 rounded-full p-1 text-white/80 hover:bg-white/15 !shadow-none"><X size={14} /></button>
      <p className="pr-6 text-base font-black leading-tight sm:text-[17px]">{node.label}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-snug text-white/85 sm:text-[11px]">
        3 nấc Dễ, Vừa, Khó. Xong nấc trước mới mở nấc sau
      </p>
      <ul className="mt-2 space-y-1.5">
        {(node.levels || []).map((step, index) => {
          const locked = step.state === 'locked';
          const done = step.state === 'completed';
          const Icon = STEP_ICONS[step.key] || Dumbbell;
          return (
            <li key={step.key} className={`rounded-xl border px-2.5 py-2 ${locked ? 'border-white/10 bg-black/10 opacity-60' : 'border-white/25 bg-white/10'}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15">
                  {done ? <Check size={14} /> : locked ? <Lock size={12} /> : <Icon size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black leading-tight sm:text-[13px]">Nấc {index + 1} · {STEP_LABELS[step.key] || step.label}</p>
                  <p className="text-[10px] font-bold leading-tight text-white/75">
                    {done
                      ? `Đã xong · Ôn lại (0 XP) · cần đúng ${step.passPercent}%`
                      : `Cần đúng ${step.passPercent}% · ${QUESTION_STAKE_XP} XP/câu`}
                  </p>
                </div>
                {!locked && (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => onStartStep(step.key, { review: done })}
                    className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase text-slate-800 !shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[11px]"
                  >
                    {starting ? '…' : done ? 'Ôn lại' : 'Làm'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bảng bắt đầu kiểm tra vượt chặng. */
function StepPopover({ unit, step, testOut, canTestOut, color, starting, onClose, onStart, onUpgrade }) {
  const order = unit.steps.findIndex((item) => item.key === step.key) + 1;
  return (
    <div className="dp-pop relative w-full max-w-xs rounded-2xl p-4 text-left text-white shadow-lg" style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}>
      <span data-pop-arrow className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45" style={{ background: color.from }} />
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-2 top-2 rounded-full p-1 text-white/80 hover:bg-white/15 !shadow-none"><X size={16} /></button>
      <p className="text-lg font-black">{testOut ? 'Kiểm tra vượt chặng' : step.label}</p>
      <p className="text-xs font-semibold text-white/85">
        {testOut ? `Chặng ${unit.index} · Đạt ${step.passPercent}% để vượt chặng` : `Bước ${order}/${unit.steps.length} · Cần đúng ${step.passPercent}%`}
      </p>
      <p className="mt-1 text-xs text-white/80">
        {testOut
          ? (!canTestOut
            ? 'Đặc quyền chỉ dành cho học viên mua khóa / gói Google Meet (+300 XP/ngày). Học viên miễn phí không thể thi vượt chặng.'
            : `Đạt thì được ${TEST_OUT_XP} XP và vượt chặng. Không đạt hoặc thoát thì mất ${TEST_OUT_XP} XP.`)
          : `${QUESTION_STAKE_XP} XP/câu - sai trừ ngay; đạt % mới nhận +${QUESTION_STAKE_XP}/câu đúng.`}
      </p>
      {testOut && !canTestOut ? (
        <button
          type="button"
          onClick={onUpgrade}
          className="dp-3d-btn mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-black uppercase tracking-wide text-amber-950 shadow-md hover:bg-amber-300"
        >
          <Crown size={15} /> Nâng cấp gói để vượt
        </button>
      ) : (
        <button
          type="button"
          disabled={starting}
          onClick={onStart}
          className="dp-3d-btn dp-3d-btn--light mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-black uppercase tracking-wide"
          style={{ color: color.to }}
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {step.state === 'completed' && !testOut ? 'Luyện lại' : 'Bắt đầu'} · {testOut ? TEST_OUT_XP : `${QUESTION_STAKE_XP}/câu`}
        </button>
      )}
    </div>
  );
}

const FINALE_CONFETTI = ['#F59E0B', '#EF4444', '#10B981', '#0EA5E9', '#A855F7', '#F97316', '#FACC15'];

function PathConfettiBurst({ count = 36, spread = 220 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 4) * 0.14;
    const distance = spread * (0.48 + ((i * 7) % 11) / 17);
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance - 44)}px`,
      rot: `${(i * 73) % 720 - 360}deg`,
      color: FINALE_CONFETTI[i % FINALE_CONFETTI.length],
      delay: `${(i * 38) % 300}ms`,
    };
  }), [count, spread]);
  return pieces.map((piece, index) => (
    <span
      key={index}
      className="cms-goal-confetti"
      style={{ background: piece.color, '--dx': piece.dx, '--dy': piece.dy, '--rot': piece.rot, animationDelay: piece.delay }}
      aria-hidden="true"
    />
  ));
}

/** Popup hiệu ứng vinh danh & chúc mừng hoàn thành khóa học (Cúp vàng + Linh vật + Pháo giấy). */
function CourseTrophyCeremonyModal({ topicName, completedUnits, totalUnits, isCompleted, onClose }) {
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    gameSounds.win();
  }, [burstKey]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chúc mừng hoàn thành khóa học"
      onClick={onClose}
    >
      <div
        className="dp-pop relative w-full max-w-lg overflow-hidden rounded-[32px] border-2 border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50/60 p-6 text-center shadow-[0_28px_70px_-12px_rgba(245,158,11,0.45)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div key={burstKey}>
          <PathConfettiBurst count={48} spread={250} />
        </div>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-300/35 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-800 !shadow-none"
        >
          <X size={18} />
        </button>

        <div className="relative inline-flex items-center gap-1.5 rounded-full bg-[#D97706] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Award size={14} className="fill-[#FEF08A] text-[#FEF08A]" aria-hidden="true" />
          <span>CHỨNG NHẬN CHINH PHỤC LỘ TRÌNH</span>
        </div>

        <div className="relative mt-6 flex items-end justify-center gap-4 sm:gap-7">
          <div className="shrink-0">
            <Mascot mood="graduate" size={88} />
          </div>
          <div className="relative flex flex-col items-center">
            <div className="relative -mb-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#EA580C] shadow-sm">
              <Crown size={18} className="fill-[#FEF08A] text-white" aria-hidden="true" />
            </div>
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#FEF3C7] bg-[#F59E0B] text-white shadow-[0_12px_28px_rgba(217,119,6,0.36)]">
              <Trophy size={54} strokeWidth={2} className="drop-shadow-sm text-white" aria-hidden="true" />
            </div>
            <div className="relative -mt-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-white px-3.5 py-1 shadow-xs">
              {[1, 2, 3].map((n) => (
                <Star key={n} size={15} className="fill-[#FBBF24] text-[#F59E0B]" />
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <Mascot mood="celebrate" size={88} />
          </div>
        </div>

        <h3 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {`Cúp Vàng Danh Dự - ${topicName}`}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-normal leading-relaxed text-[#475569]">
          {isCompleted
            ? 'Chứng nhận bạn đã hoàn thành xuất sắc tất cả chặng thử thách của lộ trình. Hãy tự hào về hành trình kiên trì mỗi ngày của bạn!'
            : `Bạn đang trên chặng đường rước Cúp (${completedUnits}/${totalUnits} chặng đã xong). Cố gắng hoàn thành nốt các chặng còn lại nhé!`}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-amber-200 bg-white/90 p-3 shadow-sm">
            <p className="text-lg font-bold text-slate-900 tabular-nums">{completedUnits}/{totalUnits}</p>
            <p className="text-[11px] font-medium text-slate-500">Chặng đạt</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/90 p-3 shadow-sm">
            <p className="text-lg font-bold text-emerald-600">Cúp Vàng</p>
            <p className="text-[11px] font-medium text-slate-500">Danh hiệu</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white/90 p-3 shadow-sm">
            <p className="text-lg font-bold text-amber-600">{isCompleted ? '100%' : `${Math.round((completedUnits / (totalUnits || 1)) * 100)}%`}</p>
            <p className="text-[11px] font-medium text-slate-500">Khóa học</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setBurstKey((k) => k + 1)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-300 bg-amber-50 py-3 text-xs font-black uppercase tracking-wide text-amber-900 transition hover:bg-amber-100 !shadow-none"
          >
            <Sparkles size={16} className="text-amber-600" /> Bắn pháo hoa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="dp-3d-btn flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-xs font-black uppercase tracking-wide text-white shadow-md hover:from-amber-600 hover:to-orange-600"
          >
            <Trophy size={16} /> Tuyệt vời!
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Đài vinh danh & Cúp Vàng + Linh vật chúc mừng ở cuối lộ trình khóa học. */
function CourseFinaleMonument({ topicName, completedUnits, totalUnits, lastNodeOffset = 0, onCelebrate }) {
  const isCompleted = totalUnits > 0 && completedUnits >= totalUnits;
  return (
    <div className="relative z-10 mt-6 px-3 pb-8 pt-6 sm:px-6">
      <PathSnakeConnector
        previousOffset={lastNodeOffset}
        offset={0}
        active={isCompleted}
        color="#F59E0B"
      />
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-[28px] border-2 border-[#FCD34D] bg-gradient-to-b from-[#FFFDF7] via-white to-[#FEF9EE] p-6 text-center shadow-[0_12px_36px_rgba(245,158,11,0.18)] sm:p-8">
        {isCompleted && <PathConfettiBurst count={32} spread={200} />}
        <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-amber-300/30 blur-2xl" />

        <div className="relative inline-flex items-center gap-1.5 rounded-full bg-[#D97706] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
          <Sparkles size={14} className="fill-[#FEF08A] text-[#FEF08A]" aria-hidden="true" />
          <span>{isCompleted ? 'ĐÃ CHINH PHỤC TOÀN BỘ KHÓA HỌC' : `ĐÍCH ĐẾN CUỐI KHÓA · ${completedUnits}/${totalUnits} CHẶNG`}</span>
        </div>

        <div className="relative mt-5 flex items-end justify-center gap-4 sm:gap-7">
          <div className="shrink-0">
            <Mascot mood="graduate" size={82} />
          </div>

          <div className="relative flex flex-col items-center">
            {/* Crown badge on top of circle */}
            <div className="relative -mb-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#EA580C] shadow-sm">
              <Crown size={16} className="fill-[#FEF08A] text-white" aria-hidden="true" />
            </div>

            {/* Trophy circle */}
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#FEF3C7] bg-[#F59E0B] text-white shadow-[0_10px_24px_rgba(217,119,6,0.32)]">
              <Trophy size={48} strokeWidth={2} className="drop-shadow-sm text-white" aria-hidden="true" />
            </div>

            {/* 3 stars badge below circle */}
            <div className="relative -mt-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-white px-3 py-0.5 shadow-xs">
              {[1, 2, 3].map((n) => (
                <Star key={n} size={14} className="fill-[#FBBF24] text-[#F59E0B]" />
              ))}
            </div>
          </div>

          <div className="shrink-0">
            <Mascot mood="celebrate" size={82} />
          </div>
        </div>

        <h4 className="mt-5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {isCompleted ? `Chúc mừng hoàn thành khóa học ${topicName}!` : `Cúp Vàng Vinh Danh - ${topicName}`}
        </h4>
        <p className="mx-auto mt-2 max-w-md text-xs font-normal leading-relaxed text-[#475569] sm:text-sm">
          {isCompleted
            ? `Tuyệt vời! Bạn đã vượt qua trọn vẹn ${totalUnits}/${totalUnits} chặng học và chính thức rước Cúp Vàng Vinh Danh cùng linh vật Thắng Tin Học!`
            : `Hoàn thành hết ${totalUnits} chặng học (${completedUnits}/${totalUnits} đã xong) để chính thức mở khóa lễ trao Cúp Vàng Vinh Danh cùng linh vật chúc mừng!`}
        </p>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onCelebrate}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#9A3412] bg-gradient-to-b from-[#EA580C] to-[#C2410C] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(194,65,12,0.35)] transition-all hover:brightness-105 active:scale-98"
          >
            <Trophy size={18} className="text-white" aria-hidden="true" />
            <span>{isCompleted ? 'Nhận Cúp & Xem Vinh Danh' : 'Xem Hiệu Ứng Chúc Mừng Nhận Cúp'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
function UnitStageHeader({ unit, color, onTestOut, onWatch, highlight, hasVideo, testOutButtonRef }) {
  const locked = unit.state === 'locked';
  const done = unit.state === 'completed';
  const doneSteps = unit.steps.filter((step) => step.state === 'completed').length;
  const totalSteps = unit.steps.length;
  const progress = totalSteps ? doneSteps / totalSteps : 0;
  const barBg = locked ? '#94A3B8' : color.to;
  const barDeep = locked ? '#64748B' : darken(color.to, 0.18);
  let statusLabel = '';
  if (done) statusLabel = 'Đã vượt';
  else if (highlight && !locked) statusLabel = 'Đang học';
  else if (locked) statusLabel = 'Chưa mở';

  return (
    <div className="w-full">
      <div
        className="relative flex items-stretch overflow-hidden rounded-2xl text-white shadow-sm"
        style={{ background: `linear-gradient(180deg, ${barBg} 0%, ${barDeep} 100%)` }}
      >
        <div className="min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/85">
            Chặng {unit.index}
            {statusLabel ? ` · ${statusLabel}` : ''}
          </p>
          <h3 className="mt-0.5 truncate text-lg font-black leading-tight sm:text-xl">{unit.title}</h3>
          {unit.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs font-medium text-white/80">{unit.description}</p>
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
        <div className="flex shrink-0 items-center border-l border-white/25 px-3 sm:px-4">
          <button
            type="button"
            onClick={hasVideo ? onWatch : undefined}
            disabled={!hasVideo}
            title={hasVideo ? 'Xem video của chặng' : 'Chặng chưa có video'}
            aria-label={hasVideo ? 'Xem video của chặng' : 'Chặng chưa có video'}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-default disabled:opacity-50 !shadow-none"
          >
            <BookOpen size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
      {locked && unit.canTestOut && (
        <div className="mt-2 flex justify-center">
          <button
            ref={testOutButtonRef}
            type="button"
            onClick={onTestOut}
            className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-black text-white !shadow-none"
          >
            <FastForward size={13} aria-hidden="true" /> Kiểm tra vượt
          </button>
        </div>
      )}
    </div>
  );
}

/** Bài đang mở của chặng: bài học thì vào bài, câu hỏi thì vào đúng nấc. */
export function continuePracticeTarget(topic) {
  const next = topic?.next;
  if (!next?.unitId) return null;
  const unit = (topic.units || []).find((item) => item.id === next.unitId);
  if (!unit || unit.state === 'locked') return null;
  const node = (unit.pathNodes || []).find((item) => item.key === next.nodeKey);
  const level = (node?.levels || []).find((item) => item.key === next.step)
    || (node?.levels || []).find((item) => item.state === 'active');
  if (level?.state === 'locked') return null;
  return {
    topicId: topic.topic?.id || '',
    unit,
    level,
    kind: level?.kind || next.kind || 'quiz',
    nodeKey: node?.key || next.nodeKey || 'study',
    step: level?.key || next.step || 'learn',
  };
}

/** Video tiếp theo của chặng đang học: ưu tiên chặng dở, rồi video chưa xem và đang mở. */
export function continueStageTarget(topic) {
  const units = topic?.units || [];
  const nextId = topic?.next?.unitId || '';
  const ranked = [...units].sort((a, b) => {
    if (a.id === nextId) return -1;
    if (b.id === nextId) return 1;
    return (a.index || 0) - (b.index || 0);
  });
  for (const unit of ranked) {
    if (unit.state === 'locked') continue;
    const videos = collectUnitVideos(unit);
    const pending = videos.find((video) => video.state !== 'completed' && video.state !== 'locked');
    if (pending) return { topicId: topic.topic?.id || '', unit, videoId: pending.id };
    if (unit.lesson) return { topicId: topic.topic?.id || '', unit, videoId: '' };
  }
  return null;
}

/** Cuộn đúng nút bài đang học ra giữa màn hình. */
export function focusCurrentPathLesson() {
  window.dispatchEvent(new CustomEvent('dp-focus-current-lesson'));
}

/** Chủ đề lộ trình ưu tiên (liên kết URL → đang học dở → đầu tiên). */
export function pickActivePathTopic(path, initialTopicId = '') {
  const topics = path?.topics || [];
  if (!topics.length) return null;
  const linked = initialTopicId && topics.find((item) => item.topic.id === initialTopicId);
  const inProgress = topics.find((item) => item.next && item.completedUnits > 0);
  return linked || inProgress || topics[0];
}

/** Lộ trình luyện tập: chủ đề → chặng → Học / Luyện / Thử thách / Kiểm tra chặng (mở khóa tuần tự). */
export default function PathView({
  path, practiceStats, loading, error, starting, initialTopicId = '', onTopicChange, onStartStep, onPathChanged, layout = 'default',
  continueVideo = false, onContinueVideoOpened, requestedLesson = null, onRequestedLessonOpened,
}) {
  const topics = useMemo(() => path?.topics || [], [path]);
  const [topicId, setTopicId] = useState('');
  const onTopicChangeRef = useRef(onTopicChange);
  onTopicChangeRef.current = onTopicChange;

  useEffect(() => {
    if (topicId) onTopicChangeRef.current?.(topicId);
  }, [topicId]);
  const [popover, setPopover] = useState(null);
  const [videoOpen, setVideoOpen] = useState(null);
  const [lessonOpen, setLessonOpen] = useState(null);
  const [welcomeLesson, setWelcomeLesson] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [trophyModalOpen, setTrophyModalOpen] = useState(false);
  const hubAnchorRef = useRef(null);
  const testOutAnchorRef = useRef(null);
  const continueOpenedRef = useRef(false);
  const onContinueOpenedRef = useRef(onContinueVideoOpened);
  const onRequestedLessonOpenedRef = useRef(onRequestedLessonOpened);
  onContinueOpenedRef.current = onContinueVideoOpened;
  onRequestedLessonOpenedRef.current = onRequestedLessonOpened;
  const closePopover = useCallback(() => setPopover(null), []);
  const closeVideo = useCallback(() => {
    setVideoOpen(null);
    onPathChanged?.();
  }, [onPathChanged]);
  const closeLesson = useCallback(() => {
    setLessonOpen(null);
    onPathChanged?.();
  }, [onPathChanged]);

  useEffect(() => {
    if (topicId && topics.some((item) => item.topic.id === topicId)) return;
    if (!topics.length) return;
    const linked = initialTopicId && topics.find((item) => item.topic.id === initialTopicId);
    const inProgress = topics.find((item) => item.next && item.completedUnits > 0);
    setTopicId((linked || inProgress || topics[0]).topic.id);
  }, [topicId, topics, initialTopicId]);

  useEffect(() => {
    if (error) setPopover(null);
  }, [error]);

  useEffect(() => {
    if (!requestedLesson?.unit || !requestedLesson?.level) return;
    setLessonOpen({
      unit: requestedLesson.unit,
      lesson: requestedLesson.level,
      color: unitColor(requestedLesson.unit.index),
    });
    onRequestedLessonOpenedRef.current?.();
  }, [requestedLesson]);

  useEffect(() => {
    if (!continueVideo) {
      continueOpenedRef.current = false;
      return;
    }
    if (continueOpenedRef.current || !topics.length) return;
    const preferred = topics.find((item) => item.next) || topics.find((item) => continueStageTarget(item)) || null;
    const target = preferred ? continueStageTarget(preferred) : null;
    if (!preferred || !target) return;
    if (topicId !== preferred.topic.id) {
      setTopicId(preferred.topic.id);
      return;
    }
    continueOpenedRef.current = true;
    setVideoOpen({ unit: target.unit, videoId: target.videoId });
    onContinueOpenedRef.current?.();
  }, [continueVideo, topics, topicId]);

  useEffect(() => {
    if (!popover || videoOpen || lessonOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-path-popover]') || target.closest('[data-path-hub]')) return;
      setPopover(null);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPopover(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover, videoOpen, lessonOpen]);

  const current = topics.find((item) => item.topic.id === topicId) || null;
  const topicsRef = useRef(topics);
  const currentRef = useRef(current);
  topicsRef.current = topics;
  currentRef.current = current;

  useEffect(() => {
    const onFocus = () => {
      const list = topicsRef.current || [];
      const topic = (currentRef.current?.next ? currentRef.current : list.find((item) => item.next)) || currentRef.current;
      const next = topic?.next;
      if (!topic || !next) return;
      if (topic.topic.id !== currentRef.current?.topic?.id) setTopicId(topic.topic.id);
      setPopover({ unitId: next.unitId, nodeKey: next.nodeKey || 'study', testOut: false });
      window.setTimeout(() => {
        document.querySelector('[data-path-current]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }, 160);
    };
    window.addEventListener('dp-focus-current-lesson', onFocus);
    return () => window.removeEventListener('dp-focus-current-lesson', onFocus);
  }, []);
  const color = topicColor(current?.topic.color);
  const openHub = useMemo(() => {
    if (!popover || popover.testOut || !current) return null;
    const unit = current.units.find((item) => item.id === popover.unitId);
    if (!unit) return null;
    const node = (unit.pathNodes || []).find((item) => item.key === popover.nodeKey);
    if (!node) return null;
    return { unit, node, tone: unitColor(unit.index) };
  }, [popover, current]);
  const openTestOut = useMemo(() => {
    if (!popover?.testOut || !current) return null;
    const unit = current.units.find((item) => item.id === popover.unitId);
    if (!unit) return null;
    const step = unit.pathNodes?.flatMap((n) => n.levels || []).find((level) => level.key === 'challenge')
      || unit.steps.find((s) => s.key === 'challenge');
    if (!step) return null;
    return { unit, step };
  }, [popover, current]);
  const errorBanner = error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p> : null;

  if (loading && !path) {
    return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải lộ trình…</p>;
  }
  if (error && !topics.length) return errorBanner;
  if (!topics.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Mascot mood="thinking" size={80} className="mx-auto" />
        <p className="mt-3 font-bold text-slate-700">Trung tâm đang soạn lộ trình luyện tập.</p>
        <p className="text-sm text-slate-500">Bạn có thể dùng chế độ Luyện tự do trong lúc chờ nhé!</p>
      </div>
    );
  }

  const toggle = (unit, stepKey, testOut = false) => {
    gameSounds.tap();
    setPopover((prev) => (prev && prev.unitId === unit.id && prev.stepKey === stepKey && prev.testOut === testOut
      ? null
      : { unitId: unit.id, stepKey, testOut }));
  };
  const toggleHub = (unit, nodeKey) => {
    gameSounds.tap();
    setPopover((prev) => (prev && prev.unitId === unit.id && prev.nodeKey === nodeKey && !prev.testOut ? null : { unitId: unit.id, nodeKey, testOut: false }));
  };
  const nextUnit = current?.next ? current.units.find((unit) => unit.id === current.next.unitId) : null;
  const percent = current?.totalUnits ? Math.round((current.completedUnits / current.totalUnits) * 100) : 0;
  const wide = layout === 'wide';
  const laneInner = wide ? 'w-full max-w-[280px] lg:max-w-[300px]' : 'w-full max-w-[240px]';
  const offsetScale = wide ? 52 : 44;

  return (
    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {errorBanner}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {topics.map((item) => {
          const Icon = topicIcon(item.topic.icon);
          const tone = topicColor(item.topic.color);
          const active = item.topic.id === topicId;
          return (
            <button
              key={item.topic.id}
              type="button"
              onClick={() => { gameSounds.tap(); setTopicId(item.topic.id); setPopover(null); }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left transition !shadow-none sm:min-w-[160px] ${active ? 'shadow-sm' : ''}`}
              style={{ borderColor: active ? tone.to : '#E2E8F0', background: active ? tone.soft : '#FFFFFF' }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(180deg, ${tone.from}, ${tone.to})` }}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-black text-slate-900">{item.topic.name}</span>
                <span className="block text-[11px] font-semibold text-slate-500">{item.completedUnits}/{item.totalUnits} chặng</span>
              </span>
            </button>
          );
        })}
      </div>

      {current && (
        <>
          <section className="relative flex flex-col gap-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
            <Mascot mood={current.next ? 'studying' : 'done'} size={52} className="absolute -right-1 top-3 hidden opacity-90 sm:block" aria-hidden="true" />
            <div className="min-w-0 flex-1 sm:pr-14">
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider" style={{ color: color.text }}>
                <DropletMark size={12} fill={color.to} />
                Lộ trình {current.topic.name}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color.from}, ${color.to})` }} />
                </div>
                <span className="text-sm font-black text-slate-700 tabular-nums">{current.completedUnits}/{current.totalUnits}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {current.next
                  ? `Tiếp theo: Chặng ${nextUnit?.index} · ${current.next.nodeLabel || current.next.unitTitle}, ${current.next.stepLabel}`
                  : 'Bạn đã hoàn thành toàn bộ lộ trình chủ đề này 🎉 Luyện lại bất kỳ bước nào để giữ phong độ.'}
              </p>
            </div>
            {current.next && nextUnit && (
              <button
                type="button"
                data-path-hub=""
                onClick={focusCurrentPathLesson}
                className="cms-btn cms-btn-primary shrink-0 !py-2.5"
              >
                <Play size={16} /> Tiếp tục học
              </button>
            )}
          </section>

          <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-[#F7F7F7] shadow-sm">
            <PathITBackdrop accentSoft={color.soft} />
            {current.units.map((unit, unitIndex) => {
              const tone = unitColor(unit.index);
              const locked = unit.state === 'locked';
              const testOutOpen = popover?.unitId === unit.id && popover.testOut;
              const isNextUnit = current.next?.unitId === unit.id;
              const pathItems = buildUnitPathItems(unit);
              const unitVideos = collectUnitVideos(unit);
              const hasVideo = Boolean(unit.lesson) || unitVideos.length > 0;
              const nextIdx = pathItems.findIndex((item) => (
                current.next?.unitId === unit.id
                && (current.next.nodeKey ? current.next.nodeKey === item.node?.key : item.node?.key === 'study')
              ));
              const artAt = nextIdx >= 0 ? nextIdx : (unit.imageUrl ? 0 : -1);
              const openUnitVideo = (videoId = '') => {
                gameSounds.tap();
                setPopover(null);
                setVideoOpen({ unit, videoId });
              };
              const [buddyLeft, buddyRight] = stageBuddyPair(unitIndex, unit.state !== 'locked');
              const leftHigh = unitIndex % 2 === 0;
              const edge = '0.5cm';
              return (
                <article key={unit.id} className="relative z-[2]">
                  <img
                    src={stageBuddySrc(buddyLeft)}
                    alt=""
                    className="pointer-events-none absolute z-[3] h-24 w-24 object-contain drop-shadow-md sm:h-28 sm:w-28"
                    style={leftHigh ? { top: '0.35rem', left: edge } : { top: '42%', left: edge }}
                  />
                  <img
                    src={stageBuddySrc(buddyRight)}
                    alt=""
                    className={`pointer-events-none absolute z-[3] object-contain drop-shadow-md ${leftHigh ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-24 w-24 sm:h-28 sm:w-28'}`}
                    style={leftHigh ? { top: '42%', right: edge } : { top: '0.35rem', right: edge }}
                  />
                  <div className="relative px-3 py-2 sm:px-4">
                    <div className="relative z-20">
                      <UnitStageHeader
                        unit={unit}
                        color={tone}
                        highlight={isNextUnit}
                        hasVideo={hasVideo}
                        onTestOut={() => toggle(unit, 'challenge', true)}
                        onWatch={() => openUnitVideo('')}
                        testOutButtonRef={testOutOpen ? testOutAnchorRef : undefined}
                      />
                    </div>
                    <div className="relative z-30 px-1 pb-4 pt-14 sm:px-2">
                      <div className="relative flex flex-col items-center gap-5">
                        <div className={`relative mx-auto flex flex-col items-center gap-7 ${laneInner}`}>
                          {pathItems.map((item, index) => {
                            const hubSelected = popover && !popover.testOut && popover.unitId === unit.id && popover.nodeKey === item.node.key;
                            const offset = (NODE_OFFSETS[index % NODE_OFFSETS.length] / 58) * offsetScale;
                            const previous = index > 0 ? NODE_OFFSETS[(index - 1) % NODE_OFFSETS.length] : null;
                            const hubNext = nextIdx === index;
                            const linkActive = item.state !== 'locked';
                            const artSide = offset >= 0 ? 'left' : 'right';
                            return (
                              <div
                                key={item.key}
                                ref={hubSelected ? hubAnchorRef : undefined}
                                data-path-current={hubNext ? '1' : undefined}
                                className={`relative flex w-full flex-col items-center gap-2 ${hubSelected || hubNext ? 'z-30' : 'z-0'}`}
                                style={{ transform: `translateX(${offset}px)` }}
                              >
                                {index === artAt && !hasVideo && unit.imageUrl ? (
                                  <PathStageArt
                                    side={artSide}
                                    imageUrl={unit.imageUrl}
                                    mood={locked ? 'thinking' : hubNext ? 'determinedSoft' : 'studying'}
                                    size={80}
                                  />
                                ) : null}
                                {previous !== null && (
                                  <PathSnakeConnector
                                    previousOffset={(previous / 58) * offsetScale}
                                    offset={offset}
                                    active={linkActive}
                                    color={tone.from}
                                  />
                                )}
                                <PracticeHubNode
                                  node={item.node}
                                  color={tone}
                                  isNext={hubNext}
                                  selected={Boolean(hubSelected)}
                                  onClick={() => toggleHub(unit, item.node.key)}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {unit.imageUrl ? (
                          <div className="relative z-[2] flex w-full flex-col items-center lg:w-auto lg:pt-6">
                            <img
                              src={resolveMediaUrl(unit.imageUrl) || unit.imageUrl}
                              alt=""
                              className="dp-float hidden h-20 w-20 object-contain drop-shadow-md lg:block"
                              draggable={false}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {current.units.length > 0 && (() => {
              const lastUnit = current.units[current.units.length - 1];
              const lastItems = buildUnitPathItems(lastUnit);
              const lastIdx = Math.max(0, lastItems.length - 1);
              const lastOffset = (NODE_OFFSETS[lastIdx % NODE_OFFSETS.length] / 58) * offsetScale;
              return (
                <CourseFinaleMonument
                  topicName={current.topic.name}
                  completedUnits={current.completedUnits}
                  totalUnits={current.totalUnits}
                  lastNodeOffset={lastOffset}
                  onCelebrate={() => setTrophyModalOpen(true)}
                />
              );
            })()}
          </div>
        </>
      )}
      {trophyModalOpen && current && (
        <CourseTrophyCeremonyModal
          topicName={current.topic.name}
          completedUnits={current.completedUnits}
          totalUnits={current.totalUnits}
          isCompleted={current.totalUnits > 0 && current.completedUnits >= current.totalUnits}
          onClose={() => setTrophyModalOpen(false)}
        />
      )}
      {openTestOut && (
        <PathHubPopoverPortal
          anchorRef={testOutAnchorRef}
          anchorKey={`testout:${openTestOut.unit.id}`}
        >
          <StepPopover
            unit={openTestOut.unit}
            step={openTestOut.step}
            testOut
            canTestOut={path?.canTestOut === true}
            color={{ from: '#64748B', to: '#334155' }}
            starting={starting}
            onClose={closePopover}
            onUpgrade={() => setUpgradeOpen(true)}
            onStart={() => {
              setPopover(null);
              onStartStep(openTestOut.unit.id, 'study', 'challenge', true);
            }}
          />
        </PathHubPopoverPortal>
      )}
      {openHub && (
        <PathHubPopoverPortal
          anchorRef={hubAnchorRef}
          anchorKey={`${openHub.unit.id}:${openHub.node.key}`}
        >
          {(openHub.node.kind === 'study' || openHub.node.icon === 'book') ? (
            <StudyHubPopover
              node={openHub.node}
              color={openHub.tone}
              onClose={closePopover}
              onOpenLesson={(lesson) => {
                setPopover(null);
                const next = { unit: openHub.unit, lesson, color: openHub.tone };
                if (takeWelcomeBackTurn()) setWelcomeLesson(next);
                else setLessonOpen(next);
              }}
            />
          ) : (
            <LevelHubPopover
              node={openHub.node}
              color={openHub.tone}
              practiceStats={practiceStats}
              starting={starting}
              onClose={closePopover}
              onStartStep={(stepKey, opts) => {
                setPopover(null);
                onStartStep(openHub.unit.id, openHub.node.key, stepKey, false, opts);
              }}
            />
          )}
        </PathHubPopoverPortal>
      )}
      {videoOpen && (
        <PathVideoModal
          unit={videoOpen.unit}
          initialVideoId={videoOpen.videoId}
          color={unitColor(videoOpen.unit.index)}
          onClose={closeVideo}
          onWatched={async (videoId) => {
            await dailyPracticeApi.student.videoWatched(videoOpen.unit.id, videoId);
            onPathChanged?.();
          }}
        />
      )}
      {welcomeLesson && (
        <WelcomeBackModal
          unitIndex={welcomeLesson.unit?.index}
          unitTitle={welcomeLesson.unit?.title}
          lessonLabel={welcomeLesson.lesson?.title || welcomeLesson.lesson?.label || ''}
          onEnter={() => {
            setLessonOpen(welcomeLesson);
            setWelcomeLesson(null);
          }}
        />
      )}
      {lessonOpen && (
        <PathLessonModal
          lesson={lessonOpen.lesson}
          unitId={lessonOpen.unit.id}
          color={lessonOpen.color}
          onClose={closeLesson}
          onComplete={async (videoId) => {
            await dailyPracticeApi.student.videoWatched(lessonOpen.unit.id, videoId);
            onPathChanged?.();
          }}
        />
      )}
      <FreeMeetPlanModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onPaid={onPathChanged}
      />
    </div>
  );
}

/** Kết quả bước lộ trình trên màn tổng kết. */
export function PathResultCard({ result }) {
  const passed = result.passed;
  const isGrandSuccess = Boolean(passed && (result.topicCompleted || result.unitCompleted || result.testOut));
  let title;
  let text;
  if (!passed) {
    title = `Chưa qua ${result.testOut ? 'bài kiểm tra vượt chặng' : `bước ${result.stepLabel}`}`;
    text = result.testOut
      ? `Bạn đạt ${result.scorePercent}% (cần ${result.passPercent}%). Mất ${TEST_OUT_XP} XP. Ôn lại rồi thử lại nhé!`
      : `Bạn đạt ${result.scorePercent}%, cần từ ${result.passPercent}%. Sai −${QUESTION_STAKE_XP}/câu và không nhận XP câu đúng. Thử lại nhé!`;
  } else if (result.topicCompleted && (result.unitCompleted || result.testOut)) {
    title = 'Hoàn thành toàn bộ lộ trình!';
    text = 'Bạn đã chinh phục mọi chặng của chủ đề này và giành Cúp Vàng Vinh Danh. Tuyệt vời!';
  } else if (result.testOut) {
    title = 'Vượt chặng thành công!';
    text = `Đã hoàn thành đến chặng “${result.unitTitle}”. Bạn được +${TEST_OUT_XP} XP.`;
  } else if (result.unitCompleted && (result.step === 'challenge' || result.step === 'checkpoint')) {
    title = `Hoàn thành chặng “${result.unitTitle}”!`;
    text = result.unlockedUnit ? `Đã mở khóa Chặng ${result.unlockedUnit.index}: ${result.unlockedUnit.title}` : 'Tiếp tục giữ phong độ nhé!';
  } else {
    title = `Qua bước ${result.stepLabel} (${result.scorePercent}%)`;
    text = result.next ? `Bước tiếp theo: ${result.next.stepLabel} · ${result.next.unitTitle}` : 'Tiếp tục giữ phong độ nhé!';
  }

  if (isGrandSuccess) {
    return (
      <section className="dp-slide-up relative flex items-center gap-4 overflow-hidden rounded-[24px] border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-amber-50 p-4 shadow-sm sm:p-5">
        <PathConfettiBurst count={24} spread={160} />
        <div className="dp-bounce relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-white shadow-[0_5px_0_#B45309] ring-2 ring-amber-200">
          <Trophy size={28} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
            <Award size={12} /> {result.topicCompleted ? 'Cúp Vàng Khóa Học' : 'Cúp Vượt Chặng'}
          </span>
          <p className="mt-1 text-base font-black text-slate-900">{title}</p>
          <p className="text-xs font-semibold text-slate-600">{text}</p>
        </div>
        <Mascot mood="graduate" size={64} className="hidden shrink-0 sm:block" />
      </section>
    );
  }

  return (
    <section className={`dp-slide-up flex items-center gap-3 rounded-[24px] p-4 ring-1 ${passed ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${passed ? 'bg-emerald-600' : 'bg-amber-500'}`}>
        {passed ? <Route size={24} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-black ${passed ? 'text-emerald-800' : 'text-amber-800'}`}>{title}</p>
        <p className="text-xs font-semibold text-slate-600">{text}</p>
      </div>
    </section>
  );
}
