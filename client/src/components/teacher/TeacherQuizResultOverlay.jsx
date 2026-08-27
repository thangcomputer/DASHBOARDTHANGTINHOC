import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Award, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../utils/toast';

export const PENDING_TEACHER_QUIZ_DETAIL_KEY = 'cms_pending_teacher_quiz_detail';

function OverlayShell({ children, label = 'Kết quả trắc nghiệm học viên' }) {
  if (typeof document === 'undefined') return children;
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] h-[100dvh] w-screen max-w-[100vw] bg-[#0b1018] text-white flex flex-col overflow-hidden font-sans"
      style={{ isolation: 'isolate' }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>,
    document.body
  );
}

function studentIdOf(sub) {
  return String(sub?.studentId?._id || sub?.studentId || sub?.student_id || '');
}

function buildDetailedReview(questions, answers) {
  const ans = Array.isArray(answers) ? answers : [];
  return (questions || []).map((q, idx) => ({
    _id: q._id,
    questionText: q.questionText,
    options: q.options || [],
    correctAnswer: q.correctAnswer,
    userAnswer: ans[idx] ?? null,
    isCorrect: ans[idx] === q.correctAnswer,
    explanation: q.explanation || '',
  }));
}

function readPendingDetail() {
  try {
    const raw = sessionStorage.getItem(PENDING_TEACHER_QUIZ_DETAIL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_TEACHER_QUIZ_DETAIL_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function TeacherQuizResultOverlay() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);

  const close = useCallback(() => {
    setView(null);
    setLoading(false);
  }, []);

  const openFromDetail = useCallback(async (detail = {}) => {
    const quizId = detail?.quizId || detail?.payload?.quizId || null;
    const studentId = detail?.studentId || detail?.payload?.studentId || null;
    if (!studentId) return;

    setLoading(true);
    setView(null);
    try {
      const res = await api.quizzes.getTeacherQuizzes();
      if (!res?.success) {
        toast.error(res?.message || 'Không tải được bài trắc nghiệm');
        setLoading(false);
        return;
      }
      const list = Array.isArray(res.data) ? res.data : [];
      const quiz = quizId
        ? list.find((q) => String(q.id || q._id) === String(quizId))
        : list.find((q) => (q.submissions || []).some((s) => studentIdOf(s) === String(studentId)));

      if (!quiz) {
        toast.error('Không tìm thấy bài trắc nghiệm.');
        setLoading(false);
        return;
      }

      const submission = studentId
        ? (quiz.submissions || []).find((s) => studentIdOf(s) === String(studentId))
        : (quiz.submissions || [])[0];

      if (!submission) {
        toast.error('Chưa có bài nộp của học viên này.');
        setLoading(false);
        return;
      }

      const isForfeit = !!submission.forfeit;
      setView({
        quiz,
        submission,
        detailedReview: isForfeit ? [] : buildDetailedReview(quiz.questions, submission.answers),
      });
    } catch {
      toast.error('Không tải được kết quả bài trắc nghiệm. Thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const pending = readPendingDetail();
    if (pending) openFromDetail(pending);

    const onOpen = (e) => {
      try { sessionStorage.removeItem(PENDING_TEACHER_QUIZ_DETAIL_KEY); } catch { /* ignore */ }
      openFromDetail(e?.detail || {});
    };
    window.addEventListener('open-teacher-quiz-detail', onOpen);
    return () => window.removeEventListener('open-teacher-quiz-detail', onOpen);
  }, [openFromDetail]);

  if (!loading && !view) return null;

  if (loading) {
    return (
      <OverlayShell>
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <RefreshCw className="animate-spin text-emerald-400 mb-3" size={32} />
          <p className="text-sm font-bold">Đang tải kết quả trắc nghiệm...</p>
        </div>
      </OverlayShell>
    );
  }

  const { quiz, submission, detailedReview } = view;
  const isForfeit = !!submission.forfeit;
  const isPassed = !isForfeit && (submission.status === 'passed' || submission.score >= 70);

  return (
    <OverlayShell>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition"
            >
              <ArrowLeft size={16} /> Đóng
            </button>
            <span className="text-xs font-bold text-slate-400">Kết quả bài trắc nghiệm</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
              isPassed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              <Award size={40} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mb-1">{quiz.title}</h1>
            <p className="text-xs text-slate-400 mb-6">
              Học viên: {submission.studentName || 'Học viên'}
              {quiz.courseName ? ` · ${quiz.courseName}` : ''}
            </p>

            <div className="inline-flex flex-col items-center justify-center px-8 py-4 rounded-2xl bg-white/5 border border-white/10 mb-6">
              <span className="text-4xl sm:text-5xl font-black text-amber-400 tabular-nums">
                {submission.score}%
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider mt-1 ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                {isForfeit ? 'RỚT · THOÁT GIỮA GIỜ' : (isPassed ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT')}
              </span>
            </div>

            {isForfeit && (
              <p className="text-xs text-red-300/90 mb-6 max-w-md mx-auto leading-relaxed">
                {submission.exitReason || 'Học viên thoát phòng thi khi đang làm bài nên bị tính RỚT.'}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto text-left text-xs font-semibold">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[10px]">Số câu đúng</span>
                <span className="text-emerald-400 font-bold text-sm">{submission.correctCount}/{submission.totalQuestions}</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[10px]">Thời gian làm</span>
                <span className="text-white font-bold text-sm">{quiz.timeLimitMinutes} phút</span>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px]">Trạng thái</span>
                <span className={`font-bold text-sm ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isForfeit ? 'Rớt do thoát' : (isPassed ? 'Đã hoàn thành' : 'Cần học lại')}
                </span>
              </div>
            </div>
          </div>

          {detailedReview && detailedReview.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-200">Chi tiết đáp án bài thi</h3>
              {detailedReview.map((q, idx) => (
                <div key={q._id || idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-sm text-slate-100">
                      <span className="text-emerald-400 mr-2">Câu {idx + 1}:</span> {q.questionText}
                    </p>
                    {q.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0">
                        <CheckCircle size={12} /> Đúng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md shrink-0">
                        <XCircle size={12} /> Sai
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                    {(q.options || []).map((opt, optIdx) => {
                      const isUserChoice = q.userAnswer === optIdx;
                      const isCorrectChoice = q.correctAnswer === optIdx;
                      let optionStyle = 'bg-white/5 text-slate-400 border-white/5';
                      if (isCorrectChoice) {
                        optionStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
                      } else if (isUserChoice && !q.isCorrect) {
                        optionStyle = 'bg-red-500/20 text-red-300 border-red-500/40 font-bold';
                      }
                      return (
                        <div key={optIdx} className={`p-3 rounded-xl border flex items-center gap-2 ${optionStyle}`}>
                          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] shrink-0">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1 min-w-0 leading-tight">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200">
                      <strong>Giải thích từ GV:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </OverlayShell>
  );
}
