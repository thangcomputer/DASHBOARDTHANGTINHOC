import { Eye, Loader2, Pencil, Power } from 'lucide-react';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepTestList({
  tests,
  loading,
  onCreate,
  onEdit,
  onToggle,
  onQuestions,
  onPreview,
  onPromptUpload,
  onPromptRemove,
}) {
  if (loading) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải đề thi...
      </div>
    );
  }
  if (!tests?.length) {
    return (
      <CertPrepEmptyState
        title="Chưa có đề thi nào."
        hint="Tạo đề Tiếng Việt và English riêng trong cùng một level."
        actionLabel="Thêm đề thi"
        onAction={onCreate}
      />
    );
  }
  return (
    <div className="space-y-3">
      {tests.map((t) => (
        <div key={t._id || t.id} className="cms-card">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-base font-bold text-slate-900">{t.name}</p>
              <p className="text-sm text-slate-500 mt-1">
                {t.locale === 'en' ? 'English' : 'Tiếng Việt'} · {t.questionCount} câu · {t.timeLimitMinutes} phút · đạt {t.passingScore}
                {t.allowRetake === false ? ' · không thi lại' : t.maxAttempts ? ` · tối đa ${t.maxAttempts} lần` : ' · không giới hạn lần'}
              </p>
              <p className={`text-xs font-bold mt-1 ${t.isActive === false ? 'text-slate-400' : 'text-emerald-600'}`}>
                {t.isActive === false ? 'Tắt' : 'Bật'}
              </p>
              <p className={`text-xs font-bold mt-1 ${t.essayPromptFile?.url ? 'text-emerald-600' : 'text-amber-600'}`}>
                {t.essayPromptFile?.url ? `Đã có file tự luận: ${t.essayPromptFile.originalName || 'tài liệu'}` : 'Thiếu file đề tự luận'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="min-h-10 px-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 inline-flex items-center cursor-pointer">
                {t.essayPromptFile?.url ? 'Thay file tự luận' : 'Tải file tự luận'}
                <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPromptUpload?.(t, f); }} />
              </label>
              {t.essayPromptFile?.url ? <button type="button" onClick={() => onPromptRemove?.(t)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-red-50 text-red-700">Xóa file</button> : null}
              <button type="button" onClick={() => onQuestions(t)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-red-600 text-white">Câu hỏi</button>
              <button type="button" onClick={() => onPreview(t)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-slate-100 inline-flex items-center gap-1">
                <Eye size={14} aria-hidden="true" /> Preview đề
              </button>
              <button type="button" onClick={() => onEdit(t)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-slate-100">
                <Pencil size={14} className="inline mr-1" aria-hidden="true" /> Sửa
              </button>
              <button type="button" onClick={() => onToggle(t)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-slate-100">
                <Power size={14} className="inline mr-1" aria-hidden="true" /> {t.isActive === false ? 'Bật' : 'Vô hiệu hóa'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
