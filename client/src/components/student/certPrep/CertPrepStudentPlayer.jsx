import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, List } from 'lucide-react';
import useCertPrepSession from '../../../hooks/useCertPrepSession';
import CertPrepPlayerHeader from './CertPrepPlayerHeader';
import CertPrepQuestionArea from './CertPrepQuestionArea';
import CertPrepQuestionNavigator from './CertPrepQuestionNavigator';
import CertPrepPlayerFooter from './CertPrepPlayerFooter';
import CertPrepSubmitDialog from './CertPrepSubmitDialog';
import CertPrepSessionExpired from './CertPrepSessionExpired';
import CertPrepPlayerError from './CertPrepPlayerError';

export default function CertPrepStudentPlayer() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const player = useCertPrepSession(sessionId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (player.loading) return;
    if (player.session?.status === 'submitted' && sessionId) {
      navigate(`/student/cert-prep/result/${sessionId}`, { replace: true });
    }
  }, [player.loading, player.session?.status, sessionId, navigate]);

  const back = (
    <button
      type="button"
      onClick={() => navigate('/student/cert-prep')}
      className="text-sm font-bold text-red-600 inline-flex items-center gap-1 px-4 sm:px-6 pt-4"
    >
      <ChevronLeft size={16} aria-hidden="true" /> Quay lại Ôn thi MOS/IC3
    </button>
  );

  if (player.loading || player.uiStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50">
        {back}
        <div className="cms-card mx-4 sm:mx-6 mt-4 flex items-center justify-center py-16 text-slate-400" role="status">
          <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải bài thi...
        </div>
      </div>
    );
  }

  if (player.uiStatus === 'forbidden') {
    return (
      <div className="min-h-screen bg-slate-50">
        {back}
        <div className="p-4 sm:p-6">
          <CertPrepPlayerError message="Bạn không có quyền truy cập phiên làm bài này." />
        </div>
      </div>
    );
  }

  if (player.uiStatus === 'not-found') {
    return (
      <div className="min-h-screen bg-slate-50">
        {back}
        <div className="p-4 sm:p-6">
          <CertPrepPlayerError message={player.error || 'Không tìm thấy phiên làm bài.'} onRetry={player.loadSession} />
        </div>
      </div>
    );
  }

  if (player.uiStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-50">
        {back}
        <div className="p-4 sm:p-6">
          <CertPrepPlayerError message={player.error} onRetry={player.loadSession} />
        </div>
      </div>
    );
  }

  if (player.justSubmitted || player.uiStatus === 'submitted' || player.session?.status === 'submitted') {
    return (
      <div className="min-h-screen bg-slate-50">
        {back}
        <div className="cms-card mx-4 sm:mx-6 mt-4 flex items-center justify-center py-16 text-slate-400" role="status">
          <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang chuyển đến kết quả...
        </div>
      </div>
    );
  }

  if (player.uiStatus === 'expired' || player.session?.status === 'abandoned') {
    return (
      <div className="min-h-screen bg-slate-50">
        {back}
        <div className="p-4 sm:p-6">
          <CertPrepSessionExpired />
        </div>
      </div>
    );
  }

  const q = player.currentQuestion;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CertPrepPlayerHeader
        session={player.session}
        currentIndex={player.currentIndex}
        total={player.questions.length}
        remainingSeconds={player.remainingSeconds}
      />
      {(player.offline || player.saveError) ? (
        <p className="px-4 sm:px-6 py-2 text-sm font-semibold text-amber-800 bg-amber-50 border-b border-amber-100" role="status">
          {player.offline ? 'Mất kết nối mạng.' : player.saveError}
        </p>
      ) : null}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 p-4 sm:p-6">
        <div className="cms-card p-4 sm:p-6">
          {q ? (
            <CertPrepQuestionArea
              key={q.id}
              question={q}
              index={player.currentIndex}
              total={player.questions.length}
              value={player.answers[q.id]}
              disabled={player.locked}
              onChange={(value) => player.selectAnswer(q.id, value)}
            />
          ) : (
            <p className="text-sm text-slate-500">Không có câu hỏi.</p>
          )}
        </div>
        <aside className="lg:block">
          <button
            type="button"
            className="lg:hidden mb-3 min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold inline-flex items-center gap-2"
            onClick={() => setNavOpen((v) => !v)}
          >
            <List size={16} aria-hidden="true" /> Danh sách câu hỏi
          </button>
          <div className={`${navOpen ? 'block' : 'hidden'} lg:block`}>
            <CertPrepQuestionNavigator
              questions={player.questions}
              answers={player.answers}
              currentIndex={player.currentIndex}
              onSelect={player.goToQuestion}
            />
          </div>
        </aside>
      </div>

      <CertPrepPlayerFooter
        currentIndex={player.currentIndex}
        total={player.questions.length}
        onPrevious={player.previous}
        onNext={player.next}
        onSubmit={() => setConfirmOpen(true)}
        submitDisabled={player.locked || player.submitting}
      />

      <CertPrepSubmitDialog
        open={confirmOpen}
        answeredCount={player.answeredCount}
        total={player.questions.length}
        submitting={player.submitting}
        onCancel={() => { if (!player.submitting) setConfirmOpen(false); }}
        onConfirm={async () => {
          await player.submit({ auto: false });
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
