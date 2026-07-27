import React, { useCallback } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { useAdminTab } from '../AdminTabContext';
import { useData } from '../../../context/DataContext';
import {
  Clock, Trash2, Plus, Download, FileSpreadsheet, Upload, Loader2, FileText,
  Edit3, X, Save, Search, HelpCircle, CheckCircle2, ImageIcon, ListChecks, PenLine,
} from 'lucide-react';
import { downloadTeacherQuestionsExcelTemplate } from '../../../utils/studentQuestionsExcel';
import {
  getStudentMcQuestionsForExam,
  getStudentEssayQuestionsForExam,
  getEssayQuestionFile,
} from '../../../utils/htmlContent';
import api, { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import { getExamSubjectOptions } from '../../../utils/examSubjects';
import { isLegacyTeacherExamSection } from '../../../utils/teacherExamSections';

const DIFF_LABELS = { easy: 'Cơ bản', medium: 'TB', hard: 'Nâng cao' };

/** Các section cũ trong DB chưa có trong catalog — vẫn hiện để admin sửa/xóa */
const LEGACY_SECTION_LABELS = {
  computer: 'Máy tính & Windows (cũ)',
  situation: 'Sư phạm (Tình huống)',
  other: 'Kiến thức khác (cũ)',
};

function buildTeacherSectionOptions(examSubjectsCatalog, questions) {
  const fromCatalog = getExamSubjectOptions(examSubjectsCatalog);
  const known = new Set(fromCatalog.map((o) => o.id));
  const extras = [];
  (questions || []).forEach((q) => {
    const s = String(q?.section || '').trim().toLowerCase();
    if (!s || known.has(s)) return;
    if (s === 'computer' && known.has('coban')) return;
    if (known.has(s)) return;
    known.add(s);
    extras.push({ id: s, label: LEGACY_SECTION_LABELS[s] || s });
  });
  return [...fromCatalog, ...extras];
}

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

export default function TeacherQuestionBankPanel() {
  const {
    questions,
    teacherExamMinutes,
    updateTeacherExamMinutes,
    teacherEssayExamMinutes,
    updateTeacherEssayExamMinutes,
    teacherExamTimeLimitMinutes,
        addQuestion,
    updateQuestion,
    removeQuestion,
  } = useData();

  const {
    showGlobalModal, resetQuestions, setQForm, BLANK_Q,
    teacherQuestionsExcelInputRef, handleTeacherQuestionsExcelFile,
    toast, qSection, setQSection,
    qForm, examSubjectsCatalog,
  } = useAdminTab();

  const sectionOpts = React.useMemo(
    () => buildTeacherSectionOptions(examSubjectsCatalog, questions),
    [examSubjectsCatalog, questions],
  );

  const teacherExamMinutesRef = React.useRef(teacherExamMinutes);
  const teacherEssayExamMinutesRef = React.useRef(teacherEssayExamMinutes);
  teacherExamMinutesRef.current = teacherExamMinutes;
  teacherEssayExamMinutesRef.current = teacherEssayExamMinutes;

  const minutesSaveTimerRef = React.useRef(null);

  const persistExamMinutes = useCallback(async (tnPatch, tlPatch, { silent = false } = {}) => {
    const normalizeMap = (base, patch) => {
      const next = { ...(base || {}) };
      if (patch) {
        for (const [k, v] of Object.entries(patch)) {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
        }
      }
      return next;
    };
    const mergedTn = normalizeMap(teacherExamMinutesRef.current, tnPatch);
    const mergedTl = normalizeMap(teacherEssayExamMinutesRef.current, tlPatch);
    try {
      const res = await api.settings.updateTeacherExamConfig({
        teacherExamMinutes: mergedTn,
        teacherEssayExamMinutes: mergedTl,
      });
      if (!res?.success) throw new Error(res?.message || 'Lưu thất bại');
      const savedTn = res.data?.teacherExamMinutes;
      const savedTl = res.data?.teacherEssayExamMinutes;
      updateTeacherExamMinutes(savedTn && typeof savedTn === 'object' ? savedTn : mergedTn);
      updateTeacherEssayExamMinutes(savedTl && typeof savedTl === 'object' ? savedTl : mergedTl);
      if (!silent) toast.success('Đã lưu thời gian thi');
    } catch (err) {
      toast.error(err.message || 'Lưu thời gian thất bại');
    }
  }, [toast, updateTeacherExamMinutes, updateTeacherEssayExamMinutes]);

  const schedulePersistExamMinutes = useCallback((tnPatch, tlPatch) => {
    if (minutesSaveTimerRef.current) clearTimeout(minutesSaveTimerRef.current);
    minutesSaveTimerRef.current = setTimeout(() => {
      persistExamMinutes(tnPatch, tlPatch, { silent: true });
    }, 700);
  }, [persistExamMinutes]);

  React.useEffect(() => () => {
    if (minutesSaveTimerRef.current) clearTimeout(minutesSaveTimerRef.current);
  }, []);

  const activeSection = sectionOpts.find((s) => s.id === qSection) || sectionOpts[0];

  React.useEffect(() => {
    if (!sectionOpts.length) return;
    const valid = sectionOpts.some((o) => o.id === qSection);
    if (!valid) setQSection(sectionOpts[0].id);
  }, [sectionOpts, qSection, setQSection]);

  const [mcSearch, setMcSearch] = React.useState('');
  const [tlSearch, setTlSearch] = React.useState('');
  const [imageUploading, setImageUploading] = React.useState(false);
  const [pdfUploading, setPdfUploading] = React.useState(false);

  React.useEffect(() => {
    setMcSearch('');
    setTlSearch('');
  }, [qSection]);

  const mcQuestions = React.useMemo(() => {
    const list = getStudentMcQuestionsForExam(questions, qSection);
    const q = mcSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => String(item.q || '').toLowerCase().includes(q));
  }, [questions, qSection, mcSearch]);

  const essayQuestions = React.useMemo(() => {
    const list = getStudentEssayQuestionsForExam(questions, qSection);
    const q = tlSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => String(item.q || '').toLowerCase().includes(q));
  }, [questions, qSection, tlSearch]);

  const handleEssayPdfUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !qForm) return;
    setPdfUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setQForm({
        ...qForm,
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

  const handleQuestionImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !qForm) return;
    setImageUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data.success) throw new Error(data.message || 'Upload thất bại');
      setQForm({
        ...qForm,
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
      content: 'Câu hỏi sẽ bị xóa khỏi ngân hàng đề thi giảng viên.',
      type: 'warning',
      confirmText: 'Xóa',
      cancelText: 'Huỷ',
      onConfirm: () => removeQuestion(q.id),
    });
  };

  const openAddForm = (type) => {
    if (String(type).toLowerCase() !== 'essay' && qSection === 'other') {
      toast.error('Phần "Kiến thức khác" là mục cũ — chọn môn chuyên môn hoặc Sư phạm.');
      return;
    }
    setQForm({
      ...BLANK_Q,
      type,
      section: qSection,
      imageUrl: '',
      imageName: '',
      attachedFileUrl: '',
      attachedFileName: '',
    });
  };

  const handleEditQuestion = (q) => {
    const file = getEssayQuestionFile(q);
    setQForm({
      ...q,
      attachedFileUrl: file?.fileUrl || '',
      attachedFileName: file?.fileName || '',
    });
  };

  const handleSaveQuestion = async () => {
    const section = qForm.section || qSection;
    const isEssay = String(qForm.type).toLowerCase() === 'essay';
    const fileUrl = String(qForm.attachedFileUrl || '').trim();
    const fileName = String(qForm.attachedFileName || '').trim();

    if (isEssay) {
      const hasText = Boolean(qForm.q?.trim());
      const hasFile = Boolean(fileUrl);
      if (!hasText && !hasFile) {
        toast.error('Nhập nội dung câu hỏi hoặc tải file đề PDF/Excel!');
        return;
      }
    } else {
      if (!qForm.q?.trim()) {
        toast.error('Vui lòng nhập câu hỏi!');
        return;
      }
      if ((qForm.options || []).filter((o) => o?.trim()).length < 2) {
        toast.error('Cần ít nhất 2 đáp án!');
        return;
      }
    }

    const qText = qForm.q?.trim()
      || (isEssay && fileUrl ? 'Làm bài theo đề thực hành đính kèm.' : '');

    const payload = {
      ...qForm,
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
    if (qForm.id) {
      updateQuestion(qForm.id, payload);
      nextQuestions = (questions || []).map((q) => (
        q.id === qForm.id ? { ...q, ...payload, id: qForm.id } : q
      ));
    } else {
      const newItem = { ...payload, id: `q_${Date.now()}`, createdAt: Date.now() };
      addQuestion(newItem);
      nextQuestions = [...(questions || []), newItem];
    }

    try {
      await api.settings.updateTeacherExamConfig({
        questions: nextQuestions,
        teacherExamMinutes,
        teacherEssayExamMinutes,
      });
      toast.success(qForm.id ? 'Đã cập nhật!' : 'Đã thêm câu hỏi!');
      setQForm(null);
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
              value={qSection}
              onChange={(e) => setQSection(e.target.value)}
              className="w-full border-2 border-red-200 rounded-xl px-3 py-2.5 text-sm font-bold text-red-900 bg-red-50/40 outline-none focus:border-red-500"
            >
              {sectionOpts.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </CmsSelect>
            {isLegacyTeacherExamSection(qSection) && (
              <p className="mt-1.5 text-[11px] font-bold text-amber-700 leading-snug">
                Phần cũ — không đưa vào đề thi GV. Chuyển câu sang môn chuyên môn hoặc xóa.
              </p>
            )}
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
                value={teacherExamMinutes?.[qSection] ?? 90}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateTeacherExamMinutes({ [qSection]: raw });
                  const n = Number(raw);
                  if (Number.isFinite(n) && n >= 1 && n <= 600) {
                    schedulePersistExamMinutes({ [qSection]: n }, null);
                  }
                }}
                onBlur={(e) => {
                  if (minutesSaveTimerRef.current) clearTimeout(minutesSaveTimerRef.current);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= 600) {
                    persistExamMinutes({ [qSection]: n }, null);
                  }
                }}
                className="w-full bg-transparent text-sm font-black text-slate-800 outline-none text-center"
              />
            </div>
          </div>
          <div className="w-28">
            <label className="text-[11px] font-bold uppercase tracking-wide text-violet-700 block mb-1.5">
              Phút TL
            </label>
            <div className="flex items-center gap-1.5 border-2 border-violet-200 bg-violet-50/80 rounded-xl px-2.5 py-2">
              <Clock size={14} className="text-violet-700 shrink-0" />
              <input
                type="number"
                min={1}
                max={600}
                value={teacherEssayExamMinutes?.[qSection] ?? 60}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateTeacherEssayExamMinutes({ [qSection]: raw });
                  const n = Number(raw);
                  if (Number.isFinite(n) && n >= 1 && n <= 600) {
                    schedulePersistExamMinutes(null, { [qSection]: n });
                  }
                }}
                onBlur={(e) => {
                  if (minutesSaveTimerRef.current) clearTimeout(minutesSaveTimerRef.current);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= 600) {
                    persistExamMinutes(null, { [qSection]: n });
                  }
                }}
                className="w-full bg-transparent text-sm font-black text-slate-800 outline-none text-center"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">
              {mcQuestions.length} TN · {essayQuestions.length} TL
            </span>
            <button
              type="button"
              onClick={() => persistExamMinutes(teacherExamMinutesRef.current, teacherEssayExamMinutesRef.current)}
              className="px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 text-xs font-bold hover:bg-emerald-100"
            >
              Lưu thời gian
            </button>
            <button
              type="button"
              onClick={() => {
                showGlobalModal({
                  title: 'Xóa toàn bộ ngân hàng?',
                  content: 'Xóa mọi câu trắc nghiệm và tự luận của tất cả môn. Không thể hoàn tác.',
                  type: 'warning',
                  confirmText: 'Xóa toàn bộ',
                  cancelText: 'Huỷ',
                  onConfirm: () => resetQuestions(),
                });
              }}
              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 text-xs font-bold hover:bg-red-100 flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Xóa toàn bộ
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-snug text-slate-500">
          Thời gian áp dụng cho môn này:{' '}
          <span className="text-amber-800">{teacherExamMinutes?.[qSection] ?? 90} phút TN</span>
          {' '}(phần trắc nghiệm)
          {essayQuestions.length > 0 && (
            <>
              {' · '}
              <span className="text-violet-800">{teacherEssayExamMinutes?.[qSection] ?? 60} phút TL</span>
              {' '}(phần tự luận — đồng hồ riêng sau khi đạt TN)
            </>
          )}
          . Chỉ tính môn có câu hỏi trong đề, không cộng môn trống.
        </p>
      </div>

      {/* Hai cột: Trắc nghiệm | Tự luận */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── TRẮC NGHIỆM ── */}
        <section className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
          <header className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between gap-2">
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Thêm câu
            </button>
            <button
              type="button"
              onClick={() => downloadTeacherQuestionsExcelTemplate(qSection, activeSection?.label, 'multiple')}
              className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
            >
              <Download size={14} /> Mẫu Excel
            </button>
            <label className="bg-white border border-dashed border-blue-300 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-blue-50">
              <FileSpreadsheet size={14} /> Nhập Excel
              <input
                ref={teacherQuestionsExcelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleTeacherQuestionsExcelFile}
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
          <header className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PenLine size={18} />
              <h3 className="font-bold text-sm">Tự luận / Thực hành</h3>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">{essayQuestions.length}</span>
            </div>
          </header>
          <div className="px-3 py-2.5 border-b border-violet-50 flex flex-wrap items-center gap-2 bg-violet-50/40">
            <button
              type="button"
              onClick={() => openAddForm('essay')}
              className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Thêm câu / đề TH
            </button>
          </div>
          <p className="px-3 py-1.5 text-[11px] text-violet-700 bg-violet-50/60 border-b border-violet-50">
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
      {qForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className={`px-6 py-4 flex items-center justify-between text-white ${qForm.type === 'essay' ? 'bg-gradient-to-r from-violet-600 to-purple-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
              <h3 className="font-bold flex items-center gap-2">
                <HelpCircle size={20} />
                {qForm.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  {qForm.type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}
                </span>
              </h3>
              <button type="button" onClick={() => setQForm(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Môn</label>
                  <CmsSelect
                    value={qForm.section || qSection}
                    onChange={(e) => setQForm({ ...qForm, section: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-400"
                  >
                    {sectionOpts.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </CmsSelect>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Độ khó</label>
                  <CmsSelect
                    value={qForm.difficulty}
                    onChange={(e) => setQForm({ ...qForm, difficulty: e.target.value })}
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
                  value={qForm.q}
                  onChange={(e) => setQForm({ ...qForm, q: e.target.value })}
                  rows={3}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-400 resize-none"
                  placeholder="Nhập câu hỏi..."
                />
              </div>

              {qForm.type === 'multiple' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-2">
                      Hình minh họa <span className="text-slate-400 font-normal normal-case">(tùy chọn)</span>
                    </label>
                    <div className="flex flex-wrap items-start gap-3">
                      {qForm.imageUrl ? (
                        <div className="relative">
                          <img
                            src={resolveMediaUrl(qForm.imageUrl)}
                            alt=""
                            className="max-h-32 rounded-xl border border-slate-200 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setQForm({ ...qForm, imageUrl: '', imageName: '' })}
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
                      {(qForm.options || ['', '', '', '']).map((opt, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition ${qForm.correct === i ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100'}`}
                        >
                          <button
                            type="button"
                            onClick={() => setQForm({ ...qForm, correct: i })}
                            className={`w-7 h-7 rounded-lg shrink-0 text-xs font-black ${qForm.correct === i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {['A', 'B', 'C', 'D'][i]}
                          </button>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const o = [...(qForm.options || [])];
                              o[i] = e.target.value;
                              setQForm({ ...qForm, options: o });
                            }}
                            className="flex-1 bg-transparent outline-none text-sm"
                            placeholder={`Đáp án ${['A', 'B', 'C', 'D'][i]}...`}
                          />
                          {qForm.correct === i && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {qForm.type === 'essay' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-2">
                      File đề riêng (PDF / Excel) <span className="text-slate-400 font-normal normal-case">— chỉ gắn với câu này</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {qForm.attachedFileUrl ? (
                        <>
                          <a
                            href={buildMediaDownloadUrl(qForm.attachedFileUrl, qForm.attachedFileName)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold max-w-full"
                          >
                            <FileText size={15} className="shrink-0" />
                            <span className="truncate">{qForm.attachedFileName || 'Đề thực hành'}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setQForm({ ...qForm, attachedFileUrl: '', attachedFileName: '' })}
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
                      value={qForm.sampleAnswer || ''}
                      onChange={(e) => setQForm({ ...qForm, sampleAnswer: e.target.value })}
                      rows={3}
                      className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-violet-400 resize-none"
                      placeholder="Nội dung gợi ý cho giáo viên chấm..."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setQForm(null)} className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-600 text-sm">
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${qForm.type === 'essay' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
