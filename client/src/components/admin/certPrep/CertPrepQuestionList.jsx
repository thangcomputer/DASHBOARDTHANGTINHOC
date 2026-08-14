import { ArrowDown, ArrowUp, Eye, Loader2, Pencil, Power } from 'lucide-react';
import CertPrepEmptyState from './CertPrepEmptyState';
import { questionTypeLabel } from './questionLabels';

export default function CertPrepQuestionList({
  questions,
  loading,
  onCreate,
  onEdit,
  onPreview,
  onToggle,
  onMove,
}) {
  if (loading) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải câu hỏi...
      </div>
    );
  }
  if (!questions?.length) {
    return (
      <CertPrepEmptyState
        title="Chưa có câu hỏi nào."
        hint="Thêm câu một đáp án, nhiều đáp án hoặc ghép cặp."
        actionLabel="Thêm câu hỏi"
        onAction={onCreate}
      />
    );
  }
  return (
    <div className="overflow-x-auto cms-card p-0">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Loại</th>
            <th className="px-4 py-3">Nội dung</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q, idx) => (
            <tr key={q._id || q.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-bold text-slate-500">{idx + 1}</td>
              <td className="px-4 py-3">{questionTypeLabel(q.type)}</td>
              <td className="px-4 py-3 max-w-md truncate">{q.questionText}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold ${q.isActive === false ? 'text-slate-400' : 'text-emerald-600'}`}>
                  {q.isActive === false ? 'Tắt' : 'Bật'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button type="button" aria-label="Đưa lên" disabled={idx === 0} onClick={() => onMove(idx, -1)} className="w-10 h-10 rounded-xl hover:bg-slate-50 disabled:opacity-30">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" aria-label="Đưa xuống" disabled={idx === questions.length - 1} onClick={() => onMove(idx, 1)} className="w-10 h-10 rounded-xl hover:bg-slate-50 disabled:opacity-30">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" aria-label="Xem trước" onClick={() => onPreview(q)} className="w-10 h-10 rounded-xl hover:bg-slate-50">
                    <Eye size={15} />
                  </button>
                  <button type="button" aria-label="Sửa câu hỏi" onClick={() => onEdit(q)} className="w-10 h-10 rounded-xl hover:bg-slate-50">
                    <Pencil size={15} />
                  </button>
                  <button type="button" aria-label={q.isActive === false ? 'Bật câu hỏi' : 'Vô hiệu hóa câu hỏi'} onClick={() => onToggle(q)} className="w-10 h-10 rounded-xl hover:bg-slate-50">
                    <Power size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
