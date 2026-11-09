import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Crown, Target, Trophy } from 'lucide-react';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../services/api';
import { LEARNING_GOAL_CHANGED_EVENT, formatStudyMinutes } from '../../utils/learningGoal';

const MEDALS = {
  1: 'from-amber-300 to-amber-500 text-amber-950 shadow-[0_4px_10px_rgba(245,158,11,0.35),inset_0_1px_2px_rgba(255,255,255,0.6)]',
  2: 'from-slate-200 to-slate-400 text-slate-800 shadow-[0_4px_10px_rgba(100,116,139,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)]',
  3: 'from-orange-300 to-orange-600 text-orange-950 shadow-[0_4px_10px_rgba(234,88,12,0.3),inset_0_1px_2px_rgba(255,255,255,0.5)]',
};

function formatWeekDay(key) {
  const [, month, day] = String(key || '').split('-');
  return day && month ? `${day}/${month}` : '';
}

function RankBadge({ rank }) {
  if (MEDALS[rank]) {
    return (
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b text-xs font-black ${MEDALS[rank]}`}>
        {rank === 1 ? <Crown size={14} aria-label="Hạng 1" /> : rank}
      </span>
    );
  }
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">{rank}</span>;
}

function Avatar({ name, avatar }) {
  const [failed, setFailed] = useState(false);
  const initial = String(name || '?').trim().split(/\s+/).pop()?.[0]?.toUpperCase() || '?';
  if (avatar && !failed) {
    return <img src={resolveMediaUrl(avatar)} alt="" onError={() => setFailed(true)} className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white" />;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-amber-100 text-sm font-black text-red-700 ring-2 ring-white">
      {initial}
    </span>
  );
}

function gapMessage(me) {
  if (!me?.rank) return '';
  if (me.rank === 1) return 'Bạn đang dẫn đầu bảng. Giữ vững phong độ nhé!';
  const ahead = me.ahead;
  if (!ahead) return '';
  if (ahead.goalDays > me.goalDays) {
    const days = ahead.goalDays - me.goalDays;
    return `Đạt thêm ${days} ngày mục tiêu để vượt hạng #${ahead.rank}.`;
  }
  return `Học thêm ${formatStudyMinutes(ahead.minutes - me.minutes + 1)} để vượt hạng #${ahead.rank}.`;
}

/** Bảng xếp hạng tuần: HV đạt mục tiêu nhiều ngày nhất (bằng nhau so phút học), toàn trung tâm. */
export default function LearningLeaderboardCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    lessonPracticeApi.student.learningLeaderboard()
      .then((res) => { setData(res?.data || null); setError(''); })
      .catch((err) => setError(err.message || 'Không tải được bảng xếp hạng'));
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const me = data?.me;
  const top = data?.top || [];
  const meInTop = top.some((row) => row.isMe);

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-[0_6px_14px_rgba(217,119,6,0.3),inset_0_2px_3px_rgba(255,255,255,0.4)]">
            <Trophy size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">Bảng xếp hạng tuần</p>
            <p className="text-xs text-slate-500">
              {data ? `${formatWeekDay(data.weekStart)} – ${formatWeekDay(data.weekEnd)} · ${data.participants} học viên tham gia` : 'Đang tải…'}
            </p>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{error}</p>}

      <ol className="mt-3 flex-1 space-y-1.5">
        {data && !top.length && (
          <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
            Tuần này chưa có ai trên bảng - hãy là người đầu tiên!
          </li>
        )}
        {top.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${row.isMe ? 'bg-red-50 ring-1 ring-red-100' : row.rank <= 3 ? 'bg-amber-50/40' : ''}`}
          >
            <RankBadge rank={row.rank} />
            <Avatar name={row.name} avatar={row.avatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {row.name}
                {row.isMe && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-px text-[10px] font-black text-white">Bạn</span>}
              </p>
              <p className="text-[11px] text-slate-400">Mục tiêu {row.hoursPerDay} giờ/ngày</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="flex items-center justify-end gap-1 text-xs font-black text-emerald-600">
                <CheckCircle2 size={12} aria-hidden="true" /> {row.goalDays}/{data.daysSoFar} ngày
              </p>
              <p className="text-[11px] font-semibold text-slate-500">
                {formatStudyMinutes(row.minutes)}
                {row.xp > 0 && <span className="ml-1 font-black text-amber-600">· {row.xp} XP</span>}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {data && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {!me?.hasGoal ? (
            <p className="text-xs text-slate-500">Đặt mục tiêu ở thẻ Mục tiêu học để có tên trên bảng xếp hạng.</p>
          ) : !me.rank ? (
            <p className="text-xs text-slate-500">Tuần này bạn chưa học phút nào. Vào bài học ngay để lên bảng!</p>
          ) : (
            <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${meInTop ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <span className={`text-lg font-black tabular-nums ${meInTop ? 'text-emerald-700' : 'text-red-700'}`}>#{me.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">
                  Bạn đang hạng {me.rank}/{data.participants} · {me.goalDays} ngày đạt · {formatStudyMinutes(me.minutes)}
                  {me.xp > 0 && ` · ${me.xp} XP`}
                </p>
                <p className="text-[11px] text-slate-500">{gapMessage(me)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
