import { Loader2, Pencil, Power, ChevronRight } from 'lucide-react';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepCourseList({
  courses,
  loading,
  onCreate,
  onEdit,
  onToggle,
  onOpen,
}) {
  if (loading) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải khóa học...
      </div>
    );
  }
  if (!courses?.length) {
    return (
      <CertPrepEmptyState
        title="Chưa có khóa học nào."
        hint="Tạo khóa MOS hoặc IC3 để bắt đầu ngân hàng ôn thi."
        actionLabel="Tạo khóa học"
        onAction={onCreate}
      />
    );
  }
  return (
    <div className="overflow-x-auto cms-card p-0">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3">Tên</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Mô tả</th>
            <th className="px-4 py-3">Thứ tự</th>
            <th className="px-4 py-3">Số Level</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c._id || c.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
              <td className="px-4 py-3 text-slate-500">{c.slug}</td>
              <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{c.description || '—'}</td>
              <td className="px-4 py-3">{c.sortOrder}</td>
              <td className="px-4 py-3">{c.levelCount ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold ${c.isActive === false ? 'text-slate-400' : 'text-emerald-600'}`}>
                  {c.isActive === false ? 'Tắt' : 'Bật'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => onOpen(c)} className="min-h-10 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                    Level <ChevronRight size={14} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => onEdit(c)} aria-label={`Sửa ${c.name}`} className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-600">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => onToggle(c)} aria-label={c.isActive === false ? `Bật ${c.name}` : `Vô hiệu hóa ${c.name}`} className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-600">
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
