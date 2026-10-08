import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Monitor, FileText, Table2, Presentation } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';

const ICONS = {
  'su-dung-may-tinh': Monitor,
  word: FileText,
  excel: Table2,
  powerpoint: Presentation,
};

export default function LessonPracticeCatalogPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    lessonPracticeApi.student.subjects()
      .then((res) => { if (alive) setSubjects(res.data || []); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách môn'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-widest text-red-600">Học tập</p>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Bài học</h1>
          <p className="text-sm text-slate-500 mt-1">Chọn môn, vào từng buổi và xác nhận từng câu để xem giải thích ngay.</p>
        </div>
        {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải môn học...</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && subjects.length === 0 && (
          <p className="text-sm text-slate-500">Chưa có môn học. Giáo vụ sẽ mở bài sau.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {subjects.map((subject) => {
            const Icon = ICONS[subject.slug] || BookOpen;
            const total = subject.totalUnitCount || 0;
            const done = subject.completedUnitCount || 0;
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => navigate(`/student/lesson-practice/subjects/${subject.id}`)}
                className="text-left bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-red-200 hover:shadow-md transition-all"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Icon size={20} />
                </span>
                <h2 className="mt-4 text-lg font-black text-slate-900">{subject.name}</h2>
                <p className="mt-1 text-sm text-slate-500 min-h-10">{subject.summary || 'Các buổi thực hành'}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                  {done}/{total} buổi đã xong
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
