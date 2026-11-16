import { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, Crown, Gem, Medal, Shield, Trophy } from 'lucide-react';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { DAILY_PRACTICE_STATS_EVENT } from '../../services/dailyPracticeApi';
import { resolveMediaUrl } from '../../services/api';
import { LEARNING_GOAL_CHANGED_EVENT, formatStudyMinutes } from '../../utils/learningGoal';
import { useFreePortalMenu } from './dailyPractice/FreeFeatureLock';
import { isFreePortalAccount } from './dailyPractice/FreeMeetPlanModal';

const MEDALS = {
  1: 'from-amber-300 to-amber-500 text-amber-950',
  2: 'from-slate-200 to-slate-400 text-slate-800',
  3: 'from-orange-300 to-orange-600 text-orange-950',
};

const LEAGUE_TIERS = [
  { key: 'bronze', name: 'Đồng', Icon: Medal, iconClass: 'text-amber-700', minMinutes: 0, frame: 'ring-2 ring-amber-700/60', badge: 'bg-amber-100 text-amber-800' },
  { key: 'silver', name: 'Bạc', Icon: Medal, iconClass: 'text-slate-500', minMinutes: 60, frame: 'ring-2 ring-slate-400', badge: 'bg-slate-200 text-slate-700' },
  { key: 'gold', name: 'Vàng', Icon: Award, iconClass: 'text-amber-500', minMinutes: 120, frame: 'ring-2 ring-amber-400 shadow-xs', badge: 'bg-yellow-100 text-amber-800' },
  { key: 'platinum', name: 'Bạch Kim', Icon: Shield, iconClass: 'text-cyan-600', minMinutes: 210, frame: 'ring-2 ring-cyan-400 shadow-sm', badge: 'bg-cyan-100 text-cyan-800' },
  { key: 'diamond', name: 'Kim Cương', Icon: Gem, iconClass: 'text-fuchsia-600', minMinutes: 300, frame: 'ring-[3px] ring-fuchsia-400 shadow-md', badge: 'bg-fuchsia-100 text-fuchsia-800' },
];

function TierIcon({ tier, size = 11 }) {
  const Icon = tier?.Icon || Medal;
  return <Icon size={size} className={`shrink-0 ${tier?.iconClass || ''}`} aria-hidden="true" />;
}

function leagueForRow(row) {
  const mins = Number(row?.minutes) || 0;
  const days = Number(row?.goalDays) || 0;
  if (row?.rank === 1 && mins >= 60) return LEAGUE_TIERS[4];
  if (mins >= 300 || days >= 6) return LEAGUE_TIERS[4];
  if (mins >= 210 || days >= 5) return LEAGUE_TIERS[3];
  if (mins >= 120 || days >= 3) return LEAGUE_TIERS[2];
  if (mins >= 60 || days >= 2) return LEAGUE_TIERS[1];
  return LEAGUE_TIERS[0];
}

function formatWeekDay(key) {
  const [, month, day] = String(key || '').split('-');
  return day && month ? `${day}/${month}` : '';
}

function RankBadge({ rank }) {
  if (MEDALS[rank]) {
    return (
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b text-[11px] font-black shadow-sm ${MEDALS[rank]}`}
      >
        {rank === 1 ? <Crown size={13} aria-hidden="true" /> : rank}
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-500">
      {rank}
    </span>
  );
}

function Avatar({ name, avatar, freePortal: _freePortal = false, frameClass = 'ring-2 ring-white' }) {
  const [failed, setFailed] = useState(false);
  const initial = String(name || '?').trim().split(/\s+/).pop()?.[0]?.toUpperCase() || '?';
  if (avatar && !failed) {
    return (
      <img
        src={resolveMediaUrl(avatar)}
        alt=""
        onError={() => setFailed(true)}
        className={`h-8 w-8 shrink-0 rounded-full object-cover ${frameClass}`}
      />
    );
  }
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700 ${frameClass}`}>
      {initial}
    </span>
  );
}

function gapMessage(me) {
  if (!me?.rank) return '';
  if (me.rank === 1) return 'Bạn đang dẫn đầu — giữ phong độ nhé!';
  const ahead = me.ahead;
  if (!ahead) return '';
  if (ahead.goalDays > me.goalDays) {
    return `Đạt thêm ${ahead.goalDays - me.goalDays} ngày mục tiêu để vượt #${ahead.rank}.`;
  }
  return `Học thêm ${formatStudyMinutes(ahead.minutes - me.minutes + 1)} để vượt #${ahead.rank}.`;
}

/** Bảng xếp hạng tuần: HV đạt mục tiêu nhiều ngày nhất (bằng nhau so phút học), toàn trung tâm. */
export default function LearningLeaderboardCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const freeMenu = useFreePortalMenu();
  const freePortal = freeMenu || isFreePortalAccount();

  const load = useCallback(() => {
    lessonPracticeApi.student.learningLeaderboard()
      .then((res) => { setData(res?.data || null); setError(''); })
      .catch((err) => setError(err.message || 'Không tải được bảng xếp hạng'));
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const me = data?.me;
  const top = data?.top || [];
  const meInTop = top.some((row) => row.isMe);
  const myLeague = leagueForRow(me);
  const nextTierIdx = Math.min(LEAGUE_TIERS.length - 1, LEAGUE_TIERS.findIndex((t) => t.key === myLeague.key) + 1);
  const nextLeague = LEAGUE_TIERS[nextTierIdx];

  return (
    <section className="duo-card flex min-w-0 flex-col p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-sm">
          <Trophy size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">Bảng xếp hạng tuần</h3>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${myLeague.badge}`}>
              <TierIcon tier={myLeague} size={13} />
              <span>{myLeague.name}</span>
            </span>
          </div>
          <p className="truncate text-[11px] text-slate-500">
            {data
              ? `${formatWeekDay(data.weekStart)} – ${formatWeekDay(data.weekEnd)} · ${data.participants} ${freePortal ? 'học viên tham gia' : 'HV'}`
              : 'Đang tải…'}
          </p>
        </div>
      </div>

      {me && myLeague.key !== 'diamond' && (
        <div className="mt-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0">Hạng tuần:</span>
            <span className="flex items-center gap-1">
              {LEAGUE_TIERS.map((t, idx) => (
                <span key={t.key} className="inline-flex items-center gap-1" title={t.name}>
                  <TierIcon tier={t} size={14} />
                  {idx < LEAGUE_TIERS.length - 1 && (
                    <ChevronRight size={12} className="text-slate-400" aria-hidden="true" />
                  )}
                </span>
              ))}
            </span>
          </div>
          <span className="text-emerald-700 font-bold shrink-0">
            Lên {nextLeague.name}: {Math.max(0, nextLeague.minMinutes - (Number(me.minutes) || 0))}p
          </span>
        </div>
      )}

      {error ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">{error}</p>
      ) : null}

      <ol className="mt-2.5 space-y-1">
        {data && !top.length ? (
          <li className="rounded-xl bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500">
            Tuần này chưa có ai — hãy là người đầu tiên!
          </li>
        ) : null}
        {top.map((row) => {
          const tier = leagueForRow(row);
          return (
          <li
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 ${
              row.isMe
                ? 'bg-emerald-50/90 ring-1 ring-emerald-200'
                : row.rank <= 3
                  ? 'bg-amber-50/30'
                  : ''
            }`}
          >
            <RankBadge rank={row.rank} />
            <Avatar name={row.name} avatar={row.avatar} freePortal={freePortal} frameClass={tier.frame} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-slate-800">
                {row.name}
                {row.isMe ? (
                  <span className="ml-1.5 align-middle text-[9px] font-black uppercase tracking-wide rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                    Bạn
                  </span>
                ) : null}
              </p>
              <p className="flex items-center gap-1 truncate text-[10px] font-semibold text-slate-500">
                <TierIcon tier={tier} size={13} />
                <span>Hạng {tier.name}{freePortal && row.hoursPerDay ? ` · Mục tiêu ${row.hoursPerDay}g/ngày` : ''}</span>
              </p>
            </div>
            <div className="shrink-0 text-right leading-tight">
              <p className="flex items-center justify-end gap-0.5 text-[11px] font-black text-emerald-600">
                <CheckCircle2 size={11} aria-hidden="true" />
                {row.goalDays}/{data.daysSoFar}{freePortal ? ' ngày' : ''}
              </p>
              <p className="text-[10px] font-semibold text-slate-500">
                {formatStudyMinutes(row.minutes)}
                {(freePortal ? row.xp > 0 : row.rank === 1 && row.xp > 0) ? ` · ${row.xp} XP` : null}
              </p>
            </div>
          </li>
          );
        })}
      </ol>

      {data && me ? (
        <footer className="mt-2 border-t border-slate-100 pt-2">
          {!me.hasGoal ? (
            <p className="text-[11px] text-slate-500">Đặt mục tiêu ở tab Mục tiêu để lên bảng.</p>
          ) : !me.rank ? (
            <p className="text-[11px] text-slate-500">Chưa có phút học tuần này — vào bài học để lên bảng.</p>
          ) : meInTop ? (
            gapMessage(me) ? (
              <p className="text-[11px] leading-snug text-slate-500">{gapMessage(me)}</p>
            ) : null
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
              <span className="text-base font-black tabular-nums text-emerald-600">#{me.rank}</span>
              <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-600">
                <span className="font-bold text-slate-800">
                  {me.goalDays} ngày đạt · {formatStudyMinutes(me.minutes)}
                </span>
                {gapMessage(me) ? ` — ${gapMessage(me)}` : null}
              </p>
            </div>
          )}
        </footer>
      ) : null}
    </section>
  );
}
