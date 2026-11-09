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
export default function LmsGoalMergedCard() {
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* ══ LEVEL UP BANNER ══ */}
      {celebrate && lms?.level > 1 && (
        <button
          onClick={() => { localStorage.setItem(SEEN_KEY, String(lms.level)); setCelebrate(false); }}
          className="flex w-full items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-left text-sm font-black text-amber-800 hover:bg-amber-100 transition"
        >
          <span>🎉</span>
          <span>Chúc mừng! Bạn lên Cấp {lms.level}: {lms.title}</span>
          <span className="ml-auto text-xs font-semibold text-amber-600">Nhấn để đóng</span>
        </button>
      )}

      {/* ══ NỘI DUNG THẺ GỘP ══ */}
      <div className="p-4 space-y-3">
        {/* Row: label + streak */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Học bài</p>
            <p className="text-xl font-black text-slate-900 leading-tight">Cấp {lms?.level || 1}</p>
            <p className="text-xs font-semibold text-slate-500">{lms?.title}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">
            <Flame size={13} />
            {lms?.streak || 0} ngày
          </div>
        </div>

        {/* XP bar */}
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${lmsW}%` }} />
          </div>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Sparkles size={11} className="text-amber-400" />
            {lms?.xpTotal || 0} XP học bài
            {lms?.atMaxLevel ? ' · đạt cấp cao nhất' : ` · ${lmsInto}/${lmsNeed} tới ${lms?.nextTitle}`}
          </p>
        </div>

        {/* Pill tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${tab === id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pt-1">
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
}) {
  if (!goal) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3">
        <Target size={20} className="shrink-0 text-red-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900">Chưa đặt mục tiêu học</p>
          <p className="text-xs text-slate-500">Đặt mục tiêu để theo dõi số giờ học mỗi ngày.</p>
        </div>
        <button
          type="button"
          onClick={openLearningGoal}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition"
        >
          Đặt ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <Target size={18} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900">Mục tiêu: {goal.hoursPerDay} giờ/ngày</p>
          <p className="text-xs font-semibold text-slate-400">
            {goal.expired ? 'Đã kết thúc' : `${periodLabel(goal.period)} · Còn ${p.daysLeft} ngày`}
          </p>
        </div>
        <button
          type="button"
          onClick={openLearningGoal}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          {goal.expired ? 'Đặt mới' : 'Đổi'}
        </button>
      </div>

      {/* Hôm nay */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-bold text-slate-700">
            <Flame size={13} className={todayDone ? 'text-emerald-500' : 'text-orange-400'} />
            Hôm nay
          </span>
          <span className="font-black text-slate-900">
            {formatStudyMinutes(p.todayMinutes)} / {goal.hoursPerDay} giờ
            <span className={`ml-1 font-semibold ${todayDone ? 'text-emerald-600' : 'text-slate-400'}`}>({todayPct}%)</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${todayDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-red-500'}`}
            style={{ width: `${todayPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Cả kỳ: {formatStudyMinutes(p.periodMinutes)} ({periodPct}%)</span>
          {todayDone && <span className="font-bold text-emerald-600">✓ Đã đạt hôm nay</span>}
        </div>
      </div>

      {/* Nhiệm vụ hôm nay */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-800">Nhiệm vụ hôm nay</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {doneMissions}/2 xong
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Luyện tập */}
          <button
            type="button"
            onClick={() => navigate('/student/daily-practice')}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition active:scale-98 ${qDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${qDone ? 'bg-emerald-500' : 'bg-sky-100'}`}>
              {qDone ? <Check size={14} className="text-white" strokeWidth={3} /> : <Gamepad2 size={14} className="text-sky-600" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900">Luyện tập</p>
              <p className={`text-[11px] font-semibold ${qDone ? 'text-emerald-700' : 'text-slate-500'}`}>
                {p.todayQuestions || 0}/{MISSION_QUESTIONS} câu
              </p>
            </div>
          </button>
          {/* Xem video */}
          <button
            type="button"
            onClick={openVideo}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition active:scale-98 ${vDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${vDone ? 'bg-emerald-500' : 'bg-purple-100'}`}>
              {vDone ? <Check size={14} className="text-white" strokeWidth={3} /> : <PlayCircle size={14} className="text-purple-600" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900">Xem video</p>
              <p className={`text-[11px] font-semibold ${vDone ? 'text-emerald-700' : 'text-slate-500'}`}>
                {p.todayVideos || 0}/{MISSION_VIDEOS} video
              </p>
            </div>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-tight">
        * Giờ học tính khi bạn làm bài, ôn thi hoặc xem video.
      </p>
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
      <div className="flex gap-1">
        {PERIODS.map(([id, label]) => (
          <button key={id} onClick={() => onPeriod(id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${period === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>
      {!top.length
        ? <p className="py-2 text-xs text-slate-400">Chưa có XP học bài trong kỳ này.</p>
        : (
          <ul className="space-y-1">
            {top.map(row => (
              <li key={row.rank} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${row.isMe ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${row.rank <= 3 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-500'}`}>
                  {row.rank === 1 ? <Trophy size={11} /> : row.rank}
                </span>
                {row.avatar
                  ? <img src={resolveMediaUrl(row.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                  : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-[11px] font-black text-red-700">{String(row.name || '?').trim()[0]}</span>
                }
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-slate-800">{row.name}</span>
                <span className="text-[10px] text-slate-400">Cấp {row.level}</span>
                <span className="text-xs font-black text-slate-700">{row.xp}</span>
              </li>
            ))}
          </ul>
        )
      }
      {board?.me && !top.some(r => r.isMe) && (
        <p className="text-[11px] text-slate-400">Hạng của bạn: {board.me.rank} · {board.me.xp} XP</p>
      )}
    </div>
  );
}
