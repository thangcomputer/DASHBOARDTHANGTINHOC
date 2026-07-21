import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  BookOpen, Video, FileText, Download, ClipboardList, Trophy, Plus, HelpCircle,
  Edit3, Trash2, Save, Upload, Loader2, Star, CheckCircle2, X, PlayCircle,
  GraduationCap, Search, Clock, Layers, FileSpreadsheet,
} from 'lucide-react';
import AdminCourseBuilder from '../../AdminCourseBuilder';
import RichTextEditor from '../shared/RichTextEditor';
import { resolveTeacherExamDate } from '../utils/teacherExam';
import { trainingUploadDisplayName } from '../utils/trainingUpload';
import {
  downloadTeacherQuestionsExcelTemplate,
  parseQuestionBankExcel,
} from '../../../utils/studentQuestionsExcel';
import { applyAnchorNewTabPolicy } from '../../../utils/htmlContent';

export default function AdminTrainingTab() {
  const {
    courseBuilderMode, setCourseBuilderMode, trainingData, updateTrainingItem, trainingTab, setTrainingTab,
    trainingForm, setTrainingForm, questions, teachers, setErGvForm, BLANK_ER_GV, trainingFileUploading,
    handleTrainingDocUpload, addTrainingItem, toast, showGlobalModal, erGvSearch, setErGvSearch, erGvForm,
    ctxUpdateTeacher, fetchTeachers, qSearch, setQSearch, qSection, setQSection, qDifficulty, setQDifficulty,
    qSort, qForm, setQForm, BLANK_Q, addQuestion, updateQuestion, removeQuestion, resetQuestions,
    setTeacherExamTimeLimitMinutes, teacherExamTimeLimitMinutes, setDeleteConfirm, safeTeachersList,
    teacherQuestionsExcelInputRef, handleTeacherQuestionsExcelFile,
  } = useAdminTab();

  return (
            <div className="space-y-6">
              <div className="cms-toolbar">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 min-w-0">
                  <BookOpen size={20} className="text-purple-600" /> Quản lý Đào tạo Giảng viên
                </h2>
              </div>

              {courseBuilderMode ? (
                 <AdminCourseBuilder course={courseBuilderMode} onBack={() => setCourseBuilderMode(null)} onSave={(updatedCourse) => {
                     updateTrainingItem('videos', courseBuilderMode.id, updatedCourse);
                     setCourseBuilderMode(null);
                 }} />
              ) : (
                <>
              {/* Sub-tabs */}
              <div className="cms-table-wrap rounded-2xl p-1.5 shadow-sm border border-gray-100">
                <div className="flex gap-2 min-w-max">
                {[
                  { key: 'videos', icon: Video, label: 'Quản lý Khóa học', count: trainingData?.videos?.length || 0 },
                  { key: 'guides', icon: FileText, label: 'Quy trình', count: trainingData?.guides?.length || 0 },
                  { key: 'files', icon: Download, label: 'Tài liệu', count: trainingData?.files?.length || 0 },
                  { key: 'questions', icon: ClipboardList, label: 'Ngân hàng câu hỏi', count: questions?.length || 0 },
                  { key: 'exam-results-gv', icon: Trophy, label: 'Kết quả thi', count: (teachers || []).filter(t => t.testDate || t.testScore > 0 || t.status === 'Locked').length },
                ].map(t => (
                  <button key={t.key} onClick={() => { setTrainingTab(t.key); setTrainingForm(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                      trainingTab === t.key
                        ? t.key === 'exam-results-gv' ? 'bg-amber-600 text-white shadow-md' : 'bg-purple-600 text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}>
                    <t.icon size={15} /> {t.label} <span className="text-xs opacity-70">({t.count})</span>
                  </button>
                ))}
                </div>
              </div>

              {/* Add button */}
              {trainingTab !== 'questions' && trainingTab !== 'exam-results-gv' && (
                <button onClick={() => setTrainingForm({})}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2">
                  <Plus size={15} /> {trainingTab === 'videos' ? 'Thêm Khóa học' : trainingTab === 'guides' ? 'Thêm quy trình' : 'Thêm tài liệu'}
                </button>
              )}
              {trainingTab === 'exam-results-gv' && (
                <button onClick={() => setErGvForm({ ...BLANK_ER_GV })}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2">
                  <Plus size={15} /> Thêm kết quả thi
                </button>
              )}

              {/* Add/Edit Form */}
              {trainingForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-purple-700 flex items-center gap-2">
                      <Edit3 size={16} /> {trainingForm.id ? 'Chỉnh sửa' : 'Thêm mới'}
                    </h3>
                    <button onClick={() => setTrainingForm(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {trainingTab !== 'files' && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tiêu đề</label>
                      <input value={trainingForm.title || ''} onChange={e => setTrainingForm({ ...trainingForm, title: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-purple-400 outline-none" placeholder="Nhập tiêu đề..." />
                    </div>
                    )}
                    {trainingTab === 'videos' && (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mô tả Khóa học (Tóm tắt)</label>
                        <input value={trainingForm.desc || ''} onChange={e => setTrainingForm({ ...trainingForm, desc: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-purple-400 outline-none" placeholder="Nhập mô tả tóm tắt..." />
                      </div>
                    )}
                    {trainingTab === 'guides' && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Icon (emoji)</label>
                        <input value={trainingForm.icon || ''} onChange={e => setTrainingForm({ ...trainingForm, icon: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-purple-400 outline-none" placeholder="📋" />
                      </div>
                    )}
                    {trainingTab === 'files' && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tiêu đề</label>
                          <input value={trainingForm.title || ''} onChange={e => setTrainingForm({ ...trainingForm, title: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-purple-400 outline-none" placeholder="Nhập tiêu đề..." />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tải tệp</label>
                          <div className="flex flex-wrap items-center gap-2 min-h-[46px]">
                            <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50 text-purple-800 text-xs font-black uppercase tracking-wide cursor-pointer hover:bg-purple-100 transition-colors shrink-0 ${trainingFileUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                              {trainingFileUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                              {trainingFileUploading ? 'Đang tải...' : 'TẢI FILE'}
                              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar" onChange={(e) => handleTrainingDocUpload(e, 'teacher')} />
                            </label>
                            {trainingForm.fileUrl && (
                              <a
                                href={trainingForm.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 max-w-[min(100%,14rem)] px-3 py-2 rounded-xl bg-purple-100/80 border border-purple-200 text-purple-900 text-xs font-bold hover:bg-purple-200/80 transition-colors truncate"
                                title={trainingUploadDisplayName(trainingForm.fileUrl, trainingForm.fileOriginalName)}
                              >
                                <FileText size={16} className="shrink-0 text-purple-600" />
                                <span className="truncate">{trainingUploadDisplayName(trainingForm.fileUrl, trainingForm.fileOriginalName)}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Mô tả - Rich Text Editor (ẩn với khóa học) */}
                  {trainingTab !== 'videos' && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nội dung mô tả (có định dạng)</label>
                      <RichTextEditor
                        value={trainingForm.desc || ''}
                        onChange={(val) => setTrainingForm(prev => ({ ...prev, desc: val }))}
                        placeholder="Nhập nội dung mô tả chi tiết..."
                      />
                    </div>
                  )}
                  <button onClick={() => {
                    if (!trainingForm.title?.trim()) { 
                        showGlobalModal({ title: 'Thiếu thông tin', content: 'Vui lòng nhập tiêu đề bài học!', type: 'warning' });
                        return; 
                    }
                    const trainingPayload = trainingTab === 'files'
                      ? { ...trainingForm, fileType: trainingForm.fileType || 'PDF' }
                      : trainingForm;
                    if (trainingForm.id) {
                      updateTrainingItem(trainingTab, trainingForm.id, trainingPayload);
                    } else {
                      addTrainingItem(trainingTab, { ...trainingPayload, createdAt: new Date().toISOString().split('T')[0] });
                    }
                    setTrainingForm(null);
                  }} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2">
                    <Save size={15} /> {trainingForm.id ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              )}

              {/* ===== TEACHER EXAM RESULTS TAB ===== */}
              {trainingTab === 'exam-results-gv' && (() => {
                // Sử dụng mảng teachers thay vì examResults để phản ánh dữ liệu thật
                const gvResults = (teachers || []).filter(t => t.testDate || t.testScore > 0 || t.status === 'Locked');
                const filteredGv = gvResults.filter(t =>
                  !erGvSearch || (t.name || '').toLowerCase().includes(erGvSearch.toLowerCase())
                );
                return (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={erGvSearch} onChange={e => setErGvSearch(e.target.value)}
                          className="pl-8 pr-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 outline-none w-56"
                          placeholder="Tìm theo tên giảng viên..." />
                      </div>
                      <span className="text-xs text-gray-400 font-bold ml-auto">{filteredGv.length} bản ghi</span>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="cms-table-wrap">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-blue-50 border-b border-blue-100">
                              <th className="px-4 py-3 text-xs font-black text-blue-700 uppercase tracking-widest">Giảng viên</th>
                              <th className="px-4 py-3 text-xs font-black text-blue-700 uppercase tracking-widest text-center">Trắc nghiệm</th>
                              <th className="px-4 py-3 text-xs font-black text-blue-700 uppercase tracking-widest text-center">Bài tự luận (File)</th>
                              <th className="px-4 py-3 text-xs font-black text-blue-700 uppercase tracking-widest text-center">Trạng thái chung</th>
                              <th className="px-4 py-3 text-xs font-black text-blue-700 uppercase tracking-widest">Ngày thi</th>
                              <th className="px-4 py-3 text-xs font-black text-blue-700 uppercase tracking-widest text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {filteredGv.map(t => {
                              const mcScore = Number(t.testScore) || 0;
                              const isPassedMC = mcScore >= 80;
                              return (
                                <tr key={t.id || t._id} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xs font-black">
                                        {(t.name || '?')[0]}
                                      </div>
                                      <div>
                                        <span className="font-bold text-sm text-gray-800 block">{t.name}</span>
                                        <span className="text-xs text-gray-400 font-bold">{t.phone}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center">
                                      <span className={`text-lg font-black ${isPassedMC ? 'text-green-600' : 'text-red-500'}`}>{mcScore}/100</span>
                                      <span className="text-xs cms-min-text-xs text-gray-400 font-bold uppercase">{isPassedMC ? 'ĐẠT' : 'TRƯỢT'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {t.practicalFile ? (
                                      <a href="#" onClick={(e) => { 
                                          e.preventDefault(); 
                                          showGlobalModal({ 
                                            title: 'Tính năng nâng cao', 
                                            content: `Về sau hệ thống sẽ liên kết nút này với CSDL Cloud (AWS S3 / Google Storage) để tải file: ${t.practicalFile}. Hiện tại hệ thống đang sử dụng lưu trữ cục bộ.`, 
                                            type: 'info' 
                                          }); 
                                      }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-all border border-purple-200">
                                        <Download size={12} /> {t.practicalFile}
                                      </a>
                                    ) : (
                                      <span className="text-gray-300 text-xs font-bold italic">Chưa nộp</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black ${
                                      t.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                                      t.status === 'Locked' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                                    }`}>
                                      {t.status === 'active' ? 'CHÍNH THỨC' : t.status === 'Locked' ? 'BỊ KHÓA' : 'ĐANG CHỜ'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs text-gray-400 font-bold">
                                      {(() => {
                                        const d = resolveTeacherExamDate(t);
                                        return d
                                          ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                          : 'N/A';
                                      })()}
                                    </span>
                                    {isTeacherExamDateApproximate(t) && (
                                      <span className="block text-xs cms-min-text-xs text-amber-600 font-bold mt-0.5">Ước lượng từ cập nhật hồ sơ</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      {String(t.status || '').toLowerCase() === 'pending' && t.practicalFile ? (
                                        <>
                                          <button onClick={() => ctxUpdateTeacher(t.id || t._id, { practicalStatus: 'passed', status: 'active' })} className="px-3 py-1.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 text-xs font-black tracking-wide border border-green-200">CHẤM ĐẠT</button>
                                          <button onClick={() => ctxUpdateTeacher(t.id || t._id, { practicalStatus: 'failed', status: 'Locked', lockReason: 'Bài thi Tự luận/Thực hành chưa đạt yêu cầu' })} className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-black tracking-wide border border-red-200">CHẤM TRƯỢT</button>
                                        </>
                                      ) : String(t.status || '').toLowerCase() === 'active' ? (
                                        <span className="text-xs text-green-600 font-black">XONG</span>
                                      ) : String(t.status || '').toLowerCase() === 'locked' ? (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const id = t.id || t._id;
                                            try {
                                              await ctxUpdateTeacher(id, {
                                                status: 'pending',
                                                lockReason: null,
                                                practicalStatus: 'none',
                                                practicalFile: null,
                                                testScore: 0,
                                                testStatus: null,
                                                testDate: null,
                                              });
                                              toast.success('Đã mở khóa — giảng viên có thể vào thi lại.');
                                            } catch (e) {
                                              toast.error(e?.message || 'Không cập nhật được. Cần quyền Super Admin hoặc quyền Đào tạo trên tài khoản nhân viên.');
                                            }
                                          }}
                                          className="relative z-10 px-2 py-1.5 rounded-lg bg-white text-gray-800 hover:bg-gray-50 text-xs font-black border-2 border-gray-800 shadow-sm cursor-pointer"
                                        >
                                          CHO THI LẠI
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-400 font-bold border px-2 py-1 border-gray-100 rounded-lg">ĐANG THI...</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredGv.length === 0 && (
                              <tr>
                                <td colSpan="6" className="px-6 py-14 text-center text-gray-400">
                                  <Trophy size={36} className="mx-auto mb-3 text-gray-200" />
                                  <p className="text-sm font-bold">Chưa có kết quả thi nào</p>
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
              {trainingTab !== 'exam-results-gv' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {trainingTab === 'questions' ? (
                    (() => {
                      const SECTION_OPTS = [
                        { value: 'excel', label: 'Microsoft Excel' },
                        { value: 'word', label: 'Microsoft Word' },
                        { value: 'powerpoint', label: 'Microsoft PowerPoint' },
                        { value: 'computer', label: 'Máy tính & Windows' },
                        { value: 'situation', label: 'Tình Huống Sư Phạm' },
                        { value: 'other', label: 'Kiến thức Khác' },
                      ];
                      const filtered = (questions || []).filter(q => {
                        const matchS = qSection === 'all' || q.section === qSection;
                        const matchD = qDifficulty === 'all' || q.difficulty === qDifficulty;
                        const matchQ = !qSearch || (q.q || '').toLowerCase().includes(qSearch.toLowerCase());
                        return matchS && matchD && matchQ;
                      }).sort((a, b) => {
                        if (qSort === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
                        if (qSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
                        if (qSort === 'failure') return (b.failRate || 0) - (a.failRate || 0);
                        return 0;
                      });
                      return (
                        <div className="p-4 space-y-5">
                          {/* Header inline for Training Tab */}
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
                            <h2 className="text-md font-bold text-gray-800 flex items-center gap-2">
                              <ClipboardList size={18} className="text-red-500" /> Ngân hàng câu hỏi bài test GV
                            </h2>
                            <div className="flex gap-2 flex-wrap items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  showGlobalModal({
                                    title: 'Xóa toàn bộ ngân hàng câu hỏi giảng viên?',
                                    content:
                                      'Toàn bộ câu trắc nghiệm và câu tự luận trong ngân hàng bài test giảng viên sẽ bị xóa. Thao tác không thể hoàn tác.',
                                    type: 'warning',
                                    confirmText: 'Xóa toàn bộ',
                                    cancelText: 'Huỷ bỏ',
                                    onConfirm: () => resetQuestions(),
                                  });
                                }}
                                className="px-3 py-2 border-2 border-amber-200 text-amber-800 bg-amber-50/80 rounded-xl text-xs font-bold hover:bg-amber-100 flex items-center gap-1"
                              >
                                <Trash2 size={12} /> Xóa toàn bộ (TN & tự luận)
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadTeacherQuestionsExcelTemplate()}
                                className="bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1"
                              >
                                <Download size={14} /> Tải mẫu Excel
                              </button>
                              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-dashed border-red-300 bg-red-50/50 text-red-800 hover:bg-red-100 cursor-pointer">
                                <FileSpreadsheet size={14} /> Nhập từ Excel
                                <input
                                  ref={teacherQuestionsExcelInputRef}
                                  type="file"
                                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                  className="hidden"
                                  onChange={handleTeacherQuestionsExcelFile}
                                />
                              </label>
                              <button onClick={() => setQForm({ ...BLANK_Q })}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow flex items-center gap-2">
                                <Plus size={14} /> Thêm câu hỏi
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 items-center">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input value={qSearch} onChange={e => setQSearch(e.target.value)}
                                className="pl-8 pr-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 outline-none w-full sm:w-auto"
                                placeholder="Tìm câu hỏi..." />
                            </div>
                            <select value={qSection} onChange={e => setQSection(e.target.value)}
                              className="py-2 px-3 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 outline-none">
                              <option value="all">Tất cả phần</option>
                              {SECTION_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <select value={qDifficulty} onChange={e => setQDifficulty(e.target.value)}
                              className="py-2 px-3 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 outline-none font-bold text-gray-700">
                              <option value="all">📊 Độ khó</option>
                              <option value="easy">🟢 Cơ bản</option>
                              <option value="medium">🟡 Trung bình</option>
                              <option value="hard">🔴 Nâng cao</option>
                            </select>
                          </div>

                          <div className="w-full flex flex-wrap items-end gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Clock size={12} className="text-red-500" /> Thời gian làm bài test GV (phút)
                              </label>
                              <input
                                type="number"
                                min={5}
                                max={600}
                                value={teacherExamTimeLimitMinutes ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === '') setTeacherExamTimeLimitMinutes(null);
                                  else {
                                    const n = parseInt(v, 10);
                                    if (Number.isFinite(n)) {
                                      setTeacherExamTimeLimitMinutes(Math.min(600, Math.max(5, n)));
                                    }
                                  }
                                }}
                                placeholder="Tự động"
                                className="w-40 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-red-400 outline-none bg-white"
                              />
                            </div>
                            <p className="text-xs text-gray-600 max-w-2xl pb-1 leading-relaxed">
                              <span className="font-black text-gray-800">Để trống (ô Tự động):</span>{' '}
                              thời gian tính theo toàn bộ số câu (~90 giây/câu, tối thiểu 10 phút, tối đa 120 phút).{' '}
                              <span className="font-black text-gray-800">Nhập 5–600:</span> cố định tổng phút cho bài trắc nghiệm GV (lưu cùng ngân hàng, ~2 giây).
                            </p>
                          </div>

                          {/* Add/Edit Modal */}
                          {qForm && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
                                  <h3 className="text-white font-bold flex items-center gap-2">
                                    <ClipboardList size={18} /> {qForm.id ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
                                  </h3>
                                  <button onClick={() => setQForm(null)}><X size={20} className="text-white/80 hover:text-white" /></button>
                                </div>
                                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                                  {/* Question Type */}
                                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                    <button onClick={() => setQForm({ ...qForm, type: 'multiple' })}
                                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${qForm.type === 'multiple' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>
                                      Trắc nghiệm
                                    </button>
                                    <button onClick={() => setQForm({ ...qForm, type: 'essay' })}
                                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${qForm.type === 'essay' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>
                                      Tự luận
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phần thi</label>
                                      <select value={qForm.section} onChange={e => setQForm({ ...qForm, section: e.target.value })}
                                        className="w-full border-2 border-gray-100 rounded-xl p-2.5 focus:border-red-500 outline-none text-sm font-semibold">
                                        {SECTION_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Độ khó</label>
                                      <select value={qForm.difficulty} onChange={e => setQForm({ ...qForm, difficulty: e.target.value })}
                                        className="w-full border-2 border-gray-100 rounded-xl p-2.5 focus:border-red-500 outline-none text-sm font-semibold">
                                        <option value="easy">Cơ bản</option>
                                        <option value="medium">Trung bình</option>
                                        <option value="hard">Nâng cao</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Câu hỏi</label>
                                    <textarea value={qForm.q} onChange={e => setQForm({ ...qForm, q: e.target.value })}
                                      rows={3} className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none text-sm resize-none"
                                      placeholder="Nhập nội dung câu hỏi..." />
                                  </div>
                                  {qForm.type === 'multiple' ? (
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Đáp án (Chọn nút để đánh dấu câu đúng)</label>
                                      <div className="space-y-2">
                                        {(qForm.options || ['', '', '', '']).map((opt, i) => (
                                          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border-2 transition ${qForm.correct === i ? 'border-green-400 bg-green-50' : 'border-gray-100'}`}>
                                            <button onClick={() => setQForm({ ...qForm, correct: i })}
                                              className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black transition ${qForm.correct === i ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                              {['A', 'B', 'C', 'D'][i]}
                                            </button>
                                            <input value={opt} onChange={e => { const o = [...(qForm.options || [])]; o[i] = e.target.value; setQForm({ ...qForm, options: o }); }}
                                              className="flex-1 bg-transparent outline-none text-sm" placeholder={`Nội dung đáp án ${['A', 'B', 'C', 'D'][i]}...`} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Gợi ý đáp án / Nội dung mẫu</label>
                                        <textarea value={qForm.sampleAnswer || ''} onChange={e => setQForm({ ...qForm, sampleAnswer: e.target.value })}
                                          rows={3} className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-red-500 outline-none text-sm resize-none"
                                          placeholder="Nhập nội dung gợi ý hoặc đáp án mẫu..." />
                                      </div>
                                      <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Đính kèm tài liệu thực hành (Nếu có)</label>
                                        <div className="flex items-center gap-3">
                                          <label className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition cursor-pointer flex flex-col items-center justify-center text-center">
                                            <input type="file" className="hidden" onChange={e => {
                                              const file = e.target.files[0];
                                              if (file) setQForm({ ...qForm, attachedFile: file.name });
                                            }} />
                                            {qForm.attachedFile ? (
                                              <span className="text-blue-600 font-bold text-sm flex items-center gap-2">
                                                <FileText size={16} /> {qForm.attachedFile}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 text-xs py-1">Nhấn để chọn file tài liệu...</span>
                                            )}
                                          </label>
                                          {qForm.attachedFile && (
                                            <button onClick={() => setQForm({ ...qForm, attachedFile: null })} className="p-2 text-red-500 bg-red-50 rounded-lg"><X size={16} /></button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="px-6 pb-6 flex gap-3">
                                  <button onClick={() => setQForm(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600">Huỷ</button>
                                  <button onClick={() => {
                                    if (!qForm.q?.trim()) { toast.error('Vui lòng nhập nội dung câu hỏi!'); return; }
                                    if (qForm.type === 'multiple') {
                                      const validCount = (qForm.options || []).filter(o => o?.trim()).length;
                                      if (validCount < 2) { toast.error('Trắc nghiệm cần ít nhất 2 đáp án!'); return; }
                                    }
                                    
                                    try {
                                      if (qForm.id) {
                                        updateQuestion(qForm.id, qForm);
                                        toast.success('Đã cập nhật câu hỏi!');
                                      } else {
                                        addQuestion({ ...qForm, createdAt: Date.now() });
                                        toast.success('Đã thêm câu hỏi mới!');
                                      }
                                      setQForm(null);
                                    } catch (err) {
                                      toast.error('Có lỗi xảy ra khi lưu!');
                                    }
                                  }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                    <Save size={16} /> Lưu
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                            {filtered.length === 0 ? (
                              <p className="p-8 text-center text-gray-400 text-sm">Không tìm thấy câu hỏi nào</p>
                            ) : (
                              filtered.map((q, idx) => {
                                const sOpt = SECTION_OPTS.find(s => s.value === q.section);
                                                                const colors = { 
                                  excel: 'bg-green-100 text-green-700', 
                                  word: 'bg-blue-100 text-blue-700', 
                                  powerpoint: 'bg-orange-100 text-orange-700', 
                                  computer: 'bg-indigo-100 text-indigo-700',
                                  situation: 'bg-purple-100 text-purple-700',
                                  other: 'bg-gray-100 text-gray-700'
                                };
                                return (
                                  <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-black text-gray-400 flex-shrink-0 mt-0.5">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${colors[q.section] || 'bg-gray-100 text-gray-500'}`}>{sOpt?.label}</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${q.type === 'essay' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                          {q.type === 'essay' ? 'TỰ LUẬN' : 'TRẮC NGHIỆM'}
                                        </span>
                                        <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-gray-50 text-gray-400">{q.difficulty === 'hard' ? 'NÂNG CAO' : q.difficulty === 'medium' ? 'TRUNG BÌNH' : 'CƠ BẢN'}</span>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-800 leading-relaxed">{q.q}</p>
                                      {q.type === 'essay' && (
                                        <div className="mt-2 space-y-2">
                                          {q.sampleAnswer && (
                                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                              <p className="text-xs font-bold text-purple-500 uppercase mb-1">Gợi ý đáp án:</p>
                                              <p className="text-xs text-gray-600 italic line-clamp-2">{q.sampleAnswer}</p>
                                            </div>
                                          )}
                                          {q.attachedFile && (
                                            <div className="flex items-center gap-2 text-xs text-blue-600 font-bold bg-blue-50 w-fit px-3 py-1.5 rounded-lg border border-blue-100">
                                              <Download size={14} /> {q.attachedFile}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {q.type !== 'essay' && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                          {(q.options || []).map((opt, i) => (
                                            <p key={i} className={`text-xs px-2 py-1 rounded-lg ${q.correct === i ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-400 border border-gray-50'}`}>
                                              {['A', 'B', 'C', 'D'][i]}. {opt}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button onClick={() => setQForm({ ...q })} className="p-2 rounded-lg bg-blue-50 text-blue-600"><Edit3 size={13} /></button>
                                      <button onClick={() => { 
                                        showGlobalModal({
                                          title: 'Xoá câu hỏi?',
                                          content: 'Câu hỏi này sẽ bị xoá vĩnh viễn khỏi ngân hàng câu hỏi.',
                                          type: 'warning',
                                          confirmText: 'Xoá',
                                          cancelText: 'Huỷ',
                                          onConfirm: () => removeQuestion(q.id)
                                        });
                                      }} className="p-2 rounded-lg bg-red-50 text-red-500"><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    (trainingData?.[trainingTab] || []).slice(0, trainingTab === 'videos' ? 4 : 20).map(item => (
                    <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {trainingTab === 'videos' && (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition" onClick={() => setCourseBuilderMode(item)}>
                            <BookOpen size={20} className="text-white" />
                          </div>
                        )}
                        {trainingTab === 'guides' && (
                          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                            {item.icon || '📄'}
                          </div>
                        )}
                        {trainingTab === 'files' && (
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-sm ${item.fileType === 'PDF' ? 'bg-red-500' : item.fileType === 'PPTX' ? 'bg-orange-500' : 'bg-green-500'
                            }`}>
                            {item.fileType || 'FILE'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{item.title}</p>
                          <p className="text-xs text-gray-400 truncate">{(item.desc?.replace(/<[^>]*>/g, '') || '').slice(0, 80)}</p>
                          {item.duration && <p className="text-xs text-purple-500 mt-0.5">⏱ {item.duration}</p>}
                          {item.fileSize && <p className="text-xs text-gray-400 mt-0.5">{item.fileSize}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3 flex-shrink-0 items-center">
                        {trainingTab === 'videos' && (
                           <button onClick={() => setCourseBuilderMode(item)} className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5">
                             <Layers size={13} /> Giáo trình
                           </button>
                        )}
                        <button onClick={() => setTrainingForm({ ...item })}
                          className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"><Edit3 size={14} /></button>
                        <button onClick={() => setDeleteConfirm({ category: trainingTab, id: item.id, title: item.title })}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )))}
                  {trainingTab !== 'questions' && (trainingData?.[trainingTab] || []).length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Chưa có nội dung nào</p>
                      <p className="text-xs text-gray-300 mt-1">Bấm "Thêm" để tạo nội dung đào tạo cho giảng viên</p>
                    </div>
                  )}
                </div>
              </div>
              )}
                </>
              )}

          {/* ===== MODAL KẾT QUẢ THI GIẢNG VIÊN ===== */}
          {erGvForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-8 py-5 flex items-center justify-between text-white">
                  <h3 className="font-bold text-lg flex items-center gap-3">
                    <GraduationCap size={22} /> {erGvForm.id ? 'Chỉnh sửa kết quả' : 'Thêm kết quả thi Giảng viên'}
                  </h3>
                  <button onClick={() => setErGvForm(null)} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Giảng viên</label>
                      <select value={erGvForm.teacherId || ''}
                        onChange={e => { const t = safeTeachersList.find(x => String(x.id) === e.target.value || String(x._id) === e.target.value); setErGvForm({ ...erGvForm, teacherId: e.target.value, teacherName: t?.name || '' }); }}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold">
                        <option value="">-- Chọn giảng viên --</option>
                        {safeTeachersList.map(t => (<option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Bài / Môn thi</label>
                      <select value={erGvForm.subject || ''} onChange={e => setErGvForm({ ...erGvForm, subject: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold">
                        <option value="BÀI TEST GIẢNG VIÊN">BÀI TEST GIẢNG VIÊN</option>
                        <option value="THỰC HÀNH GIẢNG DẠY">THỰC HÀNH GIẢNG DẠY</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 space-y-3 border border-blue-100">
                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest">📝 Phần Trắc nghiệm</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Điểm Trắc nghiệm (0-100)</label><input type="number" min="0" max="100" value={erGvForm.testScore || ''} onChange={e => setErGvForm({ ...erGvForm, testScore: e.target.value })} className="w-full border-2 border-blue-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm font-bold text-blue-800" placeholder="Chấm theo thang điểm 100" /></div>
                      <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ngày thi</label><input type="datetime-local" value={erGvForm.testDate ? new Date(erGvForm.testDate).toISOString().slice(0,16) : ''} onChange={e => setErGvForm({ ...erGvForm, testDate: new Date(e.target.value).toISOString() })} className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm" /></div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-2xl p-4 space-y-3 border border-purple-100">
                    <p className="text-xs font-black text-purple-700 uppercase tracking-widest">✍️ BÀI TỰ LUẬN & GHI CHÚ</p>
                    <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Đánh giá chung (Ghi chú)</label><textarea value={erGvForm.testNotes || ''} onChange={e => setErGvForm({ ...erGvForm, testNotes: e.target.value })} rows={2} className="w-full border-2 border-purple-100 rounded-xl p-3 focus:border-purple-500 outline-none text-sm resize-none" placeholder="Đánh giá kết quả của giảng viên..." /></div>
                  </div>
                  <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-sm font-black text-gray-700 flex-1">Kết quả: Xét duyệt Giảng dạy?</p>
                    <div className="flex gap-3">
                       <button onClick={() => setErGvForm({ ...erGvForm, status: 'active' })} 
                         className={`flex-1 px-5 py-3 rounded-2xl text-[12px] font-black transition-all duration-300 border-2 ${
                           erGvForm.status === 'active' 
                             ? 'bg-gradient-to-br from-emerald-500 to-emerald-400 border-transparent text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] scale-[1.02]' 
                             : 'bg-white border-gray-200 text-gray-400 hover:border-emerald-200 hover:text-emerald-500 hover:bg-emerald-50/50 hover:scale-[1.02]'
                         }`}>ĐẠT (CẤP QUYỀN)</button>
                       <button onClick={() => setErGvForm({ ...erGvForm, status: 'Locked' })} 
                         className={`flex-1 px-5 py-3 rounded-2xl text-[12px] font-black transition-all duration-300 border-2 ${
                           erGvForm.status === 'Locked' 
                             ? 'bg-gradient-to-br from-red-500 to-pink-500 border-transparent text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)] scale-[1.02]' 
                             : 'bg-white border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50/50 hover:scale-[1.02]'
                         }`}>CHƯA ĐẠT (KHÓA LẠI)</button>
                    </div>
                  </div>
                </div>
                <div className="px-8 pb-8 flex gap-3">
                  <button onClick={() => setErGvForm(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600">Huỷ</button>
                  <button onClick={async () => {
                    if (!erGvForm.teacherId) { toast.error('Vui lòng chọn giảng viên!'); return; }
                    try {
                      await ctxUpdateTeacher(erGvForm.teacherId, {
                        testScore: Number(erGvForm.testScore) || 0,
                        testStatus: erGvForm.status === 'active' ? 'passed' : 'failed',
                        testDate: erGvForm.testDate || new Date().toISOString(),
                        testNotes: erGvForm.testNotes || '',
                        status: erGvForm.status || 'Locked'
                      });
                      toast.success('Đã cập nhật kết quả và trạng thái Giảng viên!');
                      setErGvForm(null);
                      fetchTeachers();
                    } catch (err) {
                      toast.error('Lỗi cập nhật: ' + (err.message || 'Không xác định'));
                    }
                  }} className="flex-1 py-3 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                    <Save size={16} /> Lưu & Áp dụng
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
  );
}
