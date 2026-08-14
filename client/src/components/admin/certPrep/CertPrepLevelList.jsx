import { ArrowDown, ArrowUp, Loader2, Pencil, Power, ChevronRight } from 'lucide-react';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepLevelList({
  levels,
  loading,
  onCreate,
  onEdit,
  onToggle,
  onOpen,
  onMove,
}) {
  if (loading) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải level...
      </div>
    );
  }
  if (!levels?.length) {
    return (
      <CertPrepEmptyState
        title="Chưa có level nào."
        hint="Thêm Level 1, Level 2, Level 3… Ngôn ngữ thuộc đề thi, không thuộc level."
        actionLabel="Thêm level"
        onAction={onCreate}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {levels.map((lv, idx) => (
        <div key={lv._id || lv.id} className="cms-card flex flex-col gap-3">
          <div>
            <p className="text-base font-bold text-slate-900">{lv.title}</p>
            <p className="text-sm text-slate-500">{lv.subtitle || '—'}</p>
            <p className={`text-xs font-bold mt-1 ${lv.isActive === false ? 'text-slate-400' : 'text-emerald-600'}`}>
              {lv.isActive === false ? 'Tắt' : 'Bật'} · Thứ tự {lv.sortOrder}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof onMove === 'function' ? (
              <>
                <button type="button" aria-label={`Đưa ${lv.title} lên`} disabled={idx === 0} onClick={() => onMove(idx, -1)} className="w-10 h-10 rounded-xl bg-slate-100 disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" aria-label={`Đưa ${lv.title} xuống`} disabled={idx === levels.length - 1} onClick={() => onMove(idx, 1)} className="w-10 h-10 rounded-xl bg-slate-100 disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => onOpen(lv)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-red-600 text-white inline-flex items-center gap-1">
              Xem đề thi <ChevronRight size={14} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onEdit(lv)} aria-label={`Sửa ${lv.title}`} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-slate-100">
              <Pencil size={14} className="inline mr-1" aria-hidden="true" /> Sửa
            </button>
            <button type="button" onClick={() => onToggle(lv)} className="min-h-10 px-3 rounded-xl text-xs font-bold bg-slate-100">
              <Power size={14} className="inline mr-1" aria-hidden="true" /> {lv.isActive === false ? 'Bật' : 'Vô hiệu hóa'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
