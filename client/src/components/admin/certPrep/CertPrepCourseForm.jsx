import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import CertPrepImageUploader from './CertPrepImageUploader';
import CertPrepConfirmDialog from './CertPrepConfirmDialog';

function slugify(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
}

export default function CertPrepCourseForm({ course, saving, onSave, onClose }) {
  const [form, setForm] = useState({
    name: course?.name || '',
    slug: course?.slug || '',
    description: course?.description || '',
    logoUrl: course?.logoUrl || '',
    sortOrder: course?.sortOrder ?? 0,
    isActive: course?.isActive !== false,
  });
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [dirtyConfirm, setDirtyConfirm] = useState(false);
  const [slugManual, setSlugManual] = useState(Boolean(course?.slug));

  const patch = (next) => {
    setDirty(true);
    setForm((p) => ({ ...p, ...next }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!String(form.name).trim()) {
      setError('Tên khóa học bắt buộc');
      return;
    }
    const slug = String(form.slug || '').trim() || slugify(form.name);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('Slug chỉ gồm chữ thường, số và dấu gạch ngang');
      return;
    }
    onSave({ ...form, name: form.name.trim(), slug });
  };

  return (
    <div className="cms-modal-shell">
      <form onSubmit={submit} className="cms-modal-panel" role="dialog" aria-modal="true" aria-labelledby="cert-prep-course-title">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id="cert-prep-course-title" className="text-base font-bold">{course ? 'Sửa khóa học' : 'Thêm khóa học'}</h3>
          <button type="button" aria-label="Đóng" onClick={() => (dirty ? setDirtyConfirm(true) : onClose())} className="w-10 h-10 rounded-xl hover:bg-slate-50"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-600">Tên khóa học</span>
            <input
              required
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                patch({ name, slug: slugManual ? form.slug : slugify(name) });
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-600">Slug</span>
            <input
              value={form.slug}
              onChange={(e) => { setSlugManual(true); patch({ slug: e.target.value.toLowerCase() }); }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-600">Mô tả</span>
            <textarea rows={3} value={form.description} onChange={(e) => patch({ description: e.target.value })} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm" />
          </label>
          <CertPrepImageUploader label="Logo" value={form.logoUrl} onChange={(logoUrl) => patch({ logoUrl })} />
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-600">Thứ tự</span>
            <input type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.isActive} onChange={(e) => patch({ isActive: e.target.checked })} />
            Đang bật
          </label>
          {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button type="button" onClick={() => (dirty ? setDirtyConfirm(true) : onClose())} className="min-h-11 px-4 rounded-xl font-bold text-sm">Hủy</button>
          <button type="submit" disabled={saving} className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60 inline-flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null} Lưu
          </button>
        </div>
      </form>
      <CertPrepConfirmDialog
        open={dirtyConfirm}
        title="Thay đổi chưa lưu"
        message="Bạn có thay đổi chưa lưu."
        confirmText="Đóng"
        onCancel={() => setDirtyConfirm(false)}
        onConfirm={() => { setDirtyConfirm(false); onClose(); }}
      />
    </div>
  );
}
