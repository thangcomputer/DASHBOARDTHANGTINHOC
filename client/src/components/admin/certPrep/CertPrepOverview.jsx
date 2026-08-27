export default function CertPrepOverview({ courses }) {
  const active = (courses || []).filter((c) => c.isActive !== false).length;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="cms-card">
        <p className="text-xs font-bold text-slate-500 uppercase">Khóa học</p>
        <p className="text-2xl font-black text-slate-900 mt-1">{courses?.length || 0}</p>
      </div>
      <div className="cms-card">
        <p className="text-xs font-bold text-slate-500 uppercase">Đang bật</p>
        <p className="text-2xl font-black text-emerald-600 mt-1">{active}</p>
      </div>
      <div className="cms-card col-span-2 sm:col-span-1">
        <p className="text-xs font-bold text-slate-500 uppercase">Luồng quản lý</p>
        <p className="text-sm font-semibold text-slate-700 mt-1">Khóa › Level › Đề › Câu hỏi</p>
      </div>
    </div>
  );
}
