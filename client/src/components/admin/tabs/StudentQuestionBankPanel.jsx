import React from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { useAdminTab } from '../AdminTabContext';
import { useData } from '../../../context/DataContext';
import {
  Clock, Trash2, Plus, Download, FileSpreadsheet, Upload, Loader2, FileText,
  Edit3, X, Save, Search, HelpCircle, CheckCircle2, ImageIcon, ListChecks, PenLine, Volume2,
} from 'lucide-react';
import { downloadStudentQuestionsExcelTemplate } from '../../../utils/studentQuestionsExcel';
import { playExamWarningSound, unlockAudio } from '../../../utils/sound';
import {
  getStudentMcQuestionsForExam,
  getStudentEssayQuestionsForExam,
  getEssayQuestionFile,
} from '../../../utils/htmlContent';
import { getExamSubjectOptions } from '../../../utils/examSubjects';
import api, { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';

const DIFF_LABELS = { easy: 'Cơ bản', medium: 'TB', hard: 'Nâng cao' };

function QuestionRow({ q, index, onEdit, onDelete, showImage }) {
  const isEssay = String(q.type).toLowerCase() === 'essay';
  const essayFile = isEssay ? getEssayQuestionFile(q) : null;
  const correctIdx = Number(q.correct);
  const correctLetter = ['A', 'B', 'C', 'D'][correctIdx];

  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white transition">
      <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center mt-0.5">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {DIFF_LABELS[q.difficulty] || 'TB'}
          </span>
          {!isEssay && correctLetter && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              Đáp án {correctLetter}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-800 leading-snug">{q.q}</p>
        {showImage && q.imageUrl && (
          <img
            src={resolveMediaUrl(q.imageUrl)}
            alt=""
            className="mt-2 max-h-24 rounded-lg border border-slate-200 object-contain bg-white"
          />
        )}
        {essayFile && (
          <a
            href={buildMediaDownloadUrl(essayFile.fileUrl, essayFile.fileName)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline"
          >
            <FileText size={12} /> {essayFile.fileName}
          </a>
        )}
      </div>
      <div className="flex gap-1 opacity-70 group-hover:opacity-100 shrink-0">
        <button type="button" onClick={() => onEdit(q)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
          <Edit3 size={13} />
        </button>
        <button type="button" onClick={() => onDelete(q)} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="py-10 px-4 text-center">
      <Icon size={32} className="mx-auto mb-2 text-slate-200" />
      <p className="text-sm font-bold text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-300 mt-1">{hint}</p>}
    </div>
  );
}

export default function StudentQuestionBankPanel() {
  const {
    studentQuestions,
    studentExamMinutes,
    updateStudentExamMinutes,
    studentEssayExamMinutes,
    updateStudentEssayExamMinutes,
    studentEssayRequired,
    updateStudentEssayRequired,
    studentExamFiles,
    examWarningSoundUrl = '',
    setExamWarningSoundUrl,
    addStudentQuestion,
    updateStudentQuestion,
    removeStudentQuestion,
  } = useData();

  const {
    showGlobalModal, resetStudentQuestions, setSqForm, BLANK_Q,
    studentQuestionsExcelInputRef, handleStudentQuestionsExcelFile,
    toast, sqSection, setSqSection,
    sqForm, examSubjectsCatalog,
  } = useAdminTab();

  const subjectOpts = React.useMemo(
    () => getExamSubjectOptions(examSubjectsCatalog),
    [examSubjectsCatalog],
  );
  const activeSubject = subjectOpts.find((s) => s.id === sqSection) || subjectOpts[0];

  const [mcSearch, setMcSearch] = React.useState('');
  const [tlSearch, setTlSearch] = React.useState('');
  const [soundUploading, setSoundUploading] = React.useState(false);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [pdfUploading, setPdfUploading] = React.useState(false);

  React.useEffect(() => {
    setMcSearch('');
    setTlSearch('');
  }, [sqSection]);

  const mcQuestions = React.useMemo(() => {
    const list = getStudentMcQuestionsForExam(studentQuestions, sqSection);
    const q = mcSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => String(item.q || '').toLowerCase().includes(q));
  }, [studentQuestions, sqSection, mcSearch]);

  const essayQuestions = React.useMemo(() => {
    const list = getStudentEssayQuestionsForExam(studentQuestions, sqSection);
    const q = tlSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => String(item.q || '').toLowerCase().includes(q));
  }, [studentQuestions, sqSection, tlSearch]);

  const handleEssayPdfUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sqForm) return;
    setPdfUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setSqForm({
        ...sqForm,
        attachedFileUrl: data.fileUrl,
        attachedFileName: data.fileOriginalName || file.name,
      });
      toast.success('Đã tải file đề thực hành');
    } catch (err) {
      toast.error(err.message || 'Không tải được file');
    } finally {
      setPdfUploading(false);
    }
  };

  const handleExamWarningSoundUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSoundUploading(true);
    try {
      const data = await api.settings.uploadExamWarningSound(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setExamWarningSoundUrl?.(data.examWarningSoundUrl || '');
      toast.success('Đã tải âm thanh cảnh báo');
    } catch (err) {
      toast.error(err.message || 'Không tải được âm thanh');
    } finally {
      setSoundUploading(false);
    }
  };

  const handleQuestionImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sqForm) return;
    setImageUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setSqForm({
        ...sqForm,
        imageUrl: data.fileUrl,
        imageName: data.fileOriginalName || file.name,
      });
      toast.success('Đã thêm hình minh họa');
    } catch (err) {
      toast.error(err.message || 'Không tải được hình');
    } finally {
      setImageUploading(false);
    }
  };

  const confirmDeleteQuestion = (q) => {
    showGlobalModal({
      title: 'Xóa câu hỏi?',
      content: 'Câu hỏi sẽ bị xóa khỏi ngân hàng đề thi học viên.',
      type: 'warning',
      confirmText: 'Xóa',
      cancelText: 'Huỷ',
      onConfirm: () => removeStudentQuestion(q.id),
    });
  };

  const openAddForm = (type) => {
    setSqForm({
      ...BLANK_Q,
      type,
      section: sqSection,
      imageUrl: '',
      imageName: '',
      attachedFileUrl: '',
      attachedFileName: '',
    });
  };

  const handleEditQuestion = (q) => {
    const file = getEssayQuestionFile(q);
    setSqForm({
      ...q,
      attachedFileUrl: file?.fileUrl || '',
      attachedFileName: file?.fileName || '',
    });
  };

  const handleSaveQuestion = async () => {
    const section = sqForm.section || sqSection;
    const isEssay = String(sqForm.type).toLowerCase() === 'essay';
    const fileUrl = String(sqForm.attachedFileUrl || '').trim();
    const fileName = String(sqForm.attachedFileName || '').trim();

    if (isEssay) {
      const hasText = Boolean(sqForm.q?.trim());
      const hasFile = Boolean(fileUrl);
      if (!hasText && !hasFile) {
        toast.error('Nhập nội dung câu hỏi hoặc tải file đề PDF/Excel!');
        return;
      }
    } else {
      if (!sqForm.q?.trim()) {
        toast.error('Vui lòng nhập câu hỏi!');
        return;
      }
      if ((sqForm.options || []).filter((o) => o?.trim()).length < 2) {
        toast.error('Cần ít nhất 2 đáp án!');
        return;
      }
    }

    const qText = sqForm.q?.trim()
      || (isEssay && fileUrl ? 'Làm bài theo đề thực hành đính kèm.' : '');

    const payload = {
      ...sqForm,
      type: isEssay ? 'essay' : 'multiple',
      section,
      q: qText,
    };
    if (isEssay) {
      payload.attachedFileUrl = fileUrl;
      payload.attachedFileName = fileName;
    } else {
      delete payload.attachedFileUrl;
      delete payload.attachedFileName;
    }
    delete payload.practiceFileUrl;
    delete payload.practiceFileName;

    let nextQuestions = [];
    if (sqForm.id) {
      updateStudentQuestion(sqForm.id, payload);
      nextQuestions = (studentQuestions || []).map((q) => (
        q.id === sqForm.id ? { ...q, ...payload, id: sqForm.id } : q
      ));
    } else {
      const newItem = { ...payload, id: `sq_${Date.now()}`, createdAt: Date.now() };
      addStudentQuestion(newItem);
      nextQuestions = [...(studentQuestions || []), newItem];
    }

    try {
      await api.settings.updateStudentExamConfig({
        studentQuestions: nextQuestions,
        studentExamMinutes,
        studentEssayExamMinutes,
        studentEssayRequired,
        studentExamFiles,
        examWarningSoundUrl,
      });
      toast.success(sqForm.id ? 'Đã cập nhật!' : 'Đã thêm câu hỏi!');
      setSqForm(null);
    } catch (err) {
      toast.error(err.message || 'Lưu server thất bại — thử lại');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header — chọn môn */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5">
              Môn thi
            </label>
            <CmsSelect
              value={sqSection}
              onChange={(e) => setSqSection(e.target.value)}
              className="w-full border-2 border-green-200 rounded-xl px-3 py-2.5 text-sm font-bold text-green-900 bg-green-50/40 outline-none focus:border-green-500"
            >
              {subjectOpts.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </CmsSelect>
          </div>
          <div className="w-28">
            <label className="text-[11px] font-bold uppercase tracking-wide text-amber-700 block mb-1.5">
              Phút TN
            </label>
            <div className="flex items-center gap-1.5 border-2 border-amber-200 bg-amber-50/80 rounded-xl px-2.5 py-2">
              <Clock size={14} className="text-amber-700 shrink-0" />
              <input
                type="number"
                min={1}
                max={600}
                value={studentExamMinutes?.[sqSection] ?? 90}
                onChange={(e) => updateStudentExamMinutes({ [sqSection]: e.target.value })}
                className="w-full bg-transparent text-sm font-black text-slate-800 outline-none text-center"
              />
            </div>
          </div>
          <div className="w-28">
            <label className="text-[11px] font-bold uppercase tracking-wide text-violet-700 block mb-1.5">
              Phút TL
            </label>
            <div className={`flex items-center gap-1.5 border-2 rounded-xl px-2.5 py-2 ${
              studentEssayRequired?.[sqSection] === false
                ? 'border-slate-200 bg-slate-50 opacity-60'
                : 'border-violet-200 bg-red-50/80'
            }`}>
              <Clock size={14} className="text-violet-700 shrink-0" />
              <input
                type="number"
                min={1}
                max={600}
                disabled={studentEssayRequired?.[sqSection] === false}
                value={studentEssayExamMinutes?.[sqSection] ?? 60}
                onChange={(e) => updateStudentEssayExamMinutes({ [sqSection]: e.target.value })}
                className="w-full bg-transparent text-sm font-black text-slate-800 outline-none text-center disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="min-w-[9.5rem]">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600 block mb-1.5">
              Bắt buộc TL
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={studentEssayRequired?.[sqSection] !== false}
              onClick={() => updateStudentEssayRequired({
                [sqSection]: studentEssayRequired?.[sqSection] === false,
              })}
              className={`w-full min-h-[42px] px-3 rounded-xl border-2 text-xs font-black transition ${
                studentEssayRequired?.[sqSection] === false
                  ? 'border-slate-200 bg-slate-50 text-slate-500'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {studentEssayRequired?.[sqSection] === false ? 'Tắt — chỉ TN' : 'Bật — TN + TL'}
            </button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">
              {mcQuestions.length} TN · {essayQuestions.length} TL
            </span>
            <button
              type="button"
              onClick={() => {
                showGlobalModal({
                  title: 'Xóa toàn bộ ngân hàng?',
                  content: 'Xóa mọi câu trắc nghiệm và tự luận của tất cả môn. Không thể hoàn tác.',
                  type: 'warning',
                  confirmText: 'Xóa toàn bộ',
                  cancelText: 'Huỷ',
                  onConfirm: () => resetStudentQuestions(),
                });
              }}
              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 text-xs font-bold hover:bg-red-100 flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Xóa toàn bộ
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[14rem]">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5">
              Âm thanh cảnh báo phòng thi (TN)
            </label>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Volume2 size={16} className="text-slate-500 shrink-0" />
              {examWarningSoundUrl ? (
                <span className="truncate text-emerald-700">
                  Đã có file — {String(examWarningSoundUrl).split('/').pop()}
                </span>
              ) : (
                <span className="text-slate-400">Chưa tải — dùng beep mặc định</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              MP3 / WAV / OGG / M4A · tối đa 5MB. Chỉ trắc nghiệm; tự luận không chặn.
            </p>
          </div>
          <label className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
            {soundUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {soundUploading ? 'Đang tải...' : 'Tải âm thanh lên'}
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
              className="hidden"
              disabled={soundUploading}
              onChange={handleExamWarningSoundUpload}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              playExamWarningSound(resolveMediaUrl(examWarningSoundUrl) || examWarningSoundUrl);
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
          >
            Nghe thử
          </button>
          {examWarningSoundUrl ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  setExamWarningSoundUrl?.('');
                  await api.settings.updateStudentExamConfig({
                    studentExamMinutes,
                    studentEssayExamMinutes,
                    studentEssayRequired,
                    studentExamFiles,
                    examWarningSoundUrl: '',
                  });
                  toast.success('Đã gỡ âm thanh — dùng beep mặc định');
                } catch (err) {
                  toast.error(err.message || 'Gỡ thất bại');
                }
              }}
              className="px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
            >
              Gỡ file
            </button>
          ) : null}
        </div>
      </div>

      {/* Hai cột: Trắc nghiệm | Tự luận */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── TRẮC NGHIỆM ── */}
        <section className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
          <header className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-600 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks size={18} />
              <h3 className="font-bold text-sm">Trắc nghiệm</h3>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">{mcQuestions.length}</span>
            </div>
          </header>
          <div className="px-3 py-2.5 border-b border-blue-50 flex flex-wrap gap-2 bg-blue-50/40">
            <button
              type="button"
              onClick={() => openAddForm('multiple')}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Thêm câu
            </button>
            <button
              type="button"
              onClick={() => downloadStudentQuestionsExcelTemplate(sqSection, activeSubject?.label, 'multiple')}
              className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
            >
              <Download size={14} /> Mẫu Excel
            </button>
            <label className="bg-white border border-dashed border-blue-300 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-blue-50">
              <FileSpreadsheet size={14} /> Nhập Excel
              <input
                ref={studentQuestionsExcelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleStudentQuestionsExcelFile}
              />
            </label>
          </div>
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={mcSearch}
                onChange={(e) => setMcSearch(e.target.value)}
                placeholder="Tìm câu trắc nghiệm..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[480px] p-2 space-y-0.5">
            {mcQuestions.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Chưa có câu trắc nghiệm"
                hint="Thêm thủ công hoặc nhập từ Excel"
              />
            ) : (
              mcQuestions.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  index={i}
                  showImage
                  onEdit={handleEditQuestion}
                  onDelete={confirmDeleteQuestion}
                />
              ))
            )}
          </div>
        </section>

        {/* ── TỰ LUẬN / THỰC HÀNH ── */}
        <section className="bg-white rounded-2xl border-2 border-violet-100 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
          <header className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PenLine size={18} />
              <h3 className="font-bold text-sm">Tự luận / Thực hành</h3>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">{essayQuestions.length}</span>
            </div>
          </header>
          <div className="px-3 py-2.5 border-b border-violet-50 flex flex-wrap items-center gap-2 bg-red-50/40">
            <button
              type="button"
              onClick={() => openAddForm('essay')}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Thêm câu / đề TH
            </button>
          </div>
          <p className="px-3 py-1.5 text-[11px] text-violet-700 bg-red-50/60 border-b border-violet-50">
            Mỗi câu tự luận có file đề riêng — thêm câu mới sẽ không dùng lại file câu trước.
          </p>
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={tlSearch}
                onChange={(e) => setTlSearch(e.target.value)}
                placeholder="Tìm câu tự luận..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[440px] p-2 space-y-0.5">
            {essayQuestions.length === 0 ? (
              <EmptyState
                icon={PenLine}
                title="Chưa có câu tự luận"
                hint="Thêm câu và tải file đề riêng cho từng câu"
              />
            ) : (
              essayQuestions.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  index={i}
                  onEdit={handleEditQuestion}
                  onDelete={confirmDeleteQuestion}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {/* Modal thêm/sửa câu */}
      {sqForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className={`px-6 py-4 flex items-center justify-between text-white ${sqForm.type === 'essay' ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-red-600 to-red-600'}`}>
              <h3 className="font-bold flex items-center gap-2">
                <HelpCircle size={20} />
                {sqForm.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  {sqForm.type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}
                </span>
              </h3>
              <button type="button" onClick={() => setSqForm(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Môn</label>
                  <CmsSelect
                    value={sqForm.section || sqSection}
                    onChange={(e) => setSqForm({ ...sqForm, section: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-400"
                  >
                    {subjectOpts.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </CmsSelect>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Độ khó</label>
                  <CmsSelect
                    value={sqForm.difficulty}
                    onChange={(e) => setSqForm({ ...sqForm, difficulty: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-400"
                  >
                    <option value="easy">Cơ bản</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Nâng cao</option>
                  </CmsSelect>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Nội dung câu hỏi</label>
                <textarea
                  value={sqForm.q}
                  onChange={(e) => setSqForm({ ...sqForm, q: e.target.value })}
                  rows={3}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-400 resize-none"
                  placeholder="Nhập câu hỏi..."
                />
              </div>

              {sqForm.type === 'multiple' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-2">
                      Hình minh họa <span className="text-slate-400 font-normal normal-case">(tùy chọn)</span>
                    </label>
                    <div className="flex flex-wrap items-start gap-3">
                      {sqForm.imageUrl ? (
                        <div className="relative">
                          <img
                            src={resolveMediaUrl(sqForm.imageUrl)}
                            alt=""
                            className="max-h-32 rounded-xl border border-slate-200 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setSqForm({ ...sqForm, imageUrl: '', imageName: '' })}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center w-full sm:w-48 h-28 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/30 cursor-pointer hover:bg-blue-50 ${imageUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                          {imageUploading ? (
                            <Loader2 size={24} className="animate-spin text-blue-500" />
                          ) : (
                            <>
                              <ImageIcon size={24} className="text-blue-400 mb-1" />
                              <span className="text-xs font-bold text-blue-600">Thêm hình ảnh</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.jfif" onChange={handleQuestionImageUpload} />
                        </label>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-2">
                      Đáp án — bấm chữ cái để chọn đúng
                    </label>
                    <div className="space-y-2">
                      {(sqForm.options || ['', '', '', '']).map((opt, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition ${sqForm.correct === i ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100'}`}
                        >
                          <button
                            type="button"
                            onClick={() => setSqForm({ ...sqForm, correct: i })}
                            className={`w-7 h-7 rounded-lg shrink-0 text-xs font-black ${sqForm.correct === i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {['A', 'B', 'C', 'D'][i]}
                          </button>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const o = [...(sqForm.options || [])];
                              o[i] = e.target.value;
                              setSqForm({ ...sqForm, options: o });
                            }}
                            className="flex-1 bg-transparent outline-none text-sm"
                            placeholder={`Đáp án ${['A', 'B', 'C', 'D'][i]}...`}
                          />
                          {sqForm.correct === i && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {sqForm.type === 'essay' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-2">
                      File đề riêng (PDF / Excel) <span className="text-slate-400 font-normal normal-case">— chỉ gắn với câu này</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {sqForm.attachedFileUrl ? (
                        <>
                          <a
                            href={buildMediaDownloadUrl(sqForm.attachedFileUrl, sqForm.attachedFileName)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold max-w-full"
                          >
                            <FileText size={15} className="shrink-0" />
                            <span className="truncate">{sqForm.attachedFileName || 'Đề thực hành'}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setSqForm({ ...sqForm, attachedFileUrl: '', attachedFileName: '' })}
                            className="p-2 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-100"
                            title="Xóa file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <label className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/60 text-orange-900 text-xs font-bold cursor-pointer hover:bg-orange-100 ${pdfUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                          {pdfUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          Chọn file PDF / Excel
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            onChange={handleEssayPdfUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Gợi ý chấm / đáp án mẫu</label>
                    <textarea
                      value={sqForm.sampleAnswer || ''}
                      onChange={(e) => setSqForm({ ...sqForm, sampleAnswer: e.target.value })}
                      rows={3}
                      className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-violet-400 resize-none"
                      placeholder="Nội dung gợi ý cho giáo viên chấm..."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setSqForm(null)} className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-600 text-sm">
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${sqForm.type === 'essay' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                <Save size={16} /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
