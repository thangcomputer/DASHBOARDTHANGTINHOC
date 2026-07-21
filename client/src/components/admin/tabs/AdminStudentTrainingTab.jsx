import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  BookOpen, Video, Download, HelpCircle, Trophy, Plus, Clock, Trash2,
  FileSpreadsheet, Edit3, X, Upload, Loader2, FileText, Save, Search,
  CheckCircle2, XCircle, Layers,
} from 'lucide-react';
import AdminCourseBuilder from '../../AdminCourseBuilder';
import RichTextEditor from '../shared/RichTextEditor';
import { trainingUploadDisplayName } from '../utils/trainingUpload';
import {
  downloadStudentQuestionsExcelTemplate,
} from '../../../utils/studentQuestionsExcel';
import { getStudentMcQuestionsForExam } from '../../../utils/htmlContent';

export default function AdminStudentTrainingTab() {
  const {
    sCourseBuilderMode, setSCourseBuilderMode, updateStudentTrainingItem,
    studentTrainingData, sTrainingTab, setSTrainingTab, setSTrainingForm,
    students, studentQuestions, studentExamMinutes, updateStudentExamMinutes,
    showGlobalModal, resetStudentQuestions, setSqForm, BLANK_Q,
    studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,
    sTrainingForm, sTrainingFileUploading, handleTrainingDocUpload,
    addStudentTrainingItem, erSearch, setErSearch, gradingRow, setGradingRow,
    gradingValue, setGradingValue, ctxUpdateStudent, toast, addNotification,
    sqSection, setSqSection, sqSearch, setSqSearch, removeStudentQuestion,
    removeStudentTrainingItem, sqForm, updateStudentQuestion, addStudentQuestion,
    erForm, setErForm, safeStudentsList, updateExamResult, addExamResult,
  } = useAdminTab();

  return (
    <>
            <div className="space-y-6">
              {sCourseBuilderMode ? (
                <AdminCourseBuilder
                  course={sCourseBuilderMode}
                  onBack={() => setSCourseBuilderMode(null)}
                  onSave={(updatedCourse) => {
                    updateStudentTrainingItem('videos', sCourseBuilderMode.id, updatedCourse);
                    setSCourseBuilderMode(null);
                  }}
                />
              ) : (
              <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen size={20} className="text-green-600" /> Quản lý Đào tạo Học viên
                </h2>
              </div>

              {/* Sub-tabs */}
              <div className="flex flex-wrap gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 w-fit">
                {[
                  { key: 'videos', icon: Video, label: 'Quản lý Khóa học', count: studentTrainingData?.videos?.length || 0 },
                  
                  { key: 'files', icon: Download, label: 'Tài liệu', count: studentTrainingData?.files?.length || 0 },
                  { key: 'questions', icon: HelpCircle, label: 'Ngân hàng câu hỏi', count: studentQuestions?.length || 0 },
                  { key: 'exam-results', icon: Trophy, label: 'Kết quả thi', count: (students || []).reduce((acc, s) => acc + (s.examProgress || []).filter(ep => ep.status && ep.status !== 'chua_thi').length, 0) },
                ].map(t => (
                  <button key={t.key} onClick={() => { setSTrainingTab(t.key); setSTrainingForm(null); setSCourseBuilderMode(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      sTrainingTab === t.key
                        ? t.key === 'exam-results' ? 'bg-amber-600 text-white shadow-md' : 'bg-green-600 text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}>
                    <t.icon size={15} /> {t.label} <span className="text-xs opacity-70">({t.count})</span>
                  </button>
                ))}
              </div>
              {sTrainingTab === 'questions' && (
                <div className="space-y-3 max-w-4xl">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Học viên đọc đúng <strong className="text-gray-700">danh sách câu trong ngân hàng này</strong> (mục Ôn tập và phòng thi dùng chung một danh sách).
                    Phần <strong className="text-gray-700">Máy tính &amp; Windows</strong> khi thi môn <strong className="text-gray-700">Cơ bản</strong> được khớp tự động.
                  </p>
                  <p className="text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold text-gray-800">Tổng: {studentQuestions?.length || 0} câu</span>
                    <span className="text-gray-300">|</span>
                    <span className="flex flex-wrap gap-x-2 gap-y-1">
                      {[
                        { id: 'coban', label: 'Cơ bản' },
                        { id: 'word', label: 'Word' },
                        { id: 'excel', label: 'Excel' },
                        { id: 'powerpoint', label: 'PowerPoint' },
                      ].map((s) => (
                        <span key={s.id} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg font-semibold">
                          {s.label}: {getStudentMcQuestionsForExam(studentQuestions, s.id).length} TN
                        </span>
                      ))}
                    </span>
                  </p>
                  <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-3">
                      <Clock size={18} /> Thời gian làm trắc nghiệm (phút)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { key: 'coban', label: 'Máy tính (Cơ bản)' },
                        { key: 'word', label: 'Microsoft Word' },
                        { key: 'excel', label: 'Microsoft Excel' },
                        { key: 'powerpoint', label: 'Microsoft PowerPoint' },
                      ].map((row) => (
                        <label key={row.key} className="flex flex-col gap-1 text-xs font-bold text-gray-600">
                          {row.label}
                          <input
                            type="number"
                            min={1}
                            max={600}
                            value={studentExamMinutes?.[row.key] ?? 90}
                            onChange={(e) => updateStudentExamMinutes({ [row.key]: e.target.value })}
                            className="border-2 border-amber-100 rounded-xl px-3 py-2 text-sm font-black text-gray-800 outline-none focus:border-amber-400"
                          />
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-amber-800/80 mt-2">Giới hạn 1–600 phút. Học viên vào thi sẽ thấy đếm ngược theo số phút đã cấu hình.</p>
                  </div>
                </div>
              )}

              {/* Add button */}
              {sTrainingTab !== 'questions' && sTrainingTab !== 'exam-results' && (
                <button onClick={() => { setSCourseBuilderMode(null); setSTrainingForm({}); }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2">
                  <Plus size={15} /> {sTrainingTab === 'videos' ? 'Thêm Khóa học' : 'Thêm tài liệu'}
                </button>
              )}
              {sTrainingTab === 'questions' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      showGlobalModal({
                        title: 'Xóa toàn bộ ngân hàng câu hỏi học viên?',
                        content:
                          'Toàn bộ câu trắc nghiệm và câu tự luận trong ngân hàng học viên sẽ bị xóa. Thao tác không thể hoàn tác.',
                        type: 'warning',
                        confirmText: 'Xóa toàn bộ',
                        cancelText: 'Huỷ bỏ',
                        onConfirm: () => resetStudentQuestions(),
                      });
                    }}
                    className="px-3 py-2.5 border-2 border-amber-200 text-amber-800 bg-amber-50/80 rounded-xl text-sm font-bold hover:bg-amber-100 flex items-center gap-2"
                  >
                    <Trash2 size={15} /> Xóa toàn bộ (TN & tự luận)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSqForm({ ...BLANK_Q })}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2"
                  >
                    <Plus size={15} /> Thêm câu hỏi
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadStudentQuestionsExcelTemplate()}
                    className="bg-white border-2 border-green-600 text-green-700 hover:bg-green-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
                  >
                    <Download size={15} /> Tải mẫu Excel
                  </button>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-dashed border-green-400 bg-green-50/60 text-green-800 hover:bg-green-100 cursor-pointer transition">
                    <FileSpreadsheet size={15} /> Nhập từ Excel
                    <input
                      ref={studentQuestionsExcelInputRef}
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="hidden"
                      onChange={handleStudentQuestionsExcelFile}
                    />
                  </label>
                </div>
              )}
              {/* Kết quả thi tự động từ bài thi của học viên - không cần thêm thủ công */}

              {/* Add/Edit Form */}
              {sTrainingForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-green-700 flex items-center gap-2">
                      <Edit3 size={16} /> {sTrainingForm.id ? 'Chỉnh sửa' : 'Thêm mới'}
                    </h3>
                    <button onClick={() => setSTrainingForm(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sTrainingTab !== 'files' && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tiêu đề</label>
                      <input value={sTrainingForm.title || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, title: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="Nhập tiêu đề..." />
                    </div>
                    )}
                    {sTrainingTab === 'videos' && (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mô tả Khóa học (Tóm tắt)</label>
                        <input value={sTrainingForm.desc || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, desc: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="Nhập mô tả tóm tắt..." />
                      </div>
                    )}

                    {sTrainingTab === 'files' && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tiêu đề</label>
                          <input value={sTrainingForm.title || ''} onChange={e => setSTrainingForm({ ...sTrainingForm, title: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none" placeholder="Nhập tiêu đề..." />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tải tệp</label>
                          <div className="flex flex-wrap items-center gap-2 min-h-[46px]">
                            <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-green-300 bg-green-50/50 text-green-800 text-xs font-black uppercase tracking-wide cursor-pointer hover:bg-green-100 transition-colors shrink-0 ${sTrainingFileUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                              {sTrainingFileUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                              {sTrainingFileUploading ? 'Đang tải...' : 'TẢI FILE'}
                              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar" onChange={(e) => handleTrainingDocUpload(e, 'student')} />
                            </label>
                            {sTrainingForm.fileUrl && (
                              <a
                                href={sTrainingForm.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 max-w-[min(100%,14rem)] px-3 py-2 rounded-xl bg-green-100/80 border border-green-200 text-green-900 text-xs font-bold hover:bg-green-200/80 transition-colors truncate"
                                title={trainingUploadDisplayName(sTrainingForm.fileUrl, sTrainingForm.fileOriginalName)}
                              >
                                <FileText size={16} className="shrink-0 text-green-600" />
                                <span className="truncate">{trainingUploadDisplayName(sTrainingForm.fileUrl, sTrainingForm.fileOriginalName)}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Mô tả - Rich Text Editor */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nội dung (có định dạng)</label>
                    <RichTextEditor
                      value={sTrainingForm.desc || ''}
                      onChange={(val) => setSTrainingForm(prev => ({ ...prev, desc: val }))}
                      placeholder="Nhập nội dung mô tả chi tiết..."
                    />
                  </div>
                  <button onClick={() => {
                    if (!sTrainingForm.title?.trim()) { 
                        showGlobalModal({ title: 'Thiếu thông tin', content: 'Vui lòng nhập tiêu đề tài liệu!', type: 'warning' });
                        return; 
                    }
                    const sTrainingPayload = sTrainingTab === 'files'
                      ? { ...sTrainingForm, fileType: sTrainingForm.fileType || 'PDF' }
                      : sTrainingForm;
                    if (sTrainingForm.id) {
                      updateStudentTrainingItem(sTrainingTab, sTrainingForm.id, sTrainingPayload);
                    } else {
                      addStudentTrainingItem(sTrainingTab, { ...sTrainingPayload, createdAt: new Date().toISOString().split('T')[0] });
                    }
                    setSTrainingForm(null);
                  }} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2">
                    <Save size={15} /> {sTrainingForm.id ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              )}

              {/* ===== EXAM RESULTS TAB - ĐỌC TỪ students.examProgress ===== */}
              {sTrainingTab === 'exam-results' && (() => {
                const SUBJECT_LABELS = { coban: 'Máy vi tính (Cơ bản)', word: 'Microsoft Word', excel: 'Microsoft Excel', powerpoint: 'Microsoft PowerPoint' };
                // Flatten all students' examProgress into rows
                const allRows = (students || []).flatMap(s => 
                  (s.examProgress || [])
                    .filter(ep => ep.status && ep.status !== 'chua_thi')
                    .map(ep => ({
                      studentId: s._id || s.id,
                      studentName: s.name,
                      course: s.course,
                      subjectId: ep.id,
                      subjectLabel: SUBJECT_LABELS[ep.id] || ep.id,
                      score: ep.tracNghiem?.score ?? 0,
                      total: ep.tracNghiem?.total ?? 15,
                      thucHanh: ep.thucHanh || 'chua_nop',
                      essayFile: ep.essayFile || '',
                      essayScore: ep.essayScore ?? null,
                      status: ep.status,
                      lockUntil: ep.lockUntil,
                    }))
                );
                const filtered = allRows.filter(r => 
                  !erSearch || r.studentName?.toLowerCase().includes(erSearch.toLowerCase())
                );

                // Helper: save essay score to student's examProgress
                const saveEssayScore = async (studentId, subjectId, newScore) => {
                  const student = (students || []).find(s => (s._id || s.id) === studentId);
                  if (!student) return;
                  const progress = (student.examProgress || []).map(ep => ({...ep}));
                  const idx = progress.findIndex(ep => ep.id === subjectId);
                  if (idx === -1) return;
                  progress[idx].essayScore = newScore;
                  const subjectLabel = SUBJECT_LABELS[subjectId] || subjectId;
                  // Nếu trắc nghiệm đạt >= 50% VÀ tự luận >= 5 => đạt, nếu < 5 => rớt + khóa 7 ngày
                  const tn = progress[idx].tracNghiem;
                  const tnPct = tn ? Math.round((tn.score / tn.total) * 100) : 0;
                  let finalResult = null;
                  if (tnPct >= 50 && progress[idx].thucHanh === 'da_nop') {
                    if (newScore >= 5) {
                      progress[idx].status = 'dat';
                      progress[idx].lockUntil = null;
                      finalResult = 'dat';
                    } else {
                      progress[idx].status = 'khong_dat';
                      progress[idx].lockUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
                      finalResult = 'khong_dat';
                    }
                  }
                  try {
                    await ctxUpdateStudent(studentId, { examProgress: progress });
                    toast.success(`Đã chấm ${newScore}/10 điểm tự luận cho ${student.name}!`);
                    // 🔔 Thông báo cho học viên
                    addNotification(studentId, 'student', `📝 Bài thực hành môn ${subjectLabel} đã được chấm: ${newScore}/10 điểm.`);
                    if (finalResult === 'dat') {
                      addNotification(studentId, 'student', `🎉 Chúc mừng! Bạn đã ĐẠT môn ${subjectLabel}!`);
                    } else if (finalResult === 'khong_dat') {
                      addNotification(studentId, 'student', `❌ Bạn CHƯA ĐẠT môn ${subjectLabel}. Môn thi sẽ bị khóa 7 ngày trước khi thi lại.`);
                    }
                  } catch (err) {
                    toast.error('Lỗi khi lưu điểm!');
                  }
                };

                return (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={erSearch} onChange={e => setErSearch(e.target.value)}
                        className="pl-8 pr-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 outline-none w-56"
                        placeholder="Tìm theo tên học viên..." />
                    </div>
                    <span className="text-xs text-gray-400 font-bold ml-auto">
                      {filtered.length} bản ghi
                    </span>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="cms-table-wrap">
                      <table className="w-full text-left border-collapse min-w-[1050px]">
                        <thead>
                          <tr className="bg-amber-50 border-b border-amber-100">
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest">Học viên</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest">Khóa học</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest">Môn thi</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest text-center">Trắc nghiệm</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest text-center">Tự luận (File)</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest text-center">Chấm điểm TL</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest text-center">Trạng thái</th>
                            <th className="px-4 py-3 text-xs font-black text-amber-700 uppercase tracking-widest text-center">Khóa đến</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filtered.map((r, idx) => {
                            const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
                            const isLocked = r.lockUntil && r.lockUntil > Date.now();
                            const tnPass = pct >= 50;
                            // Trạng thái tổng hợp: TN đạt + TL đã nộp + chấm >= 5 => ĐẠT
                            const finalStatus = !tnPass ? 'khong_dat'
                              : r.thucHanh !== 'da_nop' ? r.status
                              : r.essayScore === null ? 'cho_cham' // chờ chấm
                              : r.essayScore >= 5 ? 'dat' : 'khong_dat';
                            return (
                              <tr key={`${r.studentId}-${r.subjectId}`} className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white text-xs font-black">
                                      {(r.studentName || '?')[0]}
                                    </div>
                                    <span className="font-bold text-sm text-gray-800">{r.studentName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-semibold text-gray-500">{r.course}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-bold text-gray-700">{r.subjectLabel}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`text-lg font-black ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{r.score}/{r.total}</span>
                                    <span className="text-xs cms-min-text-xs text-gray-400 font-bold">{pct}%</span>
                                  </div>
                                </td>
                                {/* Cột Tự luận: Chưa nộp / Nút tải xuống */}
                                <td className="px-4 py-3 text-center">
                                  {r.thucHanh === 'da_nop' ? (
                                    r.essayFile ? (
                                      <a href={r.essayFile.startsWith('http') ? r.essayFile : `${import.meta.env.VITE_API_URL || ""}${r.essayFile}`} 
                                         target="_blank" rel="noopener noreferrer"
                                         className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-black transition border border-blue-200">
                                        <Download size={12} /> Tải bài
                                      </a>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1 max-w-[200px] mx-auto">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-green-50 text-green-700 border border-green-200">
                                          ✅ Đã nộp
                                        </span>
                                        <span className="text-xs cms-min-text-xs text-amber-700 font-semibold leading-tight text-center">
                                          Không có file — HV cần nộp lại phần tự luận để lưu bài.
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-gray-50 text-gray-400 border border-gray-200">
                                      ⏳ Chưa nộp
                                    </span>
                                  )}
                                </td>
                                {/* Cột Chấm điểm Tự luận (0-10) — INLINE INPUT */}
                                <td className="px-4 py-3 text-center">
                                  {r.thucHanh === 'da_nop' ? (() => {
                                    const rowKey = `${r.studentId}-${r.subjectId}`;
                                    const isGrading = gradingRow === rowKey;
                                    if (r.essayScore !== null && !isGrading) {
                                      // Đã chấm: hiện điểm + nút chấm lại
                                      return (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className={`text-lg font-black ${r.essayScore >= 5 ? 'text-green-600' : 'text-red-500'}`}>
                                            {r.essayScore}/10
                                          </span>
                                          <button onClick={() => { setGradingRow(rowKey); setGradingValue(String(r.essayScore)); }}
                                            className="text-xs cms-min-text-xs text-blue-500 hover:text-blue-700 font-bold cursor-pointer">
                                            Chấm lại
                                          </button>
                                        </div>
                                      );
                                    }
                                    if (isGrading) {
                                      // Đang nhập điểm inline
                                      return (
                                        <div className="flex items-center gap-1.5 justify-center">
                                          <input
                                            type="number" min="0" max="10" step="0.5"
                                            value={gradingValue}
                                            onChange={e => setGradingValue(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter' && gradingValue !== '' && !isNaN(gradingValue)) {
                                                saveEssayScore(r.studentId, r.subjectId, Math.min(10, Math.max(0, Number(gradingValue))));
                                                setGradingRow(null); setGradingValue('');
                                              }
                                              if (e.key === 'Escape') { setGradingRow(null); setGradingValue(''); }
                                            }}
                                            autoFocus
                                            className="w-14 px-2 py-1.5 border-2 border-amber-400 rounded-lg text-center text-sm font-black outline-none focus:border-amber-600 bg-amber-50"
                                            placeholder="0-10"
                                          />
                                          <button onClick={() => {
                                            if (gradingValue !== '' && !isNaN(gradingValue)) {
                                              saveEssayScore(r.studentId, r.subjectId, Math.min(10, Math.max(0, Number(gradingValue))));
                                              setGradingRow(null); setGradingValue('');
                                            }
                                          }} className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition" title="Lưu điểm">
                                            <CheckCircle2 size={14} />
                                          </button>
                                          <button onClick={() => { setGradingRow(null); setGradingValue(''); }}
                                            className="p-1.5 bg-gray-200 text-gray-500 rounded-lg hover:bg-gray-300 transition" title="Huỷ">
                                            <X size={14} />
                                          </button>
                                        </div>
                                      );
                                    }
                                    // Chưa chấm: nút bấm để mở input
                                    return (
                                      <button onClick={() => { setGradingRow(rowKey); setGradingValue(''); }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg text-xs font-black transition border border-amber-300">
                                        ✏️ Chấm điểm
                                      </button>
                                    );
                                  })() : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                                {/* Trạng thái tổng hợp */}
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black ${
                                    finalStatus === 'dat' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : finalStatus === 'khong_dat' ? 'bg-red-50 text-red-600 border border-red-200'
                                    : finalStatus === 'cho_cham' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : finalStatus === 'dang_thi' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                                  }`}>
                                    {finalStatus === 'dat' && <><CheckCircle2 size={11} /> ĐẠT</>}
                                    {finalStatus === 'khong_dat' && <><XCircle size={11} /> RỚT</>}
                                    {finalStatus === 'dang_thi' && '⏳ ĐANG THI'}
                                    {finalStatus === 'cho_cham' && '📝 CHỜ CHẤM'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isLocked ? (
                                    <div className="group relative inline-flex flex-col items-center cursor-pointer">
                                      <span className="text-xs font-bold text-red-500 group-hover:opacity-30 transition-opacity">
                                        🔒 {new Date(r.lockUntil).toLocaleDateString('vi-VN')}
                                      </span>
                                      <button
                                        onClick={() => {
                                          showGlobalModal({
                                            title: 'Mở khóa cho học viên thi lại?',
                                            content: `Bạn có chắc muốn mở khóa môn "${r.subjectLabel}" cho học viên ${r.studentName}? Học viên sẽ được phép thi lại ngay lập tức.`,
                                            type: 'question',
                                            confirmText: 'Mở khóa',
                                            cancelText: 'Huỷ',
                                            onConfirm: async () => {
                                              const student = (students || []).find(s => (s._id || s.id) === r.studentId);
                                              if (!student) return;
                                              const progress = (student.examProgress || []).map(ep => ({...ep}));
                                              const epIdx = progress.findIndex(ep => ep.id === r.subjectId);
                                              if (epIdx === -1) return;
                                              // Xóa khóa + reset trạng thái để thi lại
                                              progress[epIdx].attemptCount = (progress[epIdx].attemptCount || 0) + 1;
                                              progress[epIdx].lockUntil = null;
                                              progress[epIdx].status = 'chua_thi';
                                              progress[epIdx].tracNghiem = null;
                                              progress[epIdx].thucHanh = 'chua_nop';
                                              progress[epIdx].essayScore = null;
                                              progress[epIdx].essayFile = null;
                                              try {
                                                await ctxUpdateStudent(r.studentId, { examProgress: progress });
                                                toast.success(`Đã mở khóa "${r.subjectLabel}" cho ${r.studentName}. Học viên có thể thi lại!`);
                                                // 🔔 Thông báo cho học viên
                                                addNotification(r.studentId, 'student', `🔓 Môn ${r.subjectLabel} đã được mở khóa! Bạn có thể thi lại ngay bây giờ.`);
                                              } catch (err) {
                                                toast.error('Lỗi khi mở khóa!');
                                              }
                                            }
                                          });
                                        }}
                                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                                      >
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-black shadow-lg hover:bg-blue-700 transition whitespace-nowrap">
                                          🔓 Mở khóa thi lại
                                        </span>
                                      </button>
                                    </div>
                                  ) : r.status === 'khong_dat' ? (
                                    <button
                                      onClick={() => {
                                        showGlobalModal({
                                          title: 'Cho học viên thi lại?',
                                          content: `Bạn có chắc muốn reset môn "${r.subjectLabel}" cho học viên ${r.studentName}? Học viên sẽ được phép thi lại.`,
                                          type: 'question',
                                          confirmText: 'Cho thi lại',
                                          cancelText: 'Huỷ',
                                          onConfirm: async () => {
                                            const student = (students || []).find(s => (s._id || s.id) === r.studentId);
                                            if (!student) return;
                                            const progress = (student.examProgress || []).map(ep => ({...ep}));
                                            const epIdx = progress.findIndex(ep => ep.id === r.subjectId);
                                            if (epIdx === -1) return;
                                            progress[epIdx].attemptCount = (progress[epIdx].attemptCount || 0) + 1;
                                            progress[epIdx].lockUntil = null;
                                            progress[epIdx].status = 'chua_thi';
                                            progress[epIdx].tracNghiem = null;
                                            progress[epIdx].thucHanh = 'chua_nop';
                                            progress[epIdx].essayScore = null;
                                            progress[epIdx].essayFile = null;
                                            try {
                                              await ctxUpdateStudent(r.studentId, { examProgress: progress });
                                              toast.success(`Đã mở cho ${r.studentName} thi lại "${r.subjectLabel}"!`);
                                              // 🔔 Thông báo cho học viên
                                              addNotification(r.studentId, 'student', `🔓 Môn ${r.subjectLabel} đã được cấp quyền thi lại! Bạn có thể vào thi ngay.`);
                                            } catch (err) {
                                              toast.error('Lỗi khi reset bài thi!');
                                            }
                                          }
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition border border-blue-200"
                                    >
                                      🔓 Cho thi lại
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan="8" className="px-6 py-14 text-center text-gray-400">
                                <Trophy size={36} className="mx-auto mb-3 text-gray-200" />
                                <p className="text-sm font-bold">Chưa có kết quả thi nào</p>
                                <p className="text-xs text-gray-300 mt-1">Khi học viên hoàn thành bài thi, kết quả sẽ tự động hiện tại đây</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* List items (training content) */}
              {sTrainingTab !== 'exam-results' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {sTrainingTab === 'questions' ? (
                    (() => {
                      const SECTION_OPTS = [
                        { value: 'excel', label: 'Microsoft Excel' },
                        { value: 'word', label: 'Microsoft Word' },
                        { value: 'powerpoint', label: 'Microsoft PowerPoint' },
                        { value: 'computer', label: 'Máy tính & Windows (thi Cơ bản)' },
                        { value: 'situation', label: 'Tình Huống Sư Phạm' },
                        { value: 'other', label: 'Kiến thức Khác' },
                      ];
                      const filtered = (studentQuestions || []).filter(q => {
                        const matchS = sqSection === 'all' || q.section === sqSection;
                        const matchQ = !sqSearch || q.q.toLowerCase().includes(sqSearch.toLowerCase());
                        return matchS && matchQ;
                      });

                      return (
                        <div className="p-4 space-y-4">
                          <div className="flex flex-wrap gap-2 mb-4">
                            <select value={sqSection} onChange={e => setSqSection(e.target.value)} className="border-2 border-gray-100 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-green-500 outline-none">
                              <option value="all">Tất cả phần</option>
                              {SECTION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <div className="relative flex-1 min-w-[200px]">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                              <input type="text" value={sqSearch} onChange={e => setSqSearch(e.target.value)} placeholder="Tìm câu hỏi học viên..." className="w-full pl-9 pr-4 py-1.5 border-2 border-gray-100 rounded-xl text-xs focus:border-green-500 outline-none" />
                            </div>
                          </div>

                          <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                            {filtered.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Trống</p> : filtered.map((q, idx) => {
                              const sOpt = SECTION_OPTS.find(s => s.value === q.section);
                              const colors = { excel: 'bg-green-100 text-green-700', word: 'bg-blue-100 text-blue-700', powerpoint: 'bg-orange-100 text-orange-700', computer: 'bg-indigo-100 text-indigo-700', situation: 'bg-purple-100 text-green-700', other: 'bg-gray-100 text-gray-700' };
                              return (
                                <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-black text-gray-400 flex-shrink-0 mt-0.5">{idx + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${colors[q.section] || 'bg-gray-100 text-gray-500'}`}>{sOpt?.label}</span>
                                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${q.type === 'essay' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>{q.type === 'essay' ? 'TỰ LUẬN' : 'TRẮC NGHIỆM'}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">{q.q}</p>
                                    {q.type === 'essay' && q.attachedFile && (
                                      <div className="mt-1 text-xs font-bold text-green-600 flex items-center gap-1"><Download size={12} /> {q.attachedFile}</div>
                                    )}
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => setSqForm({ ...q })} className="p-2 rounded-lg bg-blue-50 text-blue-600"><Edit3 size={13} /></button>
                                    <button onClick={() => { 
                                      showGlobalModal({
                                        title: 'Xoá câu hỏi dành cho học viên?',
                                        content: 'Câu hỏi này sẽ bị xoá khỏi bộ đề thi của học viên.',
                                        type: 'warning',
                                        confirmText: 'Xoá',
                                        cancelText: 'Huỷ',
                                        onConfirm: () => removeStudentQuestion(q.id)
                                      });
                                    }} className="p-2 rounded-lg bg-red-50 text-red-500"><Trash2 size={13} /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    (studentTrainingData?.[sTrainingTab] || []).map(item => (
                      <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          {sTrainingTab === 'videos' && (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition" onClick={() => setSCourseBuilderMode(item)}>
                              <BookOpen size={20} className="text-white" />
                            </div>
                          )}

                          {sTrainingTab === 'files' && (
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-sm ${item.fileType === 'PDF' ? 'bg-red-500' : item.fileType === 'PPTX' ? 'bg-orange-500' : 'bg-green-500'
                              }`}>
                              {item.fileType || 'FILE'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{item.title}</p>
                            <p className="text-xs text-gray-400 truncate">{(item.desc?.replace(/<[^>]*>/g, '') || '').slice(0, 80)}</p>
                            {item.duration && <p className="text-xs text-green-500 mt-0.5">⏱ {item.duration}</p>}
                            {item.fileSize && <p className="text-xs text-gray-400 mt-0.5">{item.fileSize}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-3 flex-shrink-0 items-center">
                          {sTrainingTab === 'videos' && (
                             <button onClick={() => setSCourseBuilderMode(item)} className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 hover:bg-green-100 text-green-600 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5">
                               <Layers size={13} /> Giáo trình
                             </button>
                          )}
                          <button onClick={() => setSTrainingForm({ ...item })}
                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"><Edit3 size={14} /></button>
                          <button onClick={() => {
                            showGlobalModal({
                              title: 'Xác nhận xoá tài liệu',
                              content: `Bạn có chắc muốn xoá tài liệu "${item.title}" dành cho học viên không?`,
                              type: 'warning',
                              confirmText: 'Xoá vĩnh viễn',
                              cancelText: 'Huỷ bỏ',
                              onConfirm: () => removeStudentTrainingItem(sTrainingTab, item.id)
                            });
                          }} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))
                  )}
                  {sTrainingTab !== 'questions' && (studentTrainingData?.[sTrainingTab] || []).length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Chưa có nội dung nào</p>
                      <p className="text-xs text-gray-300 mt-1">Bấm "Thêm" để tạo nội dung đào tạo cho học viên</p>
                    </div>
                  )}
                 </div>
              )}

              {/* Student Question Form Modal */}
              {sqForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                  <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                    <div className="bg-gradient-to-r from-green-600 to-green-500 px-8 py-5 flex items-center justify-between text-white">
                      <h3 className="font-bold text-lg flex items-center gap-3">
                        <HelpCircle size={24} /> {sqForm.id ? 'Sửa câu hỏi học viên' : 'Thêm câu hỏi học viên mới'}
                      </h3>
                      <button onClick={() => setSqForm(null)} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                    </div>
                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar text-left text-gray-800">
                      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                        <button onClick={() => setSqForm({ ...sqForm, type: 'multiple' })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${sqForm.type === 'multiple' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Trắc nghiệm</button>
                        <button onClick={() => setSqForm({ ...sqForm, type: 'essay' })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${sqForm.type === 'essay' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Tự luận</button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Phần thi</label>
                          <select value={sqForm.section} onChange={e => setSqForm({ ...sqForm, section: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-green-500 outline-none text-sm font-bold">
                            <option value="excel">Microsoft Excel</option>
                            <option value="word">Microsoft Word</option>
                            <option value="powerpoint">Microsoft PowerPoint</option>
                            <option value="computer">Máy tính & Windows (thi Cơ bản)</option>
                            <option value="situation">Tình Huống Sư Phạm</option>
                            <option value="other">Kiến thức Khác</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Độ khó</label>
                          <select value={sqForm.difficulty} onChange={e => setSqForm({ ...sqForm, difficulty: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-green-500 outline-none text-sm font-bold">
                            <option value="easy">Cơ bản</option>
                            <option value="medium">Trung bình</option>
                            <option value="hard">Nâng cao</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Câu hỏi</label>
                        <textarea value={sqForm.q} onChange={e => setSqForm({ ...sqForm, q: e.target.value })}
                          rows={3} className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-green-500 outline-none text-sm resize-none" placeholder="Nhập nội dung câu hỏi..." />
                      </div>
                      {sqForm.type === 'multiple' ? (
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Đáp án (Chọn để đánh dấu câu đúng)</label>
                          <div className="space-y-2">
                            {(sqForm.options || ['', '', '', '']).map((opt, i) => (
                              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border-2 transition ${sqForm.correct === i ? 'border-green-400 bg-green-50' : 'border-gray-100'}`}>
                                <button onClick={() => setSqForm({ ...sqForm, correct: i })} className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black transition ${sqForm.correct === i ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{['A', 'B', 'C', 'D'][i]}</button>
                                <input value={opt} onChange={e => { const o = [...(sqForm.options || [])]; o[i] = e.target.value; setSqForm({ ...sqForm, options: o }); }} className="flex-1 bg-transparent outline-none text-sm" placeholder={`Đáp án ${['A', 'B', 'C', 'D'][i]}...`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Gợi ý đáp án / Nội dung mẫu</label>
                            <textarea value={sqForm.sampleAnswer || ''} onChange={e => setSqForm({ ...sqForm, sampleAnswer: e.target.value })} rows={3} className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-sm resize-none" placeholder="Nhập nội dung gợi ý..." />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Đính kèm tài liệu (Nếu có)</label>
                            <div className="flex items-center gap-3">
                              <label className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition cursor-pointer flex flex-col items-center justify-center text-center">
                                <input type="file" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) setSqForm({ ...sqForm, attachedFile: f.name }); }} />
                                {sqForm.attachedFile ? <span className="text-green-600 font-bold text-sm flex items-center gap-2"><FileText size={16} /> {sqForm.attachedFile}</span> : <span className="text-gray-400 text-xs py-1">Nhấn để chọn file...</span>}
                              </label>
                              {sqForm.attachedFile && <button onClick={() => setSqForm({ ...sqForm, attachedFile: null })} className="p-2 text-red-500 bg-red-50 rounded-lg"><X size={16} /></button>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                      <button onClick={() => setSqForm(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600">Huỷ</button>
                      <button onClick={() => {
                        if (!sqForm.q?.trim()) { toast.error('Vui lòng nhập câu hỏi!'); return; }
                        if (sqForm.type === 'multiple' && (sqForm.options || []).filter(o => o?.trim()).length < 2) { toast.error('Cần ít nhất 2 đáp án!'); return; }
                        try {
                          if (sqForm.id) { updateStudentQuestion(sqForm.id, sqForm); toast.success('Đã cập nhật câu hỏi học viên!'); }
                          else { addStudentQuestion({ ...sqForm, createdAt: Date.now() }); toast.success('Đã thêm câu hỏi học viên mới!'); }
                          setSqForm(null);
                        } catch (err) { toast.error('Lỗi khi lưu!'); }
                      }} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                        <Save size={16} /> Lưu câu hỏi
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
            )}
            </div>

          {erForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-8 py-5 flex items-center justify-between text-white">
                  <h3 className="font-bold text-lg flex items-center gap-3">
                    <Trophy size={22} /> {erForm.id ? 'Chỉnh sửa / Chấm điểm' : 'Thêm kết quả thi mới'}
                  </h3>
                  <button onClick={() => setErForm(null)} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* Chọn học viên */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Học viên</label>
                      <select
                        value={erForm.studentId || ''}
                        onChange={e => {
                          const s = safeStudentsList.find(x => String(x.id) === e.target.value || String(x._id) === e.target.value);
                          setErForm({ ...erForm, studentId: e.target.value, studentName: s?.name || '' });
                        }}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-amber-500 outline-none text-sm font-bold"
                      >
                        <option value="">-- Chọn học viên --</option>
                        {safeStudentsList.map(s => (
                          <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Môn / Khóa học thi</label>
                      <select value={erForm.subject || ''} onChange={e => setErForm({ ...erForm, subject: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-amber-500 outline-none text-sm font-bold">
                        <option value="THVP NÂNG CAO (12 BUỔI)">THVP NÂNG CAO (12 BUỔI)</option>
                        <option value="MOS EXCEL CHUYÊN SÂU (10 BUỔI)">MOS EXCEL CHUYÊN SÂU (10 BUỔI)</option>
                        <option value="THIẾT KẾ ĐỒ HỌA CƠ BẢN">THIẾT KẾ ĐỒ HỌA CƠ BẢN</option>
                        <option value="AUTOCAD 2D - 3D (15 BUỔI)">AUTOCAD 2D - 3D (15 BUỔI)</option>
                        <option value="LẬP TRÌNH PYTHON CƠ BẢN">LẬP TRÌNH PYTHON CƠ BẢN</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  </div>

                  {/* Trắc nghiệm */}
                  <div className="bg-blue-50 rounded-2xl p-4 space-y-3 border border-blue-100">
                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest">📝 Phần Trắc nghiệm</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Số câu đúng</label>
                        <input type="number" min="0"
                          value={erForm.multipleChoiceCorrect || ''}
                          onChange={e => setErForm({ ...erForm, multipleChoiceCorrect: e.target.value })}
                          className="w-full border-2 border-blue-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold text-blue-800"
                          placeholder="30" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tổng số câu</label>
                        <input type="number" min="0"
                          value={erForm.multipleChoiceTotal || ''}
                          onChange={e => setErForm({ ...erForm, multipleChoiceTotal: e.target.value })}
                          className="w-full border-2 border-blue-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold text-blue-800"
                          placeholder="40" />
                      </div>
                    </div>
                    {erForm.multipleChoiceTotal > 0 && (
                      <p className="text-xs text-blue-600 font-bold">
                        Tỉ lệ: {Math.round((erForm.multipleChoiceCorrect / erForm.multipleChoiceTotal) * 100) || 0}%
                        {' '}({Number(erForm.multipleChoiceCorrect) >= Number(erForm.multipleChoiceTotal) * 0.7 ? '✅ Đạt phần trắc nghiệm' : '❌ Chưa đạt'})
                      </p>
                    )}
                  </div>

                  {/* Tự luận */}
                  <div className="bg-purple-50 rounded-2xl p-4 space-y-3 border border-purple-100">
                    <p className="text-xs font-black text-green-700 uppercase tracking-widest">✍️ Phần Tự luận (Admin tự chấm)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Điểm tự luận (0–10)</label>
                        <input type="number" min="0" max="10" step="0.5"
                          value={erForm.essayScore !== undefined ? erForm.essayScore : ''}
                          onChange={e => setErForm({ ...erForm, essayScore: e.target.value })}
                          className="w-full border-2 border-purple-200 rounded-xl p-3 focus:border-green-500 outline-none text-sm font-bold text-purple-800"
                          placeholder="7.5" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ngày thi</label>
                        <input type="date"
                          value={erForm.date || ''}
                          onChange={e => setErForm({ ...erForm, date: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-amber-500 outline-none text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nhận xét tự luận</label>
                      <textarea value={erForm.essayNote || ''} onChange={e => setErForm({ ...erForm, essayNote: e.target.value })}
                        rows={2} className="w-full border-2 border-purple-100 rounded-xl p-3 focus:border-green-500 outline-none text-sm resize-none"
                        placeholder="Nhận xét bài tự luận, ghi chú..." />
                    </div>
                  </div>

                  {/* Kết quả tổng */}
                  <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-sm font-black text-gray-700 flex-1">Kết quả tổng: Đạt môn?</p>
                    <div className="flex gap-3">
                      <button onClick={() => setErForm({ ...erForm, passed: true })}
                        className={`flex-1 px-8 py-3 rounded-2xl text-[13px] font-black transition-all duration-300 border-2 ${
                          erForm.passed 
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-400 border-transparent text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] scale-[1.02]' 
                            : 'bg-white border-gray-200 text-gray-400 hover:border-emerald-200 hover:text-emerald-500 hover:bg-emerald-50/50 hover:scale-[1.02]'
                        }`}>ĐẠT</button>
                      <button onClick={() => setErForm({ ...erForm, passed: false })}
                        className={`flex-1 px-8 py-3 rounded-2xl text-[13px] font-black transition-all duration-300 border-2 ${
                          !erForm.passed 
                            ? 'bg-gradient-to-br from-red-500 to-pink-500 border-transparent text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)] scale-[1.02]' 
                            : 'bg-white border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50/50 hover:scale-[1.02]'
                        }`}>CHƯA ĐẠT</button>
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-8 flex gap-3">
                  <button onClick={() => setErForm(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600">Huỷ</button>
                  <button onClick={() => {
                    if (!erForm.studentName?.trim()) { toast.error('Vui lòng chọn học viên!'); return; }
                    if (!erForm.subject?.trim()) { toast.error('Vui lòng chọn môn thi!'); return; }
                    if (erForm.id) {
                      updateExamResult(erForm.id, erForm);
                      toast.success('Đã cập nhật kết quả thi!');
                    } else {
                      addExamResult(erForm);
                      toast.success('Đã thêm kết quả thi!');
                    }
                    setErForm(null);
                  }} className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                    <Save size={16} /> {erForm.id ? 'Cập nhật' : 'Lưu kết quả'}
                  </button>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
