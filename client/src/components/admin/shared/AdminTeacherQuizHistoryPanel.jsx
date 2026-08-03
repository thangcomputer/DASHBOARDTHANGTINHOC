import React, { useState, useEffect } from 'react';
import { Award, Search, User, Clock, CheckCircle, RefreshCw, Calendar, Eye, X, BookOpen, Layers } from 'lucide-react';
import api from '../../../services/api';

export default function AdminTeacherQuizHistoryPanel() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const fetchAdminQuizzes = async () => {
    setLoading(true);
    try {
      const res = await api.quizzes.getAdminQuizzes();
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
    fetchAdminQuizzes();
  }, []);

  const filtered = quizzes.filter((q) => {
    const term = searchQuery.toLowerCase();
    return (
      (q.title || '').toLowerCase().includes(term) ||
      (q.teacherName || '').toLowerCase().includes(term) ||
      (q.courseName || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
            <Award className="text-red-600" size={22} /> Lịch sử Tạo Trắc Nghiệm của Giảng Viên
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Theo dõi tất cả các đề trắc nghiệm do giảng viên khởi tạo và kết quả làm bài của học viên.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo GV, tiêu đề, môn..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-500"
            />
          </div>
          <button
            type="button"
            onClick={fetchAdminQuizzes}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
            title="Tải lại"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* List / Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
          <RefreshCw className="animate-spin mx-auto mb-2 text-red-600" size={28} />
          <p className="text-xs font-bold">Đang tải lịch sử bài trắc nghiệm...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
          <Award size={40} className="mx-auto mb-2 opacity-30 text-slate-400" />
          <p className="text-sm font-bold text-slate-600">Chưa có dữ liệu bài trắc nghiệm nào</p>
          <p className="text-xs mt-1">Khi giảng viên tạo đề thi trắc nghiệm, danh sách lịch sử sẽ tự động hiển thị ở đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((quiz) => {
            const subs = quiz.submissions || [];
            const subCount = subs.length;
            const avgScore = subCount > 0
              ? Math.round(subs.reduce((acc, s) => acc + (s.score || 0), 0) / subCount)
              : null;

            return (
              <div
                key={quiz._id}
                className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-100 text-[10px] font-black uppercase">
                      {quiz.courseName || 'Toàn hệ thống'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm leading-snug mb-1">
                    {quiz.title}
                  </h4>

                  <div className="space-y-1.5 text-xs text-slate-600 my-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <User size={14} className="text-red-500" /> GV: {quiz.teacherName || 'Giảng viên'}
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Clock size={14} /> Thời gian: {quiz.timeLimitMinutes || 15} phút · {quiz.questions?.length || 0} câu hỏi
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Đã nộp bài</p>
                    <p className="text-sm font-black text-slate-800">
                      {subCount} lượt {avgScore !== null && <span className="text-emerald-600 text-xs font-bold">(TB: {avgScore}%)</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedQuiz(quiz)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold transition"
                  >
                    <Eye size={14} /> Chi tiết ({subCount})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal chi tiết kết quả làm bài của học viên */}
      {selectedQuiz && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase bg-red-600 text-white px-2 py-0.5 rounded">
                  {selectedQuiz.courseName || 'Trắc nghiệm'}
                </span>
                <h3 className="font-bold text-base mt-1">{selectedQuiz.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Giảng viên: {selectedQuiz.teacherName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuiz(null)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b pb-2">
                <span>DANH SÁCH HỌC VIÊN ĐÃ NỘP BÀI ({selectedQuiz.submissions?.length || 0})</span>
                <span>TỔNG {selectedQuiz.questions?.length || 0} CÂU HỎI</span>
              </div>

              {(!selectedQuiz.submissions || selectedQuiz.submissions.length === 0) ? (
                <div className="py-8 text-center text-slate-400 text-xs">Chưa có học viên nào nộp bài thi này.</div>
              ) : (
                <div className="space-y-2">
                  {selectedQuiz.submissions.map((sub, i) => {
                    const isPassed = sub.status === 'passed' || (sub.score != null && sub.score >= 70);
                    return (
                      <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{sub.studentName || 'Học viên'}</p>
                          <p className="text-[11px] text-slate-400">SĐT: {sub.studentPhone || '---'} · Nộp: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : ''}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                          </span>
                          <p className={`text-base font-black mt-1 ${isPassed ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sub.correctCount ?? 0}/{(sub.totalQuestions ?? selectedQuiz.questions?.length) || 0} câu ({sub.score ?? 0}%)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
