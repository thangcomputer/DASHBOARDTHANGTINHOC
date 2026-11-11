import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Crown, Flame, Gamepad2,
  Lock, Medal, PlayCircle, Sparkles, Target, Trophy,
} from 'lucide-react';
import { apiFetch, resolveMediaUrl } from '../../services/api';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { useStudentSubscription } from './subscription/subscriptionContext';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  STUDY_MINUTE_EVENT,
  formatStudyMinutes,
  lessonResumeUrl,
  openLearningGoal,
  periodLabel,
} from '../../utils/learningGoal';
import { lmsBtn } from '../../utils/lmsButtonClass';

/* ─── constants ──────────────────────────────────────────── */
const SEEN_KEY = 'lms-progress-level-seen';
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const PERIODS = [['week', 'Tuần'], ['month', 'Tháng'], ['all', 'Tất cả']];
const MISSION_QUESTIONS = 10;
const MISSION_VIDEOS = 1;

function formatWhen(v) {
  if (!v) return '';
  return new Date(v).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
function shiftMonth(month, delta) {
  const [y, m] = String(month || '').split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function pct(v, t) { return !t ? 0 : Math.min(100, Math.round(((v || 0) / t) * 100)); }

/* ─── main component ─────────────────────────────────────── */
export default function LmsGoalMergedCard({ hideMissions = false, compact = false } = {}) {
  const navigate = useNavigate();
  const subCtx = useStudentSubscription();

  /* LMS */
  const [lms, setLms] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [tab, setTab] = useState('goal');
  const [board, setBoard] = useState(null);
  const [period, setPeriod] = useState('week');

  const loadLms = (month) => {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    apiFetch(`/lms-progress/me${q}`).then(r => r.json()).then(body => {
      if (!body?.success || !body.data) return;
      setLms(body.data);
      if ((body.data.level || 1) > Number(localStorage.getItem(SEEN_KEY) || 0)) setCelebrate(true);
    }).catch(() => { });
  };
  useEffect(() => { loadLms(); }, []);
  useEffect(() => {
    if (tab !== 'rank') return;
    let c = false;
    apiFetch(`/lms-progress/leaderboard?period=${period}`).then(r => r.json())
      .then(body => { if (!c && body?.success) setBoard(body.data); }).catch(() => { });
    return () => { c = true; };
  }, [tab, period]);

  /* Goal */
  const [gd, setGd] = useState(null);
  const openVideo = () => {
    lessonPracticeApi.student.resumePoint()
      .then(res => navigate(res?.data?.unitId ? lessonResumeUrl(res.data) : '/student/lesson-practice'))
      .catch(() => navigate('/student/lesson-practice'));
  };
  const loadGoal = useCallback(() => {
    lessonPracticeApi.student.learningGoal().then(r => setGd(r?.data || null)).catch(() => { });
  }, []);
  useEffect(() => {
    loadGoal();
    const oc = e => { if (e.detail) setGd(e.detail); else loadGoal(); };
    const om = e => {
      const mins = e.detail?.todayMinutes;
      if (typeof mins !== 'number') return;
      setGd(p => p?.progress ? {
        ...p, progress: { ...p.progress, todayMinutes: mins, periodMinutes: (p.progress.periodMinutes || 0) + Math.max(0, mins - (p.progress.todayMinutes || 0)) },
      } : p);
    };
    const ov = () => { if (document.visibilityState === 'visible') loadGoal(); };
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, oc);
    window.addEventListener(STUDY_MINUTE_EVENT, om);
    document.addEventListener('visibilitychange', ov);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, oc);
      window.removeEventListener(STUDY_MINUTE_EVENT, om);
      document.removeEventListener('visibilitychange', ov);
    };
  }, [loadGoal]);

  if (!lms && !gd) return null;

  /* computed */
  const lmsInto = lms?.xpIntoLevel || 0;
  const lmsNeed = lms?.xpForNextLevel || 0;
  const lmsW = lms ? (lms.atMaxLevel || !lmsNeed ? 100 : Math.min(100, Math.round((lmsInto / lmsNeed) * 100))) : 0;

  const { goal, progress: p = {} } = gd || {};
  const todayPct = pct(p.todayMinutes, p.dailyTargetMinutes);
  const periodPct = pct(p.periodMinutes, p.periodTargetMinutes);
  const todayDone = todayPct >= 100;
  const qDone = (p.todayQuestions || 0) >= MISSION_QUESTIONS;
  const vDone = (p.todayVideos || 0) >= MISSION_VIDEOS;
  const doneMissions = [qDone, vDone].filter(Boolean).length;

  const TABS = [
    ['goal', 'Mục tiêu'],
    ['badges', 'Huy hiệu'],
    ['rank', 'Hạng'],
    ['history', 'Lịch sử'],
  ];

  const xpLine = lms?.atMaxLevel
    ? `${lms?.xpTotal || 0} XP · cấp tối đa`
    : `${lms?.xpTotal || 0} XP · ${lmsInto}/${lmsNeed} tới ${lms?.nextTitle || 'cấp sau'}`;

  return (
    <div className="duo-card overflow-hidden">

      {celebrate && lms?.level > 1 && (
        <button
          type="button"
          onClick={() => { localStorage.setItem(SEEN_KEY, String(lms.level)); setCelebrate(false); }}
          className="flex w-full items-center gap-2 border-b border-amber-100/80 bg-amber-50/90 px-3 py-2 text-left text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
        >
          <span aria-hidden="true">🎉</span>
          <span className="min-w-0 flex-1 truncate">Lên cấp {lms.level}: {lms.title}</span>
          <span className="shrink-0 text-[10px] font-semibold text-amber-600">Đóng</span>
        </button>
      )}

      <div className={compact ? 'space-y-2.5 p-3.5' : 'space-y-3 p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Học bài</p>
            <p className="truncate text-base font-black leading-tight text-slate-900">
              Cấp {lms?.level || 1}
              {lms?.title ? <span className="font-semibold text-slate-500"> · {lms.title}</span> : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
            <Flame size={12} aria-hidden="true" />
            {lms?.streak || 0}
          </div>
        </div>

        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${lmsW}%` }} />
          </div>
          <p className="flex items-center gap-1 truncate text-[10px] font-medium text-slate-500" title={xpLine}>
            <Sparkles size={10} className="shrink-0 text-amber-400" aria-hidden="true" />
            <span className="truncate">{xpLine}</span>
          </p>
        </div>

        <div
          className={`grid grid-cols-4 gap-0.5 rounded-xl bg-slate-100 p-0.5 ${compact ? '' : 'pt-0.5'}`}
          role="tablist"
          aria-label="Mục tiêu học bài"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-[10px] px-1.5 py-1.5 text-[11px] font-extrabold transition ${tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pt-0.5">
          {tab === 'goal' && (
            <GoalContent
              goal={goal}
              p={p}
              todayPct={todayPct}
              periodPct={periodPct}
              todayDone={todayDone}
              qDone={qDone}
              vDone={vDone}
              doneMissions={doneMissions}
              navigate={navigate}
              openVideo={openVideo}
              hideMissions={hideMissions}
              compact={compact}
            />
          )}
          {tab === 'history' && <HistoryList rows={lms?.history || []} subHistory={subCtx?.overview?.history || []} />}
          {tab === 'badges' && <BadgeGrid badges={lms?.badges || []} />}
          {tab === 'rank' && <RankList board={board} period={period} onPeriod={setPeriod} />}
        </div>
      </div>
    </div>
  );
}

function GoalContent({
  goal,
  p,
  todayPct,
  periodPct,
  todayDone,
  qDone,
  vDone,
  doneMissions,
  navigate,
  openVideo,
  hideMissions,
  compact,
}) {
  if (!goal) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-red-200 bg-red-50/60 p-2.5">
        <Target size={18} className="shrink-0 text-red-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-900">Chưa đặt mục tiêu học</p>
          <p className="text-[11px] text-slate-500">Theo dõi giờ học mỗi ngày.</p>
        </div>
        <button
          type="button"
          onClick={openLearningGoal}
          className={lmsBtn('danger', { size: 'sm', className: 'shrink-0 !text-[11px]' })}
        >
          Đặt ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-sm font-black text-slate-900">
          Mục tiêu {goal.hoursPerDay} giờ/ngày
        </p>
        <button
          type="button"
          onClick={openLearningGoal}
          className="shrink-0 rounded-[10px] border-[1.5px] border-[#FECACA] border-b-4 border-b-[#F87171] bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#DC2626] hover:bg-[#FEF2F2] active:translate-y-[2px] active:border-b-[1.5px] transition-all cursor-pointer !shadow-none"
        >
          {goal.expired ? 'Đặt mới' : 'Đổi mục tiêu'}
        </button>
        <p className="w-full text-[11px] font-medium text-slate-400">
          {goal.expired ? 'Đã kết thúc' : `${periodLabel(goal.period)} · còn ${p.daysLeft} ngày`}
        </p>
      </div>

      <div
        className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5"
        title="Giờ học tính khi làm bài, ôn thi hoặc xem video"
      >
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black tabular-nums leading-none ${todayDone ? 'text-emerald-600' : 'text-slate-900'}`}>
              {todayPct}%
            </span>
            {todayDone ? (
              <span className="text-[10px] font-bold text-emerald-600">Đạt hôm nay</span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-orange-500">
                <Flame size={11} aria-hidden="true" /> Hôm nay
              </span>
            )}
          </div>
          <span className="text-right text-[11px] font-bold text-slate-600">
            {formatStudyMinutes(p.todayMinutes)}
            <span className="font-semibold text-slate-400"> / {goal.hoursPerDay}h</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
          <div
            className={`h-full rounded-full transition-all duration-500 ${todayDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
            style={{ width: `${todayPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
          Cả kỳ {formatStudyMinutes(p.periodMinutes)} · {periodPct}%
        </p>
      </div>

      {hideMissions ? (
        <p className="text-[10px] text-slate-400">
          Tiến độ mục tiêu: luyện {Math.min(p.todayQuestions || 0, MISSION_QUESTIONS)}/{MISSION_QUESTIONS} câu
          {' · '}
          video {Math.min(p.todayVideos || 0, MISSION_VIDEOS)}/{MISSION_VIDEOS}
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] font-extrabold text-slate-700">
            Nhiệm vụ <span className="font-bold text-slate-400">({doneMissions}/2)</span>
          </p>
          <div className={`grid gap-1.5 ${compact ? 'grid-cols-2' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => navigate('/student/daily-practice')}
              className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${qDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${qDone ? 'bg-emerald-500' : 'bg-sky-50'}`}>
                {qDone ? <Check size={12} className="text-white" strokeWidth={3} /> : <Gamepad2 size={12} className="text-sky-600" />}
              </span>
              <span className="min-w-0 text-[11px] font-bold text-slate-800">
                {p.todayQuestions || 0}/{MISSION_QUESTIONS} câu
              </span>
            </button>
            <button
              type="button"
              onClick={openVideo}
              className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${vDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${vDone ? 'bg-emerald-500' : 'bg-violet-50'}`}>
                {vDone ? <Check size={12} className="text-white" strokeWidth={3} /> : <PlayCircle size={12} className="text-violet-600" />}
              </span>
              <span className="min-w-0 text-[11px] font-bold text-slate-800">
                {p.todayVideos || 0}/{MISSION_VIDEOS} video
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */
function formatVndCompact(n) {
  if (!n) return '';
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function HistoryList({ rows, subHistory = [] }) {
  // Merge XP rows + subscription purchases into one timeline
  const merged = [];
  for (const r of rows) {
    merged.push({ kind: 'xp', id: r.id, label: r.label, amount: r.amount, at: r.at });
  }
  for (const h of subHistory) {
    merged.push({
      kind: 'sub',
      id: h.id || `sub-${h.createdAt}`,
      label: `Mua gói ${h.planLabel || h.plan || ''}`.trim(),
      amount: h.amount || 0,
      at: h.createdAt,
    });
  }
  // Sort newest first
  merged.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  if (!merged.length) return <p className="py-3 text-center text-xs text-slate-400">Chưa có lịch sử.</p>;
  return (
    <ul className="divide-y divide-slate-50">
      {merged.slice(0, 10).map(r => (
        <li key={r.id} className="flex items-center gap-2 py-1.5 text-xs">
          {r.kind === 'sub' && <Crown size={12} className="shrink-0 text-amber-500" />}
          <span className="flex-1 truncate font-semibold text-slate-700">{r.label}</span>
          {r.kind === 'xp' ? (
            <span className="shrink-0 font-black text-emerald-700">+{r.amount}</span>
          ) : (
            <span className="shrink-0 font-bold text-amber-600">{r.amount ? formatVndCompact(r.amount) : ''}</span>
          )}
          <span className="shrink-0 text-slate-400">{formatWhen(r.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function StudyCalendar({ calendar, streak, best, onMonth }) {
  if (!calendar) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-black text-slate-600">
        <button onClick={() => onMonth(shiftMonth(calendar.month, -1))} className="rounded-lg px-2 py-1 hover:bg-slate-100">← Trước</button>
        <span>{calendar.month}</span>
        <button onClick={() => onMonth(shiftMonth(calendar.month, 1))} className="rounded-lg px-2 py-1 hover:bg-slate-100">Sau →</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400">
        {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
        {(calendar.days || []).map((cell, i) => (
          <span key={cell?.key || `p${i}`}
            className={`flex h-7 items-center justify-center rounded-full text-[11px] ${cell?.studied ? 'bg-orange-500 font-black text-white'
                : cell?.today ? 'bg-orange-100 font-bold text-orange-700'
                  : 'text-slate-500'
              }`}>
            {cell?.day || ''}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        {calendar.studiedCount || 0} ngày có học tháng này · Chuỗi {streak} ngày · Kỷ lục {best} ngày
      </p>
    </div>
  );
}

function BadgeGrid({ badges }) {
  if (!badges.length) return <p className="py-3 text-center text-xs text-slate-400">Chưa có huy hiệu.</p>;
  return (
    <ul className="grid grid-cols-2 gap-2">
      {badges.map(b => (
        <li key={b.key} className={`rounded-xl px-2.5 py-2 ${b.earned ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50 ring-1 ring-slate-100'}`}>
          <p className="flex items-center gap-1 text-xs font-black text-slate-800">
            {b.earned ? <Medal size={12} className="text-amber-500" /> : <Lock size={12} className="text-slate-400" />}
            {b.title}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{b.description}</p>
        </li>
      ))}
    </ul>
  );
}

function RankList({ board, period, onPeriod }) {
  const top = board?.top || [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-100 p-0.5">
        {PERIODS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onPeriod(id)}
            className={`rounded-md py-1 text-[10px] font-extrabold ${period === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!top.length ? (
        <p className="py-2 text-center text-[11px] text-slate-400">Chưa có XP trong kỳ này.</p>
      ) : (
        <ul className="space-y-0.5">
          {top.map((row) => (
            <li
              key={row.rank}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${row.isMe ? 'bg-emerald-50 ring-1 ring-emerald-100' : ''}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${row.rank <= 3 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-500'}`}>
                {row.rank === 1 ? <Trophy size={10} aria-hidden="true" /> : row.rank}
              </span>
              {row.avatar ? (
                <img src={resolveMediaUrl(row.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-[10px] font-black text-red-700">
                  {String(row.name || '?').trim()[0]}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">{row.name}</span>
              <span className="shrink-0 text-[11px] font-black text-slate-700">{row.xp} XP</span>
            </li>
          ))}
        </ul>
      )}
      {board?.me && !top.some((r) => r.isMe) && (
        <p className="text-[10px] text-slate-400">Bạn: hạng {board.me.rank} · {board.me.xp} XP</p>
      )}
    </div>
  );
}
