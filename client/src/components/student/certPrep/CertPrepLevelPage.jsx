import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useToast } from '../../../utils/toast';
import useCertPrepStudent from '../../../hooks/useCertPrepStudent';
import CertPrepTestList from './CertPrepTestList';
import CertPrepErrorState from './CertPrepErrorState';
import { isAccessExpired } from './certPrepStudentLabels';

export default function CertPrepLevelPage() {
  const { levelId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const student = useCertPrepStudent();
  const [error, setError] = useState('');
  const [startingTestId, setStartingTestId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await student.loadTests(levelId);
      } catch (err) {
        if (cancelled) return;
        const status = err?.status;
        if (status === 403) setError(err.message || 'Bạn không có quyền truy cập Level này.');
        else setError(student.errorMessage(err));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  const payload = student.levelPayload;
  const tests = useMemo(() => payload?.tests || [], [payload]);
  const expired = isAccessExpired(payload?.expiresAt);
  const courseName = payload?.course?.name || '';
  const levelTitle = payload?.level?.title || 'Level';
  const courseId = payload?.course?.id;

  const start = async (test, options = {}) => {
    if (!test || student.starting) return;
    setStartingTestId(test.id);
    try {
      const session = await student.startSession(test.id, options);
      const sid = session?.id || session?._id;
      if (!sid) throw new Error('Không nhận được phiên làm bài từ máy chủ.');
      navigate(`/student/cert-prep/play/${sid}`);
    } catch (err) {
      toast.error(student.errorMessage(err, 'Bạn không có quyền bắt đầu bài thi này.'));
    } finally {
      setStartingTestId('');
    }
  };

  const resume = (test, sessionId) => {
    if (!sessionId) return;
    navigate(`/student/cert-prep/play/${sessionId}`);
  };

  if (student.loadingTests) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400" role="status">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải đề thi...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/student/cert-prep')} className="text-sm font-bold text-red-600 inline-flex items-center gap-1">
          <ChevronLeft size={16} aria-hidden="true" /> Quay lại Ôn thi MOS/IC3
        </button>
        <CertPrepErrorState
          message={error}
          onRetry={() => {
            setError('');
            student.loadTests(levelId).catch((err) => {
              const status = err?.status;
              if (status === 403) setError(err.message || 'Bạn không có quyền truy cập Level này.');
              else setError(student.errorMessage(err));
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(courseId ? `/student/cert-prep?course=${courseId}` : '/student/cert-prep')}
        className="text-sm font-bold text-red-600 inline-flex items-center gap-1"
      >
        <ChevronLeft size={16} aria-hidden="true" /> Quay lại khóa học
      </button>
      <div className="cms-toolbar">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{courseName}</p>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">{levelTitle}</h2>
          {payload?.level?.subtitle ? <p className="text-sm text-slate-500 mt-0.5">{payload.level.subtitle}</p> : null}
        </div>
      </div>
      <CertPrepTestList
        tests={tests}
        expired={expired}
        starting={student.starting}
        startingTestId={startingTestId}
        onStart={start}
        onContinue={resume}
      />
    </div>
  );
}
