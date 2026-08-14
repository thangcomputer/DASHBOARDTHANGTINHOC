import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, Loader2 } from 'lucide-react';
import useCertPrepStudent from '../../../hooks/useCertPrepStudent';
import CertPrepCatalog from './CertPrepCatalog';
import CertPrepLevelList from './CertPrepLevelList';
import CertPrepAccessState from './CertPrepAccessState';
import CertPrepErrorState from './CertPrepErrorState';

export default function CertPrepCatalogPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') || '';
  const student = useCertPrepStudent();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await student.loadCatalog();
      } catch (err) {
        if (!cancelled) {
          setError(student.errorMessage(err, 'Bạn chưa được cấp quyền truy cập nội dung ôn thi này.'));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const course = useMemo(
    () => student.catalog.find((c) => String(c.id) === String(courseId)) || null,
    [student.catalog, courseId],
  );

  const retry = () => {
    setError('');
    student.loadCatalog().catch((err) => {
      setError(student.errorMessage(err, 'Bạn chưa được cấp quyền truy cập nội dung ôn thi này.'));
    });
  };

  const openCourse = (c) => {
    setParams({ course: c.id });
  };

  if (student.loadingCatalog) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400" role="status">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải khóa ôn thi...
      </div>
    );
  }

  if (error) {
    return <CertPrepErrorState message={error} onRetry={retry} />;
  }

  if (courseId && !course) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setParams({})} className="text-sm font-bold text-red-600 inline-flex items-center gap-1">
          <ChevronLeft size={16} aria-hidden="true" /> Quay lại Ôn thi MOS/IC3
        </button>
        <CertPrepErrorState message="Không tìm thấy nội dung." onRetry={() => setParams({})} />
      </div>
    );
  }

  if (course) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setParams({})} className="text-sm font-bold text-red-600 inline-flex items-center gap-1">
          <ChevronLeft size={16} aria-hidden="true" /> Quay lại Ôn thi MOS/IC3
        </button>
        <div className="cms-toolbar">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">{course.name}</h2>
            {course.description ? <p className="text-sm text-slate-500 mt-0.5">{course.description}</p> : null}
          </div>
        </div>
        <CertPrepAccessState expiresAt={course.expiresAt} />
        <CertPrepLevelList
          levels={course.levels}
          onOpen={(level) => navigate(`/student/cert-prep/levels/${level.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="cms-toolbar">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 inline-flex items-center gap-2">
            <BookOpen size={20} className="text-red-600" aria-hidden="true" /> Ôn thi MOS/IC3
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Luyện tập và kiểm tra kiến thức theo từng cấp độ.</p>
        </div>
      </div>
      <CertPrepCatalog courses={student.catalog} onOpen={openCourse} />
    </div>
  );
}
