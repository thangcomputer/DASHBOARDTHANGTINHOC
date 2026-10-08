import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Lock, PlayCircle } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';

export default function LessonPracticeUnitsPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    lessonPracticeApi.student.units(subjectId)
      .then((res) => { if (alive) setPayload(res.data); })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách buổi'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subjectId]);

  const subject = payload?.subject;
  const units = payload?.units || [];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <button type="button" onClick={() => navigate('/student/lesson-practice')} className="inline-flex items-center gap-1 text-sm font-bold text-red-600 mb-4">
          <ArrowLeft size={16} /> Các môn
        </button>
        {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải buổi học...</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {subject && (
          <>
            <h1 className="text-2xl font-black text-slate-900">{subject.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {subject.unlockMode === 'sequential'
                ? 'Buổi sau mở khi buổi trước đã xong.'
                : 'Các buổi đang mở hết.'}
            </p>
            <ol className="mt-6 space-y-3">
              {units.length === 0 && <li className="text-sm text-slate-500">Môn này chưa có buổi học.</li>}
              {units.map((unit, index) => (
                <li key={unit.id}>
                  <button
                    type="button"
                    disabled={unit.locked}
                    onClick={() => navigate(`/student/lesson-practice/units/${unit.id}`)}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-4 text-left ${unit.locked ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-100 hover:border-red-200'}`}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{unit.title}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {unit.locked && 'Hoàn thành buổi trước để mở'}
                        {!unit.locked && unit.status === 'completed' && 'Đã xong'}
                        {!unit.locked && unit.status === 'in_progress' && 'Đang học'}
                        {!unit.locked && unit.status === 'open' && 'Chưa học'}
                      </span>
                    </span>
                    {unit.locked && <Lock size={18} />}
                    {!unit.locked && unit.status === 'completed' && <CheckCircle2 size={18} className="text-emerald-600" />}
                    {!unit.locked && unit.status !== 'completed' && <PlayCircle size={18} className="text-red-600" />}
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
