import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Crown, Trophy } from 'lucide-react';
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

function Avatar({ name, avatar, freePortal = false }) {
  const [failed, setFailed] = useState(false);
  const initial = String(name || '?').trim().split(/\s+/).pop()?.[0]?.toUpperCase() || '?';
  if (avatar && !failed) {
    return (
      <img
        src={resolveMediaUrl(avatar)}
        alt=""
        onError={() => setFailed(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white"
      />
    );
  }
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2 ring-white ${
        freePortal
          ? 'bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700'
          : 'bg-gradient-to-br from-red-50 to-amber-50 text-red-700'
      }`}
    >
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

  return (
    <section className="duo-card flex min-w-0 flex-col p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-sm">
          <Trophy size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-900">Bảng xếp hạng tuần</h3>
          <p className="truncate text-[11px] text-slate-500">
            {data
              ? `${formatWeekDay(data.weekStart)} – ${formatWeekDay(data.weekEnd)} · ${data.participants} ${freePortal ? 'học viên tham gia' : 'HV'}`
              : 'Đang tải…'}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">{error}</p>
      ) : null}

      <ol className="mt-2.5 space-y-1">
        {data && !top.length ? (
          <li className="rounded-xl bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500">
            Tuần này chưa có ai — hãy là người đầu tiên!
          </li>
        ) : null}
        {top.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 ${
              row.isMe
                ? (freePortal ? 'bg-emerald-50/90 ring-1 ring-emerald-200' : 'bg-red-50/90 ring-1 ring-red-100')
                : row.rank <= 3
                  ? 'bg-amber-50/30'
                  : ''
            }`}
          >
            <RankBadge rank={row.rank} />
            <Avatar name={row.name} avatar={row.avatar} freePortal={freePortal} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-slate-800">
                {row.name}
                {row.isMe ? (
                  <span
                    className={`ml-1.5 align-middle text-[9px] font-black uppercase tracking-wide ${
                      freePortal ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800' : 'text-red-600'
                    }`}
                  >
                    Bạn
                  </span>
                ) : null}
              </p>
              {freePortal && row.hoursPerDay ? (
                <p className="truncate text-[10px] font-semibold text-slate-500">
                  Mục tiêu {row.hoursPerDay} giờ / ngày
                </p>
              ) : null}
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
        ))}
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
              <span className={`text-base font-black tabular-nums ${freePortal ? 'text-emerald-600' : 'text-red-600'}`}>#{me.rank}</span>
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
