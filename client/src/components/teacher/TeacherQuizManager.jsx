import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Clock, Calendar, Users, Award, BookOpen, CheckCircle,
  X, HelpCircle, Eye, AlertCircle, RefreshCw, Send, Check
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../utils/toast';

export default function TeacherQuizManager({ myStudents = [] }) {
  const toast = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDetailQuiz, setSelectedDetailQuiz] = useState(null);

  // Form tạo bài trắc nghiệm
  const uniqueCourses = [...new Set((myStudents || []).map(s => s.course).filter(Boolean))];

  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState(uniqueCourses[0] || '');
  const [targetStudentIds, setTargetStudentIds] = useState([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [questions, setQuestions] = useState([
    {
      questionText: 'Ví dụ: Phím tắt để lưu tài liệu trong MS Word là gì?',
      options: ['Ctrl + S', 'Ctrl + C', 'Ctrl + V', 'Ctrl + P'],
      correctAnswer: 0,
      explanation: 'Ctrl + S là phím tắt tiêu chuẩn để Save (Lưu) tài liệu.',
    },
  ]);

  // Load danh sách bài trắc nghiệm của giảng viên
  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await api.quizzes.getTeacherQuizzes();
      if (res.success) {
        setQuizzes(res.data || []);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách bài trắc nghiệm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Lọc học viên thuộc khóa đã chọn
  const filteredStudents = myStudents.filter(s => !courseName || s.course === courseName);

  // Thêm 1 câu hỏi mới
  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: '',
      },
    ]);
  };

  // Xóa 1 câu hỏi
  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      toast.warning('Bài thi trắc nghiệm phải có ít nhất 1 câu hỏi');
      return;
    }
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Thêm mẫu nhanh câu hỏi Word/Excel
  const loadTemplateQuestions = (type) => {
    if (type === 'word') {
      setQuestions([
        {
          questionText: 'Phím tắt nào dùng để sao chép văn bản trong Word?',
          options: ['Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z'],
          correctAnswer: 0,
          explanation: 'Ctrl + C là phím tắt sao chép (Copy).',
        },
        {
          questionText: 'Để căn giữa đoạn văn bản, ta dùng tổ hợp phím nào?',
          options: ['Ctrl + E', 'Ctrl + L', 'Ctrl + R', 'Ctrl + J'],
          correctAnswer: 0,
          explanation: 'Ctrl + E dùng để căn giữa (Center align).',
        },
        {
          questionText: 'Định dạng đuôi file mặc định của MS Word từ bản 2007 là gì?',
          options: ['.docx', '.xlsx', '.pptx', '.pdf'],
          correctAnswer: 0,
          explanation: '.docx là định dạng tài liệu mặc định của Word.',
        },
      ]);
    } else if (type === 'excel') {
      setQuestions([
        {
          questionText: 'Hàm nào dùng để tính tổng các ô trong Excel?',
          options: ['SUM', 'AVERAGE', 'COUNT', 'MAX'],
          correctAnswer: 0,
          explanation: 'Hàm SUM dùng để cộng tổng chuỗi số.',
        },
        {
          questionText: 'Cú pháp đúng của hàm VLOOKUP trong Excel là gì?',
          options: [
            'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
            'VLOOKUP(table_array, lookup_value, col_index_num)',
            'VLOOKUP(col_index_num, table_array, lookup_value)',
            'VLOOKUP(range_lookup, table_array, col_index_num)',
          ],
          correctAnswer: 0,
          explanation: 'Đối số 1 là giá trị tìm kiếm, đối số 2 là bảng tra cứu.',
        },
      ]);
    }
    toast.success(`Đã thêm mẫu câu hỏi ${type.toUpperCase()}`);
  };

  // Submit tạo bài trắc nghiệm
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.warning('Vui lòng nhập tên bài trắc nghiệm');
    if (questions.some(q => !q.questionText.trim() || q.options.some(o => !o.trim()))) {
      return toast.warning('Vui lòng điền đầy đủ câu hỏi và 4 lựa chọn đáp án');
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        courseName,
        targetStudentIds,
        timeLimitMinutes: Number(timeLimitMinutes) || 15,
        startTime,
        deadline: deadline || null,
        questions,
      };
      const res = await api.quizzes.create(payload);
      if (res.success) {
        toast.success('Đã tạo bài trắc nghiệm thành công!');
        setShowCreateModal(false);
        setTitle('');
        setQuestions([
          {
            questionText: 'Ví dụ: Phím tắt để lưu tài liệu trong MS Word là gì?',
            options: ['Ctrl + S', 'Ctrl + C', 'Ctrl + V', 'Ctrl + P'],
            correctAnswer: 0,
            explanation: 'Ctrl + S là phím tắt tiêu chuẩn để Save (Lưu) tài liệu.',
          },
        ]);
        fetchQuizzes();
      } else {
        toast.error(res.message || 'Lỗi khi tạo bài trắc nghiệm');
      }
    } catch {
      toast.error('Lỗi kết nối khi tạo bài trắc nghiệm');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa bài trắc nghiệm
  const handleDeleteQuiz = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài trắc nghiệm này?')) return;
    try {
      const res = await api.quizzes.remove(id);
      if (res.success) {
        toast.success('Đã xóa bài trắc nghiệm');
        fetchQuizzes();
      } else {
        toast.error(res.message || 'Không thể xóa');
      }
    } catch {
      toast.error('Lỗi khi xóa bài trắc nghiệm');
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Award className="text-red-600" size={20} /> Quản lý Trắc nghiệm mỗi buổi học
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Tạo câu hỏi trắc nghiệm, gán cho học viên và chấm điểm tự động theo chuẩn phòng thi chứng chỉ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus size={16} /> Tạo bài trắc nghiệm mới
        </button>
      </div>

      {/* ── DANH SÁCH BÀI TRẮC NGHIỆM ĐÃ TẠO ── */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <RefreshCw className="animate-spin mx-auto mb-2 text-red-600" size={24} />
          <p className="text-xs font-bold">Đang tải danh sách bài trắc nghiệm...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
          <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold text-slate-600">Chưa có bài trắc nghiệm nào</p>
          <p className="text-xs mt-1">Bấm "Tạo bài trắc nghiệm mới" để soạn bộ câu hỏi cho học viên.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quizzes.map((quiz) => {
            const subCount = quiz.submissions?.length || 0;
            const passedCount = (quiz.submissions || []).filter(s => s.status === 'passed').length;
            const avgScore = subCount > 0
              ? Math.round(quiz.submissions.reduce((acc, curr) => acc + (curr.score || 0), 0) / subCount)
              : 0;

            return (
              <div
                key={quiz._id}
                className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase">
                      {quiz.courseName || 'Tất cả lớp'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(quiz._id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Xóa bài thi"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug mb-1 line-clamp-2">
                    {quiz.title}
                  </h3>

                  <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500 my-3">
                    <span className="flex items-center gap-1"><Clock size={12} /> {quiz.timeLimitMinutes} phút</span>
                    <span className="flex items-center gap-1"><HelpCircle size={12} /> {quiz.questions?.length || 0} câu hỏi</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {subCount} bài đã nộp</span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Điểm TB học viên:</span>
                    <span className="font-black text-amber-600">{subCount > 0 ? `${avgScore}%` : 'Chưa có'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDetailQuiz(quiz)}
                  className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Eye size={14} /> Xem kết quả ({subCount})
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL SOẠN BÀI TRẮC NGHIỆM MỚI ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 space-y-5 my-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="text-red-600" size={18} /> Tạo bài thi trắc nghiệm theo buổi học
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Soạn nội dung trắc nghiệm và giao cho học viên.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Tên bài kiểm tra / Buổi học *</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ví dụ: Trắc nghiệm Buổi 1 - MS Word"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-red-500 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Khóa học / Lớp áp dụng</label>
                  <select
                    value={courseName}
                    onChange={e => setCourseName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-red-500 font-bold bg-white"
                  >
                    <option value="">-- Tất cả các lớp --</option>
                    {uniqueCourses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Thời gian làm bài (Phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={timeLimitMinutes}
                    onChange={e => setTimeLimitMinutes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-red-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Hạn chót làm bài (Không bắt buộc)</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-red-500 font-bold"
                  />
                </div>
              </div>

              {/* Mẫu nhanh */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 text-[11px]">Nạp mẫu nhanh:</span>
                <button
                  type="button"
                  onClick={() => loadTemplateQuestions('word')}
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold"
                >
                  Mẫu Word (3 câu)
                </button>
                <button
                  type="button"
                  onClick={() => loadTemplateQuestions('excel')}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[11px] font-bold"
                >
                  Mẫu Excel (2 câu)
                </button>
              </div>

              {/* SOẠN CÂU HỎI TRẮC NGHIỆM */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800 text-sm">Danh sách câu hỏi ({questions.length} câu)</h4>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus size={13} /> Thêm câu hỏi
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 text-xs">Câu hỏi số {qIdx + 1}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 size={13} /> Xóa câu
                        </button>
                      )}
                    </div>

                    <input
                      value={q.questionText}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map((item, idx) => (idx === qIdx ? { ...item, questionText: val } : item)));
                      }}
                      placeholder="Nhập nội dung câu hỏi..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-red-500 font-bold bg-white"
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setQuestions(prev => prev.map((item, idx) => (idx === qIdx ? { ...item, correctAnswer: optIdx } : item)));
                            }}
                            className={`w-7 h-7 rounded-lg border text-xs font-bold shrink-0 flex items-center justify-center ${
                              q.correctAnswer === optIdx ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'
                            }`}
                            title="Bấm để chọn đáp án đúng"
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </button>
                          <input
                            value={opt}
                            onChange={e => {
                              const val = e.target.value;
                              setQuestions(prev => prev.map((item, idx) => {
                                if (idx !== qIdx) return item;
                                const newOpts = [...item.options];
                                newOpts[optIdx] = val;
                                return { ...item, options: newOpts };
                              }));
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-red-500 bg-white"
                            required
                          />
                        </div>
                      ))}
                    </div>

                    <input
                      value={q.explanation}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map((item, idx) => (idx === qIdx ? { ...item, explanation: val } : item)));
                      }}
                      placeholder="Lời giải thích (không bắt buộc)..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-red-500 text-[11px] bg-white/70"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition shadow-md"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo bài trắc nghiệm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL XEM CHI TIẾT KẾT QUẢ HỌC VIÊN ── */}
      {selectedDetailQuiz && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedDetailQuiz.title}</h3>
                <p className="text-xs text-slate-500">Kết quả làm bài của học viên ({selectedDetailQuiz.submissions?.length || 0} bài)</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailQuiz(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {selectedDetailQuiz.submissions && selectedDetailQuiz.submissions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {selectedDetailQuiz.submissions.map((sub, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{sub.studentName}</p>
                      <p className="text-slate-400 text-[11px]">SĐT: {sub.studentPhone || 'N/A'} · Ngày nộp: {new Date(sub.submittedAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-md font-black text-xs ${
                        sub.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {sub.score}% · {sub.correctCount}/{sub.totalQuestions} câu đúng
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs font-bold text-slate-400">Chưa có học viên nào nộp bài.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
