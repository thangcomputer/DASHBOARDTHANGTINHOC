import { useEffect, useState } from 'react';
import { Flame, Lock, Medal, Sparkles, Trophy } from 'lucide-react';
import { apiFetch, resolveMediaUrl } from '../../services/api';

const SEEN_KEY = 'lms-progress-level-seen';
const PERIODS = [
  ['week', 'Tuần'],
  ['month', 'Tháng'],
  ['all', 'Tất cả'],
];

function formatWhen(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Thẻ cấp độ học bài. Lỗi API thì ẩn thẻ, không chặn Tổng quan. */
export default function LmsProgressCard() {
  const [data, setData] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [tab, setTab] = useState('history');
  const [board, setBoard] = useState(null);
  const [period, setPeriod] = useState('week');

  const load = (month) => {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return apiFetch(`/lms-progress/me${query}`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.success || !body.data) return;
        setData(body.data);
        const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
        if ((body.data.level || 1) > seen) setCelebrate(true);
      })
      .catch(() => { });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== 'rank') return undefined;
    let cancelled = false;
    apiFetch(`/lms-progress/leaderboard?period=${period}`)
      .then((res) => res.json())
      .then((body) => { if (!cancelled && body?.success) setBoard(body.data); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [tab, period]);

  if (!data) return null;

  const into = data.xpIntoLevel || 0;
  const need = data.xpForNextLevel || 0;
  const width = data.atMaxLevel || !need ? 100 : Math.min(100, Math.round((into / need) * 100));
  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, String(data.level || 1));
    setCelebrate(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {celebrate && data.level > 1 && (
        <button type="button" onClick={dismiss} className="mb-3 w-full rounded-xl bg-amber-50 px-3 py-2 text-left text-sm font-black text-amber-800 ring-1 ring-amber-200">
          Chúc mừng! Bạn lên Cấp {data.level}: {data.title}
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Học bài</p>
          <p className="mt-0.5 text-lg font-black text-slate-900">Cấp {data.level || 1}</p>
          <p className="text-xs font-semibold text-slate-500">{data.title}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700">
          <Flame size={14} aria-hidden="true" />
          {data.streak || 0} ngày
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Sparkles size={13} className="text-amber-500" aria-hidden="true" />
        {data.xpTotal || 0} XP học bài
        {data.atMaxLevel ? ' · đã đạt cấp cao nhất' : ` · ${into}/${need} tới ${data.nextTitle}`}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-black text-slate-500">
        {[
          ['history', 'Lịch sử'],
          ['badges', 'Huy hiệu'],
          ['rank', 'Hạng'],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg py-1.5 ${tab === id ? 'bg-white text-slate-900 shadow-sm' : ''}`}>{label}</button>
        ))}
      </div>
      {tab === 'history' && <HistoryList rows={data.history || []} />}
      {tab === 'badges' && <BadgeGrid badges={data.badges || []} />}
      {tab === 'rank' && <RankList board={board} period={period} onPeriod={setPeriod} />}
    </section>
  );
}

function HistoryList({ rows }) {
  if (!rows.length) return <p className="mt-3 text-xs font-semibold text-slate-400">Chưa có XP học bài.</p>;
  return (
    <ul className="mt-3 divide-y divide-slate-100">
      {rows.slice(0, 8).map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
          <span className="min-w-0 truncate font-semibold text-slate-700">{row.label}</span>
          <span className="shrink-0 font-black text-emerald-700">+{row.amount}</span>
          <span className="shrink-0 text-slate-400">{formatWhen(row.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function BadgeGrid({ badges }) {
  if (!badges.length) return <p className="mt-3 text-xs font-semibold text-slate-400">Chưa có huy hiệu.</p>;
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2">
      {badges.map((badge) => (
        <li key={badge.key} className={`rounded-xl px-2.5 py-2 ${badge.earned ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50 ring-1 ring-slate-100'}`}>
          <p className="flex items-center gap-1 text-xs font-black text-slate-800">
            {badge.earned ? <Medal size={13} className="text-amber-500" /> : <Lock size={13} className="text-slate-400" />}
            {badge.title}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{badge.description}</p>
        </li>
      ))}
    </ul>
  );
}

function RankList({ board, period, onPeriod }) {
  const top = board?.top || [];
  return (
    <div className="mt-3">
      <div className="mb-2 flex gap-1">
        {PERIODS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onPeriod(id)} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${period === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{label}</button>
        ))}
      </div>
      {!top.length ? <p className="text-xs font-semibold text-slate-400">Chưa có XP học bài trong kỳ này.</p> : (
        <ul className="space-y-1.5">
          {top.map((row) => (
            <li key={row.rank} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${row.isMe ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${row.rank <= 3 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-500'}`}>
                {row.rank === 1 ? <Trophy size={12} /> : row.rank}
              </span>
              {row.avatar ? <img src={resolveMediaUrl(row.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-[11px] font-black text-red-700">{String(row.name || '?').trim().slice(0, 1)}</span>}
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">{row.name}</span>
              <span className="shrink-0 text-[10px] font-semibold text-slate-400">Cấp {row.level}</span>
              <span className="shrink-0 text-xs font-black text-slate-700">{row.xp}</span>
            </li>
          ))}
        </ul>
      )}
      {board?.me && !top.some((row) => row.isMe) && (
        <p className="mt-2 text-[11px] font-semibold text-slate-500">Hạng của bạn: {board.me.rank} · {board.me.xp} XP</p>
      )}
    </div>
  );
}
