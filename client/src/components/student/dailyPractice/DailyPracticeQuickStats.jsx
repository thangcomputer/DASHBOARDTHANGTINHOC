import { BookOpen, Flame, Route, Trophy } from 'lucide-react';

/** Bốn thẻ tóm tắt - dùng overview + lộ trình chủ đề đang chọn (không dữ liệu giả). */
export default function DailyPracticeQuickStats({ stats, pathTopic, freeTopicName, mode }) {
  const subject = mode === 'path'
    ? (pathTopic?.topic?.name || '-')
    : (freeTopicName || 'Chưa chọn');
  const stageLine = pathTopic?.totalUnits
    ? `${pathTopic.completedUnits}/${pathTopic.totalUnits} chặng`
    : '-';

  const cards = [
    { icon: BookOpen, label: 'Môn / chủ đề', value: subject, tone: 'text-sky-700 bg-sky-50' },
    { icon: Route, label: 'Tiến độ lộ trình', value: stageLine, tone: 'text-violet-700 bg-violet-50' },
    { icon: Flame, label: 'Chuỗi hiện tại', value: `${stats?.streak || 0} ngày`, tone: 'text-orange-700 bg-orange-50' },
    { icon: Trophy, label: 'XP luyện', value: `${stats?.xpTotal || 0} XP`, tone: 'text-red-700 bg-red-50' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">{label}</p>
            <p className="truncate text-sm font-black text-slate-900" title={String(value)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
