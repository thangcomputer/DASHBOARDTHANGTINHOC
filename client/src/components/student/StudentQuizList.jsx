import React, { useState, useEffect } from 'react';
import { Award, Clock, HelpCircle, User, CheckCircle, Play, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import StudentQuizExamRoom from './StudentQuizExamRoom';

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
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Award className="text-red-600" size={20} /> Trắc nghiệm bài học từ Giảng viên
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Danh sách các bài thi trắc nghiệm được giảng viên giao theo từng buổi học.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchQuizzes}
          className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => {
            const hasSubmitted = !!quiz.mySubmission;
            const score = quiz.mySubmission?.score;
            const isPassed = quiz.mySubmission?.status === 'passed' || (score != null && score >= 70);

            return (
              <div
                key={quiz._id}
                className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase">
                      {quiz.courseName || 'Bài thi buổi học'}
                    </span>
                    {hasSubmitted && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                        isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug mb-1 line-clamp-2">
                    {quiz.title}
                  </h3>

                  <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500 my-3">
                    <span className="flex items-center gap-1"><Clock size={12} /> {quiz.timeLimitMinutes} phút</span>
                    <span className="flex items-center gap-1"><HelpCircle size={12} /> {quiz.questionsCount} câu hỏi</span>
                    <span className="flex items-center gap-1"><User size={12} /> GV: {quiz.teacherName}</span>
                  </div>

                  {hasSubmitted && (
                    <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100 flex items-center justify-between text-xs my-1">
                      <span className="text-emerald-800 font-semibold">Kết quả đã nộp:</span>
                      <span className="font-black text-emerald-700 text-sm">{score}% ({quiz.mySubmission.correctCount}/{quiz.mySubmission.totalQuestions} câu)</span>
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
