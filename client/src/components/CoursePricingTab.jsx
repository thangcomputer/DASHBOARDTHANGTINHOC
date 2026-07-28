/**
 * CoursePricingTab.jsx
 * Quản lý Đơn giá Khóa học — CRUD Table + Modal
 * Tích hợp trong SystemSettingsTab
 */

import { useState, useEffect, useCallback } from 'react';
import CmsSelect from './ui/CmsSelect';
import {
  Plus, Edit2, Trash2, Save, X, Loader2, AlertCircle,
  DollarSign, Percent, Tag, BookOpen, CheckCircle2
} from 'lucide-react';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import { useData } from '../context/DataContext';
import { apiFetch } from '../services/api';
import {
  getExamSubjectOptions,
  formatExamSubjectsSummary,
  mapCourseToExamSubjectIds,
  slugifyExamSubjectId,
} from '../utils/examSubjects';

const API = import.meta.env.VITE_API_URL || '';

// ── Helper ────────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const calcEffective = (price, pct) =>
  pct > 0 ? Math.round(Number(price) * (1 - Number(pct) / 100)) : Number(price);

function getCourseExamSubjectIds(c, catalog) {
  if (Array.isArray(c?.examSubjects) && c.examSubjects.length) return c.examSubjects;
  return mapCourseToExamSubjectIds(c?.name, catalog);
}

function resolveExamSubjectId(inputId, label) {
  const fromInput = slugifyExamSubjectId(inputId);
  const fromLabel = slugifyExamSubjectId(label);
  if (fromInput && fromInput.length >= 2) return fromInput;
  return fromLabel;
}

// ── Modal Thêm/Sửa ────────────────────────────────────────────────────────────
function CourseModal({
  course,
  otherCourses = [],
  examSubjectsCatalog,
  addCustomExamSubject,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const isEdit = !!course?._id;

  const [form, setForm] = useState({
    name:            course?.name || '',
    price:           course?.price || '',
    discountPercent: course?.discountPercent || 0,
    totalSessions:   course?.totalSessions || 12,
    category:        course?.category || 'van-phong',
    examSubjects:    Array.isArray(course?.examSubjects) && course.examSubjects.length
      ? [...course.examSubjects]
      : ['coban', 'word', 'excel', 'powerpoint'],
    description:     course?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [importCourseId, setImportCourseId] = useState('');
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectLabel, setNewSubjectLabel] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);

  const examOptions = getExamSubjectOptions(examSubjectsCatalog);

  const effective = calcEffective(form.price, form.discountPercent);
  const hasDiscount = Number(form.discountPercent) > 0 && Number(form.price) > 0;
  const selectedCount = Array.isArray(form.examSubjects) ? form.examSubjects.length : 0;

  const mergeExamSubjectsFromCourse = (sourceCourse) => {
    if (!sourceCourse) return;
    const ids = getCourseExamSubjectIds(sourceCourse, examSubjectsCatalog);
    if (!ids.length) {
      toast.error(`Khóa "${sourceCourse.name}" chưa có môn thi để gộp`);
      return;
    }
    setForm((f) => {
      const current = Array.isArray(f.examSubjects) ? f.examSubjects : [];
      return { ...f, examSubjects: [...new Set([...current, ...ids])] };
    });
    toast.success(`Đã gộp ${ids.length} môn từ "${sourceCourse.name}"`);
    setImportCourseId('');
  };

  const handleAddNewExamSubject = async () => {
    const label = newSubjectLabel.trim();
    if (!label) {
      toast.error('Nhập tên môn thi mới');
      return;
    }
    const id = resolveExamSubjectId(newSubjectId.trim(), label);
    if (!id || id.length < 2) {
      toast.error('Tên môn thi quá ngắn hoặc mã không hợp lệ');
      return;
    }
    if (typeof addCustomExamSubject !== 'function') {
      toast.error('Chưa kết nối API thêm môn thi');
      return;
    }
    setAddingSubject(true);
    try {
      const subject = await addCustomExamSubject({ id, label });
      setForm((f) => {
        const current = Array.isArray(f.examSubjects) ? f.examSubjects : [];
        return { ...f, examSubjects: [...new Set([...current, subject.id])] };
      });
      setNewSubjectLabel('');
      setNewSubjectId('');
      setShowNewSubject(false);
      toast.success(`Đã thêm môn "${subject.label}" vào danh mục`);
    } catch (err) {
      toast.error(err?.message || 'Không thể thêm môn thi');
    } finally {
      setAddingSubject(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên khóa học'); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error('Giá gốc không hợp lệ'); return; }
    if (!form.examSubjects?.length) { toast.error('Chọn ít nhất một môn thi cho khóa học'); return; }

    setSaving(true);
    try {
      const endpoint = isEdit ? `/courses/${course._id}` : '/courses';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = {
        name:            form.name.trim(),
        price:           Number(form.price),
        discountPercent: Number(form.discountPercent),
        discountPrice:   effective,
        totalSessions:   Number(form.totalSessions),
        category:        form.category,
        examSubjects:    form.examSubjects,
        description:     form.description,
        status:          'published',
      };

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        toast.success(isEdit ? `✅ Đã cập nhật "${form.name}"` : `✅ Đã thêm "${form.name}"`);
        onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Lỗi lưu dữ liệu');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[min(92vh,920px)]">
        {/* Header lớn — cùng kiểu modal học viên */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6 flex items-center justify-between flex-shrink-0">
          <h3 className="text-white font-black text-xl sm:text-2xl flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
              <BookOpen size={28} />
            </div>
            {isEdit ? 'Sửa khóa học' : 'Thêm khóa học mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 sm:p-10 overflow-y-auto w-full flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            {/* Cột trái: Thông tin & học phí */}
            <div className="space-y-5 md:border-r border-gray-100 md:pr-10">
              <h4 className="font-black text-gray-400 text-xs mb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs shadow-lg shadow-red-200">1</span>
                Thông tin khóa học
              </h4>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Tên khóa học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[20px] p-4 font-bold text-gray-800 outline-none transition-all shadow-sm"
                  placeholder="VD: THVP Nâng Cao (12 Buổi)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Số buổi học</label>
                  <input
                    type="number"
                    value={form.totalSessions}
                    onChange={e => setForm(f => ({ ...f, totalSessions: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[20px] px-4 py-4 text-sm font-bold outline-none transition-all shadow-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Giảm giá (%)</label>
                  <div className="flex items-center bg-gray-50 border-2 border-transparent focus-within:border-red-400 focus-within:bg-white rounded-[20px] px-4 py-4 transition-all shadow-sm gap-1">
                    <Percent size={14} className="text-red-400 flex-shrink-0" />
                    <input
                      type="number"
                      value={form.discountPercent}
                      onChange={e => setForm(f => ({ ...f, discountPercent: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                      className="flex-1 text-sm font-mono outline-none bg-transparent min-w-0 font-bold"
                      placeholder="0"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                    Giá gốc (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center bg-gray-50 border-2 border-transparent focus-within:border-blue-600 focus-within:bg-white rounded-[20px] px-4 py-4 transition-all shadow-sm gap-1">
                    <DollarSign size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="number"
                      value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      className="flex-1 text-sm font-mono outline-none bg-transparent min-w-0 font-bold"
                      placeholder="2699000"
                      min="0"
                      step="10000"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Giá thu thực tế</label>
                  <div className={`rounded-[20px] px-4 py-3 border-2 min-h-[56px] flex flex-col justify-center shadow-sm transition ${
                    hasDiscount ? 'border-red-200 bg-red-50' : 'border-transparent bg-gray-50'
                  }`}>
                    {hasDiscount ? (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="line-through text-gray-400 text-[11px]">{fmt(form.price)}đ</span>
                          <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            -{form.discountPercent}%
                          </span>
                        </div>
                        <span className="text-base font-black text-red-600 leading-tight">{fmt(effective)}đ</span>
                      </>
                    ) : (
                      <span className="text-base font-black text-blue-700 leading-tight">
                        {form.price ? `${fmt(Number(form.price))}đ` : '—'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {hasDiscount && form.price && (
                <p className="text-[11px] text-red-500 font-bold -mt-2">
                  Tiết kiệm: {fmt(Number(form.price) - effective)}đ
                </p>
              )}

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Mô tả ngắn (tùy chọn)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[20px] px-4 py-3 text-sm font-medium outline-none resize-none transition-all shadow-sm"
                  placeholder="Mô tả ngắn về khóa học..."
                />
              </div>
            </div>

            {/* Cột phải: Môn thi */}
            <div className="space-y-5 md:pl-2">
              <h4 className="font-black text-gray-400 text-xs mb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs shadow-lg shadow-red-200">2</span>
                Môn thi trong Phòng Thi ({selectedCount})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {examOptions.map(({ id, label }) => {
                  const selected = Array.isArray(form.examSubjects) ? form.examSubjects : [];
                  const checked = selected.includes(id);
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-2 border-2 rounded-2xl px-3 py-2.5 cursor-pointer transition ${
                        checked ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((f) => {
                            const current = Array.isArray(f.examSubjects) ? f.examSubjects : [];
                            const next = checked
                              ? current.filter((x) => x !== id)
                              : [...current, id];
                            return { ...f, examSubjects: next };
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm font-semibold text-gray-700">{label}</span>
                      {examSubjectsCatalog?.[id]?.custom && (
                        <span className="ml-auto text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Mới</span>
                      )}
                    </label>
                  );
                })}
              </div>

              {otherCourses.length > 0 && (
                <div className="pt-3 border-t border-dashed border-gray-200 space-y-2">
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Gộp môn từ khóa học khác</p>
                  <div className="flex gap-2">
                    <CmsSelect
                      value={importCourseId}
                      onChange={(e) => setImportCourseId(e.target.value)}
                      className="flex-1 min-w-0 border-2 border-gray-100 rounded-2xl px-3 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50 focus:border-blue-400 outline-none"
                    >
                      <option value="">Chọn khóa học...</option>
                      {otherCourses.map((c) => {
                        const n = getCourseExamSubjectIds(c, examSubjectsCatalog).length;
                        return (
                          <option key={c._id} value={c._id}>
                            {c.name} ({n} môn)
                          </option>
                        );
                      })}
                    </CmsSelect>
                    <button
                      type="button"
                      disabled={!importCourseId}
                      onClick={() => {
                        const src = otherCourses.find((c) => String(c._id) === String(importCourseId));
                        mergeExamSubjectsFromCourse(src);
                      }}
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      title="Thêm môn thi từ khóa đã chọn"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {otherCourses.slice(0, 6).map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => mergeExamSubjectsFromCourse(c)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition"
                        title={`Gộp môn thi từ ${c.name}`}
                      >
                        <Plus size={12} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-dashed border-gray-200">
                {!showNewSubject ? (
                  <button
                    type="button"
                    onClick={() => setShowNewSubject(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-3 rounded-2xl hover:bg-emerald-100 transition"
                  >
                    <Plus size={14} /> Thêm môn thi mới vào hệ thống
                  </button>
                ) : (
                  <div className="space-y-2 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase">Tạo môn thi mới</p>
                    <input
                      type="text"
                      value={newSubjectLabel}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewSubjectLabel(v);
                        setNewSubjectId(slugifyExamSubjectId(v));
                      }}
                      className="w-full border-2 border-emerald-100 rounded-xl px-3 py-2 text-sm focus:border-emerald-400 outline-none bg-white"
                      placeholder="VD: Adobe Photoshop, AutoCAD..."
                    />
                    <input
                      type="text"
                      value={newSubjectId}
                      onChange={(e) => setNewSubjectId(slugifyExamSubjectId(e.target.value))}
                      className="w-full border-2 border-emerald-100 rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-400 outline-none bg-white"
                      placeholder="Mã môn (tự động): adobe-photoshop"
                    />
                    {newSubjectLabel.trim() && (
                      <p className="text-[10px] text-emerald-700">
                        Mã sẽ lưu: <strong>{resolveExamSubjectId(newSubjectId.trim(), newSubjectLabel.trim()) || '—'}</strong>
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowNewSubject(false); setNewSubjectLabel(''); setNewSubjectId(''); }}
                        className="flex-1 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-white"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={addingSubject}
                        onClick={handleAddNewExamSubject}
                        className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                      >
                        {addingSubject ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Lưu & chọn
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-400 font-medium">
                Học viên đăng ký khóa này sẽ chỉ thấy các môn thi đã chọn trong Phòng Thi.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 bg-gray-50/50 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 px-6 sm:px-10 pb-6 sm:pb-10 pt-8 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="px-10 py-4 bg-white border-2 border-gray-100 rounded-[22px] text-xs font-black text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-12 py-4 bg-gradient-to-r from-red-600 to-red-600 text-white rounded-[22px] text-xs font-black tracking-widest shadow-xl shadow-red-200 hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 uppercase active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Thêm khóa học')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CoursePricingTab() {
  const toast = useToast();
  const { showModal } = useModal();
  const { examSubjectsCatalog, addCustomExamSubject } = useData();
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalCourse, setModalCourse] = useState(undefined); // undefined=closed, null=add, obj=edit
  const [deleting, setDeleting]     = useState(null);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/courses`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setCourses(res.data);
      })
      .catch(() => toast.error('Không tải được danh sách khóa học'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const handleDelete = async (course) => {
    showModal({
      title: 'Xoá khoá học?',
      content: `Bạnh có chắc chắn muốn xoá khoá học "${course.name}" không? Hành động này không thể hoàn tác và chỉ nên thực hiện nếu không còn học viên nào đang theo học khoá này.`,
      type: 'error',
      confirmText: 'Xoá vĩnh viễn',
      cancelText: 'Huỷ bỏ',
      onConfirm: async () => {
        setDeleting(course._id);
        try {
          const res = await apiFetch(`/courses/${course._id}`, {
            method: 'DELETE',
          }).then((r) => r.json());
          if (res.success) {
            setCourses(prev => prev.filter(c => c._id !== course._id));
            toast.success(`🗑️ Đã xóa "${course.name}"`);
          } else {
            toast.error(res.message || 'Lỗi xóa khóa học');
          }
        } catch {
          toast.error('Lỗi kết nối server');
        } finally {
          setDeleting(null);
        }
      }
    });
  };

  const handleSaved = (updatedCourse) => {
    setCourses(prev => {
      const idx = prev.findIndex(c => c._id === updatedCourse._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedCourse;
        return next;
      }
      return [updatedCourse, ...prev];
    });
  };

  return (
    <div className="space-y-4">
      {/* Modal */}
      {modalCourse !== undefined && (
        <CourseModal
          course={modalCourse}
          otherCourses={courses.filter((c) => !modalCourse?._id || c._id !== modalCourse._id)}
          examSubjectsCatalog={examSubjectsCatalog}
          addCustomExamSubject={addCustomExamSubject}
          onClose={() => setModalCourse(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Tag size={16} className="text-blue-600 shrink-0" />
            <span>Quản lý Học phí Khóa học</span>
          </h3>
          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
            Thay đổi giá chỉ ảnh hưởng học viên đăng ký <strong className="font-semibold text-slate-700">mới</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalCourse(null)}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition shadow-sm shrink-0 w-full sm:w-auto"
        >
          <Plus size={15} /> Thêm khóa học
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-[13px] text-amber-900 flex items-start gap-2.5 leading-relaxed">
        <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong className="font-semibold">Lưu ý giá cũ:</strong> Học viên đã đăng ký trước giữ nguyên giá cũ.
          Điều chỉnh từng học viên → Quản lý Học viên.
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin text-blue-400" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <BookOpen size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Chưa có khóa học nào.</p>
          <button
            type="button"
            onClick={() => setModalCourse(null)}
            className="mt-3 text-blue-600 font-semibold text-sm hover:underline"
          >
            + Thêm khóa học đầu tiên
          </button>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {courses.map((course) => {
              const ep = calcEffective(course.price, course.discountPercent);
              const hasDiscount = course.discountPercent > 0;
              return (
                <article key={course._id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-snug break-words">{course.name}</p>
                      {course.description && (
                        <p className="text-[12px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{course.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setModalCourse(course)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600"
                        title="Sửa"
                        aria-label="Sửa khóa học"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(course)}
                        disabled={deleting === course._id}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 disabled:opacity-50"
                        title="Xóa"
                        aria-label="Xóa khóa học"
                      >
                        {deleting === course._id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500 mb-0.5">Giá gốc</p>
                      <p className={`text-[13px] tabular-nums leading-tight ${hasDiscount ? 'line-through text-slate-400' : 'font-semibold text-slate-800'}`}>
                        {fmt(course.price)}đ
                      </p>
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="text-[11px] text-slate-500 mb-0.5">Giảm giá</p>
                      {hasDiscount ? (
                        <span className="inline-flex text-[12px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                          -{course.discountPercent}%
                        </span>
                      ) : (
                        <span className="text-[13px] text-slate-300">—</span>
                      )}
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[11px] text-slate-500 mb-0.5">Giá áp dụng</p>
                      <p className={`text-[13px] font-semibold tabular-nums leading-tight ${hasDiscount ? 'text-red-600' : 'text-blue-700'}`}>
                        {fmt(ep)}đ
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                    <span>
                      {formatExamSubjectsSummary(course.examSubjects, examSubjectsCatalog)}
                      {' '}
                      ({Array.isArray(course.examSubjects) && course.examSubjects.length ? course.examSubjects.length : 0} môn)
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>{course.totalSessions} buổi</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[12px]">Tên khóa học</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 text-[12px]">Giá gốc</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-500 text-[12px]">Giảm giá</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 text-[12px]">Giá áp dụng</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-500 text-[12px]">Môn thi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-500 text-[12px]">Buổi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-500 text-[12px]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, idx) => {
                  const ep = calcEffective(course.price, course.discountPercent);
                  const hasDiscount = course.discountPercent > 0;
                  return (
                    <tr key={course._id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 text-sm leading-snug">{course.name}</p>
                        {course.description && (
                          <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-1">{course.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-mono text-sm tabular-nums ${hasDiscount ? 'line-through text-slate-400' : 'font-semibold text-slate-800'}`}>
                          {fmt(course.price)}đ
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {hasDiscount ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 font-semibold text-[12px] px-2.5 py-1 rounded-full">
                            -{course.discountPercent}%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-mono font-semibold text-sm tabular-nums ${hasDiscount ? 'text-red-600' : 'text-blue-700'}`}>
                          {fmt(ep)}đ
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-[12px] font-medium text-slate-600 leading-snug block max-w-[140px] mx-auto">
                          {formatExamSubjectsSummary(course.examSubjects, examSubjectsCatalog)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({Array.isArray(course.examSubjects) && course.examSubjects.length ? course.examSubjects.length : 0} môn)
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-[13px] font-medium text-slate-600">{course.totalSessions}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setModalCourse(course)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                            title="Sửa"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(course)}
                            disabled={deleting === course._id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                            title="Xóa"
                          >
                            {deleting === course._id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
