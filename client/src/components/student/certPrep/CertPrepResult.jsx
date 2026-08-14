import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import useCertPrepResult from '../../../hooks/useCertPrepResult';
import CertPrepResultSummary from './CertPrepResultSummary';
import CertPrepReview from './CertPrepReview';
import CertPrepAttemptHistory from './CertPrepAttemptHistory';
import CertPrepErrorState from './CertPrepErrorState';

export default function CertPrepResult() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const state = useCertPrepResult(sessionId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await state.loadResult();
      if (cancelled || !data?.testId) return;
      state.loadAttempts(data.testId);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (state.loading) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400" role="status">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải kết quả...
      </div>
    );
  }

  if (state.error) {
    const goPlayer = state.errorStatus === 409
      ? () => navigate(`/student/cert-prep/play/${sessionId}`)
      : state.loadResult;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/student/cert-prep')} className="text-sm font-bold text-red-600 inline-flex items-center gap-1">
          <ChevronLeft size={16} aria-hidden="true" /> Quay lại Ôn thi MOS/IC3
        </button>
        <CertPrepErrorState
          message={state.error}
          onRetry={goPlayer}
        />
      </div>
    );
  }

  const result = state.result;
  if (!result) return null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate('/student/cert-prep')} className="text-sm font-bold text-red-600 inline-flex items-center gap-1">
        <ChevronLeft size={16} aria-hidden="true" /> Quay lại Ôn thi MOS/IC3
      </button>
      <CertPrepResultSummary result={result} />
      <CertPrepAttemptHistory attempts={state.attempts} currentSessionId={sessionId} />
      <h3 className="text-base font-bold text-slate-900 px-1">Xem lại bài làm</h3>
      <CertPrepReview questions={result.questions || []} />
    </div>
  );
}
