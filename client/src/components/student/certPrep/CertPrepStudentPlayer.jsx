import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, List, LayoutGrid } from 'lucide-react';
import useCertPrepSession, { isQuestionAnswered } from '../../../hooks/useCertPrepSession';
import { isImmediateFeedback } from '../../../utils/certPrepGrade';
import { useData } from '../../../context/DataContext';
import ExamClickOutsideGuard from '../../exam/ExamClickOutsideGuard';
import CertPrepPlayerHeader from './CertPrepPlayerHeader';
import CertPrepQuestionArea from './CertPrepQuestionArea';
import CertPrepQuestionNavigator from './CertPrepQuestionNavigator';
import CertPrepPlayerFooter from './CertPrepPlayerFooter';
import CertPrepSubmitDialog from './CertPrepSubmitDialog';
import CertPrepSessionExpired from './CertPrepSessionExpired';
import CertPrepPlayerError from './CertPrepPlayerError';

/** Lớp phủ toàn app — che sidebar/header/messenger (giống trắc nghiệm buổi học) */
function ExamOverlay({ children, label = 'Phòng thi ôn MOS/IC3' }) {
  if (typeof document === 'undefined') return children;
  return createPortal(
    <div
      data-exam-surface
      className="fixed inset-0 z-[99999] h-[100dvh] w-screen max-w-[100vw] bg-[#0b1018] text-white flex flex-col overflow-hidden font-sans"
      style={{ isolation: 'isolate' }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>,
    document.body,
  );
}

export default function CertPrepStudentPlayer() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { examWarningSoundUrl = '' } = useData() || {};
  const player = useCertPrepSession(sessionId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [revealedIds, setRevealedIds] = useState({});
  const keysReloadTried = useRef(false);

  const immediate = isImmediateFeedback(player.session);

  useEffect(() => {
    setRevealedIds({});
    keysReloadTried.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!immediate || player.loading || !player.questions.length || keysReloadTried.current) return;
    const sample = player.questions[0];
    const missingKeys = sample?.type === 'single_choice'
      ? sample.correctAnswer === undefined
      : sample?.type === 'multiple_choice'
        ? !Array.isArray(sample.correctIndices)
        : sample?.type === 'matching'
          ? !Array.isArray(sample.matchingPairs)
          : sample?.type === 'true_false_grid'
            ? !(Array.isArray(sample.statements) && sample.statements.some((s) => typeof s?.correct === 'boolean'))
            : false;
    if (missingKeys) {
      keysReloadTried.current = true;
      player.loadSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, player.loading, player.questions, sessionId]);

  useEffect(() => {
    if (player.loading) return;
    if (player.session?.status === 'submitted' && sessionId) {
      navigate(`/student/cert-prep/result/${sessionId}`, { replace: true });
    }
  }, [player.loading, player.session?.status, sessionId, navigate]);

  const leaveCatalog = useCallback(() => {
    navigate('/student/cert-prep');
  }, [navigate]);

  const q = player.currentQuestion;
  const qid = q?.id ? String(q.id) : '';
  const currentRevealed = Boolean(qid && (revealedIds[qid] || revealedIds[q.id]));
  const currentAnswered = isQuestionAnswered(q, player.answers[q?.id] ?? player.answers[qid]);
  const answerLocked = player.locked || (immediate && currentRevealed && currentAnswered);

  const handleNext = useCallback(() => {
    if (!q || player.locked) return;
    if (immediate && !revealedIds[q.id] && !revealedIds[qid]) {
      if (!isQuestionAnswered(q, player.answers[q.id] ?? player.answers[qid])) return;
      setRevealedIds((prev) => ({ ...prev, [q.id]: true, [qid]: true }));
      return;
    }
    player.next();
  }, [immediate, revealedIds, q, qid, player]);

  const nextMeta = useMemo(() => {
    const last = player.currentIndex >= player.questions.length - 1;
    if (immediate && q && !revealedIds[q.id] && !revealedIds[qid]) {
      return {
        label: 'Hiển thị đáp án',
        disabled: !isQuestionAnswered(q, player.answers[q.id] ?? player.answers[qid]),
        primary: true,
      };
    }
    return {
      label: 'Câu tiếp',
      disabled: last,
      primary: false,
    };
  }, [immediate, q, qid, revealedIds, player.currentIndex, player.questions.length, player.answers]);

  if (player.loading || player.uiStatus === 'loading') {
    return (
      <ExamOverlay>
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin text-emerald-400 mb-3" size={32} aria-hidden="true" />
          <p className="text-sm font-bold">Đang tải phòng thi MOS/IC3...</p>
        </div>
      </ExamOverlay>
    );
  }

  if (player.uiStatus === 'forbidden') {
    return (
      <ExamOverlay>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <CertPrepPlayerError message="Bạn không có quyền truy cập phiên làm bài này." exam />
          <button type="button" onClick={leaveCatalog} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold">
            Quay lại
          </button>
        </div>
      </ExamOverlay>
    );
  }

  if (player.uiStatus === 'not-found') {
    return (
      <ExamOverlay>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <CertPrepPlayerError message={player.error || 'Không tìm thấy phiên làm bài.'} onRetry={player.loadSession} exam />
          <button type="button" onClick={leaveCatalog} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold">
            Quay lại
          </button>
        </div>
      </ExamOverlay>
    );
  }

  if (player.uiStatus === 'error') {
    return (
      <ExamOverlay>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <CertPrepPlayerError message={player.error} onRetry={player.loadSession} exam />
          <button type="button" onClick={leaveCatalog} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold">
            Quay lại
          </button>
        </div>
      </ExamOverlay>
    );
  }

  if (player.justSubmitted || player.uiStatus === 'submitted' || player.session?.status === 'submitted') {
    return (
      <ExamOverlay>
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin text-emerald-400 mb-3" size={32} aria-hidden="true" />
          <p className="text-sm font-bold">Đang chuyển đến kết quả...</p>
        </div>
      </ExamOverlay>
    );
  }

  if (player.uiStatus === 'expired' || player.session?.status === 'abandoned') {
    return (
      <ExamOverlay>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <CertPrepSessionExpired exam />
          <button type="button" onClick={leaveCatalog} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold">
            Quay lại danh sách
          </button>
        </div>
      </ExamOverlay>
    );
  }

  return (
    <ExamOverlay>
      <ExamClickOutsideGuard
        enabled={!player.locked && !player.submitting}
        soundUrl={examWarningSoundUrl}
        watchVisibility
        className="flex-1 min-h-0 flex flex-col select-none overflow-x-hidden"
      >
        <CertPrepPlayerHeader
          exam
          session={player.session}
          currentIndex={player.currentIndex}
          total={player.questions.length}
          remainingSeconds={player.remainingSeconds}
          answeredCount={player.answeredCount}
          onExit={leaveCatalog}
          onSubmit={() => setConfirmOpen(true)}
          submitDisabled={player.locked || player.submitting}
        />

        {(player.offline || player.saveError) ? (
          <p className="px-4 py-2 text-sm font-semibold text-amber-200 bg-amber-500/15 border-b border-amber-500/25 shrink-0" role="status">
            {player.offline ? 'Mất kết nối mạng.' : player.saveError}
          </p>
        ) : null}

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              {q ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
                  <CertPrepQuestionArea
                    key={q.id}
                    exam
                    question={q}
                    index={player.currentIndex}
                    total={player.questions.length}
                    value={player.answers[q.id]}
                    disabled={answerLocked}
                    showFeedback={immediate && currentRevealed}
                    onChange={(value) => player.selectAnswer(q.id, value)}
                  />
                </div>
              ) : (
                <p className="text-center py-10 text-slate-400 text-sm">Không có câu hỏi.</p>
              )}

              <CertPrepPlayerFooter
                exam
                currentIndex={player.currentIndex}
                total={player.questions.length}
                onPrevious={player.previous}
                onNext={handleNext}
                onSubmit={() => setConfirmOpen(true)}
                submitDisabled={player.locked || player.submitting}
                nextLabel={nextMeta.label}
                nextDisabled={nextMeta.disabled || player.locked}
                nextPrimary={nextMeta.primary}
              />
            </div>
          </div>

          <aside className="lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-white/10 p-4 sm:p-5 bg-[#0e1420] flex flex-col shrink-0 lg:overflow-y-auto">
            <button
              type="button"
              className="lg:hidden mb-3 min-h-11 px-3 rounded-xl border border-white/15 bg-white/5 text-sm font-bold inline-flex items-center gap-2 text-slate-200"
              onClick={() => setNavOpen((v) => !v)}
            >
              <List size={16} aria-hidden="true" /> Danh sách câu hỏi
            </button>
            <div className={`${navOpen ? 'block' : 'hidden'} lg:block`}>
              <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-300">
                <LayoutGrid size={16} className="text-sky-400" aria-hidden="true" />
                <span>Danh sách câu hỏi</span>
              </div>
              <CertPrepQuestionNavigator
                exam
                questions={player.questions}
                answers={player.answers}
                currentIndex={player.currentIndex}
                onSelect={player.goToQuestion}
                revealedIds={revealedIds}
                showResultColors={immediate}
              />
            </div>
          </aside>
        </div>

        <CertPrepSubmitDialog
          exam
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
      </ExamClickOutsideGuard>
    </ExamOverlay>
  );
}
