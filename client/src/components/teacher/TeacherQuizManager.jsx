import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Clock, Calendar, Users, Award, BookOpen, CheckCircle,
  X, HelpCircle, Eye, AlertCircle, RefreshCw, Send, Check, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../utils/toast';

const EMPTY_QUESTION = {
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
};

export default function TeacherQuizManager({
  myStudents = [],
  autoOpenCreate = false,
  createOnly = false,
  presetStudentId = null,
  presetCourseName = '',
  onCreateClose = null,
}) {
  const toast = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(!createOnly);
  const [showCreateModal, setShowCreateModal] = useState(Boolean(autoOpenCreate));
  const [selectedDetailQuiz, setSelectedDetailQuiz] = useState(null);

  // Form tạo bài trắc nghiệm
  const uniqueCourses = [...new Set((myStudents || []).map(s => s.course).filter(Boolean))];

  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState(presetCourseName || uniqueCourses[0] || '');
  const [targetStudentIds, setTargetStudentIds] = useState(
    presetStudentId ? [String(presetStudentId)] : []
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState('trung bình');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [promptError, setPromptError] = useState(false);
  const titleInputRef = useRef(null);

  const [questions, setQuestions] = useState([]);

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
    if (!createOnly) fetchQuizzes();
  }, [createOnly]);

  useEffect(() => {
    if (!autoOpenCreate) return;
    setShowCreateModal(true);
    if (presetCourseName) setCourseName(presetCourseName);
    if (presetStudentId) setTargetStudentIds([String(presetStudentId)]);
  }, [autoOpenCreate, presetCourseName, presetStudentId]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    onCreateClose?.();
  };

  const studentIdOf = (s) => String(s?._id || s?.id || '');

  const studentDisplayName = (s) => {
    const name = s?.displayName || s?.name || '';
    if (name && !/^\d{5,}$/.test(name)) return name;
    return s?.email || s?.phone || `HV-${studentIdOf(s).slice(-4)}`;
  };

  // Lọc HV theo khóa; cùng 1 HV học nhiều môn thì gộp 1 dòng (tên + các môn)
  const pickerStudents = useMemo(() => {
    const map = new Map();
    (myStudents || []).forEach((s) => {
      if (courseName && s.course !== courseName) return;
      const id = studentIdOf(s);
      if (!id) return;
      const existing = map.get(id);
      const course = String(s.course || '').trim();
      if (!existing) {
        map.set(id, { id, name: studentDisplayName(s), courses: course ? [course] : [] });
        return;
      }
      if (course && !existing.courses.includes(course)) existing.courses.push(course);
    });
    return [...map.values()];
  }, [myStudents, courseName]);

  const toggleTargetStudent = (id) => {
    const sid = String(id);
    setTargetStudentIds((prev) => (
      prev.map(String).includes(sid)
        ? prev.filter((x) => String(x) !== sid)
        : [...prev, sid]
    ));
  };

  const selectAllVisibleStudents = () => {
    setTargetStudentIds(pickerStudents.map((s) => s.id));
  };

  const clearTargetStudents = () => setTargetStudentIds([]);

  // Thêm 1 câu hỏi mới
  const addQuestion = () => {
    setQuestions(prev => [...prev, { ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }]);
  };

  const removeQuestion = (index) => {
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

  const handleGenerateAi = async () => {
    const topic = title.trim();
    if (!topic) {
      setPromptError(true);
      toast.warning('Nhập prompt (tên bài kiểm tra) trước khi tạo bằng AI');
      titleInputRef.current?.focus();
      return;
    }
    setPromptError(false);
    setAiGenerating(true);
    try {
      const res = await api.quizzes.generateAi({
        topic,
        courseName,
        count: Number(aiCount) || 10,
        difficulty: aiDifficulty,
      });
      if (!res?.success || !Array.isArray(res.data?.questions) || !res.data.questions.length) {
        toast.error(res?.message || 'AI không tạo được câu hỏi');
        return;
      }
      setQuestions(res.data.questions.map((q) => ({
        questionText: q.questionText || '',
        options: Array.isArray(q.options) && q.options.length >= 4
          ? q.options.slice(0, 4)
          : ['', '', '', ''],
        correctAnswer: Number(q.correctAnswer) || 0,
        explanation: q.explanation || '',
      })));
      if (res.data.source === 'fallback') {
        toast.warning(res.message || 'Đây là câu mẫu — hãy sửa trước khi giao bài');
      } else {
        toast.success(res.message || `Đã soạn ${res.data.questions.length} câu. Kiểm tra rồi bấm Tạo bài.`);
      }
    } catch {
      toast.error('Lỗi kết nối khi gọi AI');
    } finally {
      setAiGenerating(false);
    }
  };

  // Submit tạo bài trắc nghiệm
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.warning('Vui lòng nhập tên bài trắc nghiệm');
    if (questions.length === 0) {
      return toast.warning('Thêm ít nhất 1 câu hỏi trước khi tạo bài');
    }
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
        setTargetStudentIds(presetStudentId ? [String(presetStudentId)] : []);
        setQuestions([]);
        if (!createOnly) fetchQuizzes();
        onCreateClose?.();
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
    <div className={createOnly ? '' : 'space-y-4 w-full'}>
      {!createOnly && (
      <>
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
                      {quiz.targetStudentIds?.length
                        ? `${quiz.targetStudentIds.length} học viên`
                        : (quiz.courseName || 'Tất cả lớp')}
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
      </>
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
                onClick={closeCreateModal}
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
                    ref={titleInputRef}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (promptError) setPromptError(false);
                    }}
                    placeholder="Ví dụ: Trắc nghiệm Buổi 1 - MS Word"
                    className={`w-full px-3 py-2.5 rounded-xl border outline-none font-bold ${
                      promptError
                        ? 'border-red-500 ring-2 ring-red-100'
                        : 'border-slate-200 focus:border-red-500'
                    }`}
                    required
                  />
                  {promptError && (
                    <p className="mt-1.5 text-[11px] text-red-600 font-bold">
                      Bắt buộc nhập prompt trước khi tạo bằng AI.
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-500 font-medium leading-snug">
                    Tên bài cũng là prompt AI. Viết rõ môn + nội dung, ví dụ: Ribbon Word — tab Trang chủ.
                  </p>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Giao cho học viên</label>
                  <select
                    value={courseName}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCourseName(next);
                      const allowed = new Set(
                        (myStudents || [])
                          .filter((s) => !next || s.course === next)
                          .map(studentIdOf)
                          .filter(Boolean)
                      );
                      setTargetStudentIds((prev) => prev.filter((id) => allowed.has(String(id))));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-red-500 font-bold bg-white"
                  >
                    <option value="">-- Lọc tất cả môn --</option>
                    {uniqueCourses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 max-h-40 overflow-y-auto">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50/95 border-b border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold">
                        {targetStudentIds.length > 0
                          ? `Đã chọn ${targetStudentIds.length}/${pickerStudents.length} HV`
                          : `Không chọn = cả lớp đang lọc (${pickerStudents.length} HV)`}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={selectAllVisibleStudents}
                          disabled={pickerStudents.length === 0}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 rounded disabled:opacity-40"
                        >
                          Tất cả
                        </button>
                        <button
                          type="button"
                          onClick={clearTargetStudents}
                          disabled={targetStudentIds.length === 0}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded disabled:opacity-40"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    {pickerStudents.length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-slate-400 font-medium">
                        Chưa có học viên trong bộ lọc này.
                      </p>
                    ) : (
                      <ul className="py-1">
                        {pickerStudents.map((s) => {
                          const checked = targetStudentIds.map(String).includes(s.id);
                          return (
                            <li key={s.id}>
                              <label className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTargetStudent(s.id)}
                                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                                />
                                <span className="font-bold text-slate-800 truncate">{s.name}</span>
                                {s.courses.length > 0 && (
                                  <span className="ml-auto text-[10px] text-slate-400 font-semibold truncate max-w-[45%]">
                                    {s.courses.join(', ')}
                                  </span>
                                )}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
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

              {/* Mẫu nhanh + AI */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
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
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-violet-100 bg-violet-50/60 p-2.5">
                  <div>
                    <label className="block text-violet-700 text-[10px] font-black uppercase mb-1">Số câu AI</label>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      className="px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white text-[11px] font-bold outline-none"
                    >
                      <option value={5}>5 câu</option>
                      <option value={10}>10 câu</option>
                      <option value={15}>15 câu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-violet-700 text-[10px] font-black uppercase mb-1">Độ khó</label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white text-[11px] font-bold outline-none"
                    >
                      <option value="dễ">Dễ</option>
                      <option value="trung bình">Trung bình</option>
                      <option value="khó">Khó</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    disabled={aiGenerating}
                    className="ml-auto px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                  >
                    {aiGenerating ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {aiGenerating ? 'Đang soạn...' : 'Tạo bằng AI (Gemini)'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  AI chỉ điền câu hỏi vào form. Bạn kiểm tra đáp án rồi mới bấm “Tạo bài trắc nghiệm”.
                </p>
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

                {questions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-sm font-bold text-slate-600">Chưa có câu hỏi</p>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Thêm câu mới, nạp mẫu Word/Excel, hoặc dùng AI trước khi tạo bài.
                    </p>
                  </div>
                )}

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 text-xs">Câu hỏi số {qIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIdx)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Xóa câu
                      </button>
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
                  onClick={closeCreateModal}
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
      {!createOnly && selectedDetailQuiz && (
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
                  <div key={idx} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{sub.studentName}</p>
                      <p className="text-slate-400 text-[11px]">
                        SĐT: {sub.studentPhone || 'N/A'} · Ngày nộp: {new Date(sub.submittedAt).toLocaleDateString('vi-VN')}
                      </p>
                      {sub.forfeit && (
                        <p className="text-red-600 text-[11px] font-bold mt-0.5">
                          Rớt do thoát giữa giờ{sub.exitReason ? ` · ${sub.exitReason}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded-md font-black text-xs ${
                        sub.forfeit || sub.status !== 'passed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {sub.forfeit
                          ? 'RỚT · Thoát'
                          : `${sub.score}% · ${sub.correctCount}/${sub.totalQuestions} câu đúng`}
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
