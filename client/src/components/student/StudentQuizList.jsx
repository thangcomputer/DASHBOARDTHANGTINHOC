import React, { useState, useEffect } from 'react';
import { Award, Clock, HelpCircle, User, CheckCircle, Play, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import StudentQuizExamRoom from './StudentQuizExamRoom';
import { PENDING_QUIZ_START_KEY } from './StudentQuizInviteHost';

export default function StudentQuizList() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQuizId, setActiveQuizId] = useState(null);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await api.quizzes.getStudentQuizzes();
      if (res.success) {
        setQuizzes(res.data || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
    try {
      const pending = sessionStorage.getItem(PENDING_QUIZ_START_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_QUIZ_START_KEY);
        setActiveQuizId(pending);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (activeQuizId) {
    return (
      <StudentQuizExamRoom
        quizId={activeQuizId}
        onBack={() => {
          setActiveQuizId(null);
          fetchQuizzes();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-start gap-2 bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-lg font-bold text-slate-800 flex items-start gap-2">
            <Award className="text-red-600 shrink-0 mt-0.5" size={18} />
            <span className="leading-snug break-words">Trắc nghiệm bài học từ Giảng viên</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
            Danh sách các bài thi trắc nghiệm được giảng viên giao theo từng buổi học.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchQuizzes}
          className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition shrink-0"
          title="Tải lại danh sách"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <RefreshCw className="animate-spin mx-auto mb-2 text-red-600" size={24} />
          <p className="text-xs font-bold">Đang tải danh sách bài trắc nghiệm...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
          <Award size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold text-slate-600">Hiện chưa có bài trắc nghiệm mới nào</p>
          <p className="text-xs mt-1">Khi giảng viên giao bài thi buổi học, danh sách sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {quizzes.map((quiz) => {
            const hasSubmitted = !!quiz.mySubmission;
            const isForfeit = !!quiz.mySubmission?.forfeit;
            const score = quiz.mySubmission?.score;
            const isPassed = !isForfeit && (quiz.mySubmission?.status === 'passed' || (score != null && score >= 70));

            return (
              <div
                key={quiz._id}
                className="bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between min-w-0"
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase break-words min-w-0">
                      {quiz.courseName || 'Bài thi buổi học'}
                    </span>
                    {hasSubmitted && (
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                        isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {isForfeit ? 'RỚT · THOÁT' : (isPassed ? 'ĐẠT' : 'CHƯA ĐẠT')}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug mb-1 break-words">
                    {quiz.title}
                  </h3>

                  <div className="grid grid-cols-1 gap-1.5 text-[11px] font-semibold text-slate-500 my-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} className="shrink-0" /> {quiz.timeLimitMinutes} phút
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HelpCircle size={12} className="shrink-0" /> {quiz.questionsCount} câu hỏi
                    </span>
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <User size={12} className="shrink-0" />
                      <span className="truncate">GV: {quiz.teacherName}</span>
                    </span>
                  </div>

                  {hasSubmitted && (
                    <div className={`rounded-xl p-2.5 border flex flex-col gap-0.5 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between text-xs my-1 min-w-0 ${
                      isForfeit ? 'bg-red-50/70 border-red-100' : 'bg-emerald-50/60 border-emerald-100'
                    }`}>
                      <span className={`font-semibold ${isForfeit ? 'text-red-800' : 'text-emerald-800'}`}>
                        {isForfeit ? 'Rớt do thoát giữa giờ' : 'Kết quả đã nộp:'}
                      </span>
                      <span className={`font-black text-sm tabular-nums ${isForfeit ? 'text-red-700' : 'text-emerald-700'}`}>
                        {score}%{!isForfeit ? ` (${quiz.mySubmission.correctCount}/${quiz.mySubmission.totalQuestions} câu)` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveQuizId(quiz._id)}
                  className={`mt-4 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${
                    hasSubmitted
                      ? 'bg-slate-800 hover:bg-slate-900 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {hasSubmitted ? (
                    <>
                      <CheckCircle size={14} /> Xem lại bài thi ({score}%)
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Bắt đầu thi trắc nghiệm
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
