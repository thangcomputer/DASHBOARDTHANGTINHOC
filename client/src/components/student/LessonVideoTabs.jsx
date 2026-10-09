import { useNavigate } from 'react-router-dom';
import { BookOpen, PlayCircle } from 'lucide-react';

const TABS = [
  { key: 'lesson', label: 'Bài học', icon: BookOpen, to: '/student/lesson-practice' },
  { key: 'video', label: 'Video', icon: PlayCircle, to: '/student#materials-videos' },
];

export default function LessonVideoTabs({ active }) {
  const navigate = useNavigate();
  return (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => active !== t.key && navigate(t.to)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${active === t.key ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <t.icon size={15} /> {t.label}
        </button>
      ))}
    </div>
  );
}
