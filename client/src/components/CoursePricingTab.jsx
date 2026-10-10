/**
 * CoursePricingTab.jsx
 * Quản lý Đơn giá Khóa học — CRUD Table + Modal
 * Tích hợp trong SystemSettingsTab
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import CmsSelect from './ui/CmsSelect';
import {
  Plus, Edit2, Trash2, Save, X, Loader2, AlertCircle,
  DollarSign, Percent, Tag, BookOpen, CheckCircle2, Clapperboard, GraduationCap,
  Download, Upload, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import { useData } from '../context/DataContext';
import { apiFetch, resolveMediaUrl } from '../services/api';
import lessonPracticeApi from '../services/lessonPracticeApi';
import { calculateDiscountPrice, isCourseDiscountActive } from '../utils/coursePricing';
import {
  getExamSubjectOptions,
  formatExamSubjectsSummary,
  mapCourseToExamSubjectIds,
  slugifyExamSubjectId,
  getExamSubjectGroupLabel,
} from '../utils/examSubjects';

const API = import.meta.env.VITE_API_URL || '';
const COURSE_IMPORT_COLUMNS = [
  { header: 'Tên khóa học', key: 'name' },
  { header: 'Giá gốc', key: 'price' },
  { header: 'Giảm giá (%)', key: 'discountPercent' },
  { header: 'Bắt đầu giảm giá (ISO)', key: 'discountStartsAt' },
  { header: 'Kết thúc giảm giá (ISO)', key: 'discountEndsAt' },
  { header: 'Số buổi', key: 'totalSessions' },
  { header: 'Hình thức (instructor/video)', key: 'deliveryMode' },
  { header: 'Danh mục', key: 'category' },
  { header: 'Mã môn (phân cách bằng ;)', key: 'examSubjects' },
  { header: 'Mô tả', key: 'description' },
  { header: 'Ảnh bìa (URL)', key: 'thumbnail' },
  { header: 'Màu banner đầu', key: 'bannerColorStart' },
  { header: 'Màu banner cuối', key: 'bannerColorEnd' },
  { header: 'Trạng thái (draft/published/archived)', key: 'status' },
];

const normalizeSpreadsheetHeader = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const normalizeCourseName = (value) => normalizeSpreadsheetHeader(value);

function downloadCourseWorkbook(rows, filename) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    COURSE_IMPORT_COLUMNS.map(({ header }) => header),
    ...rows.map((row) => COURSE_IMPORT_COLUMNS.map(({ key }) => row[key] ?? '')),
  ]);
  worksheet['!cols'] = COURSE_IMPORT_COLUMNS.map(({ header }) => ({ wch: Math.max(18, header.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'KhoaHoc');
  XLSX.writeFile(workbook, filename);
}

function parseCourseImportRow(row, rowNumber) {
  const valuesByHeader = new Map(Object.entries(row).map(([header, value]) => [
    normalizeSpreadsheetHeader(header),
    value,
  ]));
  const get = (key) => {
    const column = COURSE_IMPORT_COLUMNS.find((item) => item.key === key);
    return valuesByHeader.get(normalizeSpreadsheetHeader(column?.header))
      ?? valuesByHeader.get(normalizeSpreadsheetHeader(key))
      ?? '';
  };
  const name = String(get('name') || '').trim();
  const price = Number(get('price'));
  const discountPercent = Number(get('discountPercent') || 0);
  const totalSessions = Number(get('totalSessions') || 12);
  const rawExamSubjects = String(get('examSubjects') || '')
    .split(/[;,|]/)
    .map((id) => id.trim())
    .filter(Boolean);
  const examSubjects = rawExamSubjects.map((id) => slugifyExamSubjectId(id));
  const deliveryInput = normalizeSpreadsheetHeader(get('deliveryMode'));
  const deliveryMode = ['video', 'tuhocquavideo'].includes(deliveryInput)
    ? 'video'
    : ['instructor', 'hoccunggiangvien'].includes(deliveryInput)
      ? 'instructor'
      : '';
  const category = String(get('category') || 'van-phong').trim().toLowerCase();
  const allowedCategories = new Set(['van-phong', 'do-hoa', 'lap-trinh', 'ai', 'chung-chi', 'khac']);
  const status = String(get('status') || 'published').trim().toLowerCase();
  const allowedStatuses = new Set(['draft', 'published', 'archived']);
  const discountStartsAt = String(get('discountStartsAt') || '').trim();
  const discountEndsAt = String(get('discountEndsAt') || '').trim();

  const errors = [];
  if (!name) errors.push('thiếu tên khóa học');
  if (!Number.isFinite(price) || price <= 0) errors.push('giá gốc phải lớn hơn 0');
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) errors.push('giảm giá phải từ 0 đến 100');
  if (!Number.isInteger(totalSessions) || totalSessions < 1) errors.push('số buổi phải là số nguyên dương');
  if (!examSubjects.length) errors.push('thiếu mã môn');
  if (examSubjects.some((id) => !id || id.length < 2)) errors.push('có mã môn không hợp lệ');
  if (!deliveryMode) errors.push('hình thức học phải là instructor hoặc video');
  if (!allowedCategories.has(category)) errors.push(`danh mục "${category}" không hợp lệ`);
  if (!allowedStatuses.has(status)) errors.push(`trạng thái "${status}" không hợp lệ`);
  if (Boolean(discountStartsAt) !== Boolean(discountEndsAt)) errors.push('cần nhập đủ thời gian bắt đầu và kết thúc giảm giá');
  if (
    discountStartsAt
    && discountEndsAt
    && (
      Number.isNaN(new Date(discountStartsAt).getTime())
      || Number.isNaN(new Date(discountEndsAt).getTime())
      || new Date(discountEndsAt) <= new Date(discountStartsAt)
    )
  ) errors.push('thời gian giảm giá không hợp lệ');

  if (errors.length) throw new Error(`Dòng ${rowNumber}: ${errors.join(', ')}`);
  return {
    name,
    price,
    discountPercent,
    discountStartsAt: discountStartsAt || null,
    discountEndsAt: discountEndsAt || null,
    totalSessions,
    deliveryMode,
    category,
    examSubjects,
    description: String(get('description') || '').trim(),
    thumbnail: String(get('thumbnail') || '').trim(),
    bannerColorStart: String(get('bannerColorStart') || '').trim(),
    bannerColorEnd: String(get('bannerColorEnd') || '').trim(),
    status,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const calcEffective = calculateDiscountPrice;
const toLocalDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalDateTimeInput = (value) => value ? new Date(value).toISOString() : null;

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
  examAdminGroupLabel = 'Admin tạo',
  addCustomExamSubject,
  updateCustomExamSubject,
  removeCustomExamSubject,
  updateExamAdminGroupLabel,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const isEdit = !!course?._id;

  const [form, setForm] = useState({
    name:            course?.name || '',
    price:           course?.price || '',
    discountPercent: course?.discountPercent || 0,
    discountStartsAt: toLocalDateTimeInput(course?.discountStartsAt),
    discountEndsAt:   toLocalDateTimeInput(course?.discountEndsAt),
    totalSessions:   course?.totalSessions || 12,
    deliveryMode:    course?.deliveryMode || 'instructor',
    category:        course?.category || 'van-phong',
    examSubjects:    Array.isArray(course?.examSubjects) && course.examSubjects.length
      ? [...course.examSubjects]
      : [],
    description:     course?.description || '',
    thumbnail:       course?.thumbnail || '',
    bannerColorStart: course?.bannerColorStart || '',
    bannerColorEnd:   course?.bannerColorEnd || '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importCourseId, setImportCourseId] = useState('');
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectLabel, setNewSubjectLabel] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState(null);
  const [subjectDialog, setSubjectDialog] = useState(null); // { mode: 'delete'|'edit', id, label }
  const [editLabel, setEditLabel] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);
  const [editingGroupLabel, setEditingGroupLabel] = useState(false);
  const [groupLabelDraft, setGroupLabelDraft] = useState(examAdminGroupLabel);
  const [savingGroupLabel, setSavingGroupLabel] = useState(false);

  const groupLabelOverrides = { admin: examAdminGroupLabel };
  const examOptions = getExamSubjectOptions(examSubjectsCatalog).filter((item) => !!examSubjectsCatalog?.[item.id]?.custom || (Array.isArray(form.examSubjects) && form.examSubjects.includes(item.id)));
  const groupedExamOptions = examOptions.reduce((acc, item) => {
    const key = item.group || 'admin';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const scheduleConfigured = Boolean(form.discountStartsAt || form.discountEndsAt);
  const discountStartsAt = form.discountStartsAt ? new Date(form.discountStartsAt).getTime() : null;
  const discountEndsAt = form.discountEndsAt ? new Date(form.discountEndsAt).getTime() : null;
  const scheduledDiscountActive = !scheduleConfigured
    || (
      Number.isFinite(discountStartsAt)
      && Number.isFinite(discountEndsAt)
      && Date.now() >= discountStartsAt
      && Date.now() < discountEndsAt
    );
  const hasDiscount = Number(form.discountPercent) > 0
    && Number(form.price) > 0
    && scheduledDiscountActive;
  const effective = hasDiscount ? calcEffective(form.price, form.discountPercent) : Number(form.price) || 0;
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

  const openDeleteSubject = (id, label) => {
    if (typeof removeCustomExamSubject !== 'function') {
      toast.error('Chưa kết nối API xóa môn thi');
      return;
    }
    setSubjectDialog({ mode: 'delete', id, label });
  };

  const openEditSubject = (id, label) => {
    if (typeof updateCustomExamSubject !== 'function') {
      toast.error('Chưa kết nối API sửa môn thi');
      return;
    }
    setEditLabel(label);
    setSubjectDialog({ mode: 'edit', id, label });
  };

  const openEditAdminGroupLabel = () => {
    if (typeof updateExamAdminGroupLabel !== 'function') {
      toast.error('Chưa kết nối API sửa tên nhóm');
      return;
    }
    setGroupLabelDraft(examAdminGroupLabel || 'Admin tạo');
    setEditingGroupLabel(true);
  };

  const saveAdminGroupLabel = async () => {
    const next = String(groupLabelDraft || '').trim();
    if (next.length < 2) {
      toast.error('Tên nhóm phải từ 2 ký tự');
      return;
    }
    setSavingGroupLabel(true);
    try {
      await updateExamAdminGroupLabel(next);
      setEditingGroupLabel(false);
      toast.success('Đã cập nhật tên nhóm');
    } catch (err) {
      toast.error(err?.message || 'Không đổi được tên nhóm');
    } finally {
      setSavingGroupLabel(false);
    }
  };

  const confirmDeleteSubject = async () => {
    if (!subjectDialog || subjectDialog.mode !== 'delete') return;
    const { id, label } = subjectDialog;
    setDeletingSubjectId(id);
    setSavingSubject(true);
    try {
      await removeCustomExamSubject(id);
      setForm((f) => {
        const current = Array.isArray(f.examSubjects) ? f.examSubjects : [];
        return { ...f, examSubjects: current.filter((x) => x !== id) };
      });
      setSubjectDialog(null);
      toast.success(`Đã xóa môn "${label}"`);
    } catch (err) {
      toast.error(err?.message || 'Không xóa được môn thi');
    } finally {
      setDeletingSubjectId(null);
      setSavingSubject(false);
    }
  };

  const confirmEditSubject = async () => {
    if (!subjectDialog || subjectDialog.mode !== 'edit') return;
    const label = editLabel.trim();
    if (label.length < 2) {
      toast.error('Tên môn thi quá ngắn');
      return;
    }
    setSavingSubject(true);
    try {
      const subject = await updateCustomExamSubject(subjectDialog.id, { label });
      setSubjectDialog(null);
      toast.success(`Đã đổi tên thành "${subject?.label || label}"`);
    } catch (err) {
      toast.error(err?.message || 'Không sửa được môn thi');
    } finally {
      setSavingSubject(false);
    }
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
    if (Boolean(form.discountStartsAt) !== Boolean(form.discountEndsAt)) {
      toast.error('Cần nhập đủ thời gian bắt đầu và kết thúc khuyến mãi');
      return;
    }
    if (form.discountStartsAt && new Date(form.discountEndsAt) <= new Date(form.discountStartsAt)) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }

    setSaving(true);
    try {
      const endpoint = isEdit ? `/courses/${course._id}` : '/courses';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = {
        name:            form.name.trim(),
        price:           Number(form.price),
        discountPercent: Number(form.discountPercent),
        discountPrice:   effective,
        discountStartsAt: fromLocalDateTimeInput(form.discountStartsAt),
        discountEndsAt:   fromLocalDateTimeInput(form.discountEndsAt),
        totalSessions:   Number(form.totalSessions),
        deliveryMode:    form.deliveryMode,
        category:        form.category,
        examSubjects:    form.examSubjects,
        description:     form.description,
        thumbnail:       form.thumbnail || '',
        bannerColorStart: form.bannerColorStart,
        bannerColorEnd:   form.bannerColorEnd,
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
      className="fixed inset-0 z-[9980] flex items-center justify-center p-4"
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

              <fieldset>
                <legend className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">
                  Hình thức học
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { id: 'instructor', label: 'Học cùng giảng viên', description: 'Học theo lịch với giảng viên', Icon: GraduationCap },
                    { id: 'video', label: 'Tự học qua video', description: 'Chủ động học theo lộ trình video', Icon: Clapperboard },
                  ].map((option) => {
                    const selected = form.deliveryMode === option.id;
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition focus-within:ring-2 focus-within:ring-blue-300 ${
                          selected
                            ? 'border-red-500 bg-red-50 text-red-800'
                            : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="course-delivery-mode"
                          value={option.id}
                          checked={selected}
                          onChange={() => setForm((current) => ({ ...current, deliveryMode: option.id }))}
                          className="sr-only"
                        />
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          selected ? 'bg-red-100 text-red-700' : 'bg-white text-gray-500'
                        }`}>
                          <option.Icon size={20} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-extrabold">{option.label}</span>
                          <span className="mt-0.5 block text-[11px] text-gray-500">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

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

              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-amber-800">
                  Thời gian khuyến mãi
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-gray-600">
                    Bắt đầu
                    <input
                      type="datetime-local"
                      value={form.discountStartsAt}
                      onChange={(event) => setForm((current) => ({ ...current, discountStartsAt: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-amber-400"
                    />
                  </label>
                  <label className="block text-xs font-bold text-gray-600">
                    Kết thúc
                    <input
                      type="datetime-local"
                      value={form.discountEndsAt}
                      min={form.discountStartsAt || undefined}
                      onChange={(event) => setForm((current) => ({ ...current, discountEndsAt: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-amber-400"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  Để trống cả hai nếu muốn giữ mức giảm không thời hạn. Khi đặt lịch, giá giảm chỉ áp dụng trong khoảng thời gian này.
                </p>
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

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Ảnh banner khóa học (tùy chọn)</label>
                {form.thumbnail ? (
                  <div className="relative overflow-hidden rounded-[20px] border border-gray-100 shadow-sm">
                    <img src={resolveMediaUrl(form.thumbnail)} alt="" className="h-36 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, thumbnail: '' }))}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      title="Xóa ảnh"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-dashed border-gray-200 bg-gray-50 text-xs font-bold text-gray-400 transition hover:border-blue-400 hover:text-blue-600">
                    {uploadingImage ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                    {uploadingImage ? 'Đang tải ảnh...' : 'Chọn ảnh banner (tối đa 5MB)'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setUploadingImage(true);
                        try {
                          const res = await lessonPracticeApi.upload(file);
                          const url = res?.data?.url;
                          if (!url) throw new Error('Không nhận được đường dẫn ảnh');
                          setForm((f) => ({ ...f, thumbnail: url }));
                        } catch (err) {
                          toast.error(err.message || 'Tải ảnh thất bại');
                        } finally {
                          setUploadingImage(false);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                      Tinh chỉnh màu banner khóa học
                    </label>
                    <p className="mt-1 text-xs text-gray-400">Để trống để dùng màu mặc định.</p>
                  </div>
                  {(form.bannerColorStart || form.bannerColorEnd) && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, bannerColorStart: '', bannerColorEnd: '' }))}
                      className="shrink-0 text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Mặc định
                    </button>
                  )}
                </div>
                <div
                  className="mb-3 h-12 rounded-xl border border-black/5 shadow-inner"
                  style={{
                    background: form.bannerColorStart || form.bannerColorEnd
                      ? `linear-gradient(135deg, ${form.bannerColorStart || '#be123c'}, ${form.bannerColorEnd || '#7f1d1d'})`
                      : 'linear-gradient(135deg, #be123c, #7f1d1d)',
                  }}
                  aria-label="Xem trước màu banner"
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
                    <input
                      type="color"
                      value={form.bannerColorStart || '#be123c'}
                      onChange={(e) => setForm((f) => ({ ...f, bannerColorStart: e.target.value }))}
                      className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Chọn màu đầu banner"
                    />
                    <span className="text-xs font-bold text-gray-600">Màu đầu</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
                    <input
                      type="color"
                      value={form.bannerColorEnd || '#7f1d1d'}
                      onChange={(e) => setForm((f) => ({ ...f, bannerColorEnd: e.target.value }))}
                      className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Chọn màu cuối banner"
                    />
                    <span className="text-xs font-bold text-gray-600">Màu cuối</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Cột phải: Môn thi */}
            <div className="space-y-5 md:pl-2">
              <h4 className="font-black text-gray-400 text-xs mb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs shadow-lg shadow-red-200">2</span>
                Môn thi trong Phòng Thi ({selectedCount})
              </h4>

              <div className="space-y-4">
                {Object.entries(groupedExamOptions).map(([groupKey, items]) => (
                  <div key={groupKey} className="space-y-2">
                    {groupKey === 'admin' && editingGroupLabel ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={groupLabelDraft}
                          onChange={(e) => setGroupLabelDraft(e.target.value)}
                          maxLength={60}
                          className="flex-1 min-w-0 bg-white border-2 border-purple-300 rounded-xl px-3 py-1.5 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:border-purple-500"
                          aria-label="Tên nhóm môn Admin tạo"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveAdminGroupLabel();
                            }
                            if (e.key === 'Escape') {
                              setEditingGroupLabel(false);
                              setGroupLabelDraft(examAdminGroupLabel || 'Admin tạo');
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={savingGroupLabel}
                          onClick={saveAdminGroupLabel}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                          title="Lưu tên nhóm"
                        >
                          {savingGroupLabel ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </button>
                        <button
                          type="button"
                          disabled={savingGroupLabel}
                          onClick={() => {
                            setEditingGroupLabel(false);
                            setGroupLabelDraft(examAdminGroupLabel || 'Admin tạo');
                          }}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                          title="Hủy"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
                          {getExamSubjectGroupLabel(groupKey, groupLabelOverrides)}
                        </p>
                        {groupKey === 'admin' && typeof updateExamAdminGroupLabel === 'function' ? (
                          <button
                            type="button"
                            title="Sửa tên nhóm"
                            onClick={openEditAdminGroupLabel}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition"
                          >
                            <Edit2 size={12} aria-hidden="true" />
                            <span className="sr-only">Sửa tên nhóm</span>
                          </button>
                        ) : null}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(({ id, label }) => {
                        const selected = Array.isArray(form.examSubjects) ? form.examSubjects : [];
                        const checked = selected.includes(id);
                        const isCustom = !!examSubjectsCatalog?.[id]?.custom;
                        return (
                          <label
                            key={id}
                            className={`group relative flex items-center gap-2 border-2 rounded-2xl px-3 py-2.5 cursor-pointer transition ${
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
                            <span className="text-sm font-semibold text-gray-700 min-w-0 flex-1 truncate">{label}</span>
                            {isCustom && (
                              <>
                                <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded group-hover:opacity-0 transition-opacity">Mới</span>
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    title={`Sửa tên "${label}"`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openEditSubject(id, label);
                                    }}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-xl text-slate-600 hover:bg-white hover:text-blue-600 transition"
                                  >
                                    <Edit2 size={14} aria-hidden="true" />
                                    <span className="sr-only">Sửa môn {label}</span>
                                  </button>
                                  <button
                                    type="button"
                                    title={`Xóa môn "${label}" khỏi hệ thống`}
                                    disabled={deletingSubjectId === id}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openDeleteSubject(id, label);
                                    }}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                                  >
                                    {deletingSubjectId === id
                                      ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                      : <Trash2 size={14} aria-hidden="true" />}
                                    <span className="sr-only">Xóa môn {label}</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
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

      {subjectDialog ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-dialog-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
          >
            <h4 id="subject-dialog-title" className="text-base font-black text-slate-900">
              {subjectDialog.mode === 'delete' ? 'Xóa môn thi?' : 'Sửa tên môn thi'}
            </h4>
            {subjectDialog.mode === 'delete' ? (
              <p className="text-sm text-slate-600">
                Xóa <strong>{subjectDialog.label}</strong> khỏi danh mục hệ thống? Các khóa đang gắn môn này sẽ cần chọn lại khi sửa.
              </p>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tên môn</span>
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full border-2 border-slate-100 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  placeholder="Tên môn thi"
                />
                <span className="text-[11px] text-slate-400">Mã môn giữ nguyên: <strong>{subjectDialog.id}</strong></span>
              </label>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={savingSubject}
                onClick={() => setSubjectDialog(null)}
                className="min-h-10 px-4 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                Hủy
              </button>
              {subjectDialog.mode === 'delete' ? (
                <button
                  type="button"
                  disabled={savingSubject}
                  onClick={confirmDeleteSubject}
                  className="min-h-10 px-4 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {savingSubject ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Xóa môn
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingSubject}
                  onClick={confirmEditSubject}
                  className="min-h-10 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {savingSubject ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu tên
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CoursePricingTab() {
  const toast = useToast();
  const { showModal } = useModal();
  const {
    examSubjectsCatalog,
    examAdminGroupLabel,
    addCustomExamSubject,
    updateCustomExamSubject,
    removeCustomExamSubject,
    updateExamAdminGroupLabel,
  } = useData();
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalCourse, setModalCourse] = useState(undefined); // undefined=closed, null=add, obj=edit
  const [deleting, setDeleting]     = useState(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/courses`)
      .then(async (response) => {
        const res = await response.json();
        if (!response.ok || !res.success) {
          throw new Error(res.message || 'Không tải được danh sách khóa học');
        }
        return res;
      })
      .then(res => {
        setCourses(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => toast.error(error.message || 'Không tải được danh sách khóa học'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const exportCourses = () => {
    const rows = courses.map((course) => ({
      name: course.name || '',
      price: Number(course.price) || 0,
      discountPercent: Number(course.discountPercent) || 0,
      discountStartsAt: course.discountStartsAt ? new Date(course.discountStartsAt).toISOString() : '',
      discountEndsAt: course.discountEndsAt ? new Date(course.discountEndsAt).toISOString() : '',
      totalSessions: Number(course.totalSessions) || 12,
      deliveryMode: course.deliveryMode || 'instructor',
      category: course.category || 'van-phong',
      examSubjects: Array.isArray(course.examSubjects) ? course.examSubjects.join(';') : '',
      description: course.description || '',
      thumbnail: course.thumbnail || '',
      bannerColorStart: course.bannerColorStart || '',
      bannerColorEnd: course.bannerColorEnd || '',
      status: course.status || 'published',
    }));
    downloadCourseWorkbook(rows, `danh-sach-khoa-hoc-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Đã xuất ${rows.length} khóa học`);
  };

  const downloadImportTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      COURSE_IMPORT_COLUMNS.map(({ header }) => header),
    ]);
    worksheet['!cols'] = COURSE_IMPORT_COLUMNS.map(({ header }) => ({ wch: Math.max(18, header.length + 2) }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['HƯỚNG DẪN NHẬP KHÓA HỌC'],
      ['Mỗi dòng trong sheet KhoaHoc là một khóa học mới. Tên trùng với khóa hiện có sẽ được bỏ qua, không ghi đè.'],
      ['Giá gốc: số tiền VND; Giảm giá: phần trăm từ 0 đến 100; Số buổi: số nguyên dương.'],
      ['Hình thức: instructor hoặc video. Danh mục: van-phong, do-hoa, lap-trinh, ai, chung-chi hoặc khac.'],
      ['Mã môn: nhập mã môn, nhiều môn phân cách bằng dấu chấm phẩy (;). Mã chưa có trong danh mục sẽ được thêm tự động từ file.'],
      ['Tên môn mới được tạo từ mã môn nếu danh mục chưa có mã đó (ví dụ: word-co-ban → Word Co Ban).'],
      ['Thời gian giảm giá: định dạng ISO, ví dụ 2026-10-10T09:00:00.000Z; để trống nếu không đặt lịch.'],
      ['Trạng thái: draft, published hoặc archived. Mặc định published nếu để trống.'],
      ['Có thể tải danh sách khóa học hiện tại để lấy file Excel mẫu đầy đủ dữ liệu.'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KhoaHoc');
    XLSX.utils.book_append_sheet(workbook, guide, 'HuongDan');
    XLSX.writeFile(workbook, 'mau-nhap-khoa-hoc.xlsx');
  };

  const importCourses = async (file) => {
    if (!file || importing) return;
    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('File Excel không có sheet dữ liệu');
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
      if (!rawRows.length) throw new Error('File chưa có dòng dữ liệu khóa học');

      const firstRowHeaders = new Set(Object.keys(rawRows[0]).map(normalizeSpreadsheetHeader));
      const hasNameColumn = firstRowHeaders.has(normalizeSpreadsheetHeader('Tên khóa học'))
        || firstRowHeaders.has('name');
      const hasPriceColumn = firstRowHeaders.has(normalizeSpreadsheetHeader('Giá gốc'))
        || firstRowHeaders.has('price');
      if (!hasNameColumn || !hasPriceColumn) {
        throw new Error('Không đúng mẫu Excel: cần có cột Tên khóa học và Giá gốc');
      }

      if (!window.confirm(`Sẽ thêm khóa mới từ file "${file.name}". Tên khóa trùng với khóa đang có sẽ được bỏ qua; dữ liệu hiện có không bị ghi đè. Tiếp tục?`)) {
        return;
      }

      const existingNames = new Set(courses.map((course) => normalizeCourseName(course.name)));
      const importedById = new Map();
      const restoredNames = [];
      const skipped = [];
      const failures = [];
      let deletedCoursesByName = null;
      const subjectCatalogResponse = await apiFetch('/settings/exam-subjects');
      const subjectCatalogResult = await subjectCatalogResponse.json();
      if (!subjectCatalogResponse.ok || !subjectCatalogResult.success) {
        throw new Error(subjectCatalogResult.message || 'Không tải được danh mục môn thi');
      }
      const importedSubjectCatalog = new Map(
        (Array.isArray(subjectCatalogResult.data?.merged) ? subjectCatalogResult.data.merged : [])
          .map((subject) => [String(subject.id || '').toLowerCase(), subject]),
      );
      Object.entries(examSubjectsCatalog || {}).forEach(([id, subject]) => {
        if (!importedSubjectCatalog.has(id.toLowerCase())) importedSubjectCatalog.set(id.toLowerCase(), subject);
      });

      const ensureImportedSubjects = async (subjectIds) => {
        for (const id of subjectIds) {
          if (importedSubjectCatalog.has(id)) continue;
          const label = id
            .split('-')
            .filter(Boolean)
            .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
            .join(' ');
          const subject = await addCustomExamSubject({ id, label });
          if (!subject?.id) {
            throw new Error(`Không tạo được môn "${label}" từ mã "${id}"`);
          }
          importedSubjectCatalog.set(id, subject);
        }
      };

      const findSoftDeletedCourse = async (nameKey) => {
        if (!deletedCoursesByName) {
          const response = await apiFetch('/courses?includeDeleted=true');
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không kiểm tra được các khóa học đã xóa mềm');
          }
          deletedCoursesByName = new Map(
            (Array.isArray(result.data) ? result.data : [])
              .filter((course) => course.deletedAt)
              .map((course) => [normalizeCourseName(course.name), course]),
          );
        }
        return deletedCoursesByName.get(nameKey) || null;
      };

      const readSuccessfulResponse = async (response, fallbackMessage) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || fallbackMessage);
        }
        return result.data;
      };

      for (const [index, row] of rawRows.entries()) {
        const rowNumber = index + 2;
        try {
          const payload = parseCourseImportRow(row, rowNumber);
          const nameKey = normalizeCourseName(payload.name);
          if (existingNames.has(nameKey)) {
            skipped.push(payload.name);
            continue;
          }
          await ensureImportedSubjects(payload.examSubjects);
          const response = await apiFetch('/courses', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            if (response.status === 409) {
              const deletedCourse = await findSoftDeletedCourse(nameKey);
              if (deletedCourse) {
                const restoredCourse = await readSuccessfulResponse(
                  await apiFetch(`/courses/${deletedCourse._id}/restore`, {
                    method: 'POST',
                    body: '{}',
                  }),
                  `Không khôi phục được khóa "${payload.name}"`,
                );
                importedById.set(String(restoredCourse._id), restoredCourse);
                restoredNames.push(payload.name);

                const updatedCourse = await readSuccessfulResponse(
                  await apiFetch(`/courses/${deletedCourse._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                  }),
                  `Đã khôi phục nhưng không cập nhật được khóa "${payload.name}"`,
                );
                importedById.set(String(updatedCourse._id), updatedCourse);
                existingNames.add(nameKey);
                deletedCoursesByName.delete(nameKey);
                continue;
              }
              skipped.push(payload.name);
              existingNames.add(nameKey);
              continue;
            }
            throw new Error(result.message || `Không tạo được khóa "${payload.name}"`);
          }
          importedById.set(String(result.data._id), result.data);
          existingNames.add(nameKey);
        } catch (err) {
          failures.push(err.message || `Dòng ${rowNumber}: không nhập được khóa học`);
        }
      }

      if (importedById.size) {
        setCourses((current) => [
          ...importedById.values(),
          ...current.filter((course) => !importedById.has(String(course._id))),
        ]);
      }
      if (failures.length) {
        const detail = failures.slice(0, 3).join('; ');
        toast.error(`Đã nhập ${importedById.size} khóa (khôi phục ${restoredNames.length}), bỏ qua ${skipped.length}, lỗi ${failures.length}. ${detail}`);
      } else {
        toast.success(`Đã nhập ${importedById.size} khóa (khôi phục ${restoredNames.length}); bỏ qua ${skipped.length} khóa đang hoạt động trùng tên`);
      }
    } catch (err) {
      toast.error(err.message || 'Không đọc được file Excel khóa học');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

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
          const response = await apiFetch(`/courses/${course._id}`, {
            method: 'DELETE',
          });
          const res = await response.json();
          if (res.success) {
            setCourses(prev => prev.filter(c => c._id !== course._id));
            toast.success(`🗑️ Đã xóa "${course.name}"`);
          } else if (response.status === 404) {
            setCourses(prev => prev.filter(c => c._id !== course._id));
            fetchCourses();
            toast.success(`"${course.name}" không còn trong dữ liệu; đã làm mới danh sách`);
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
          examAdminGroupLabel={examAdminGroupLabel}
          addCustomExamSubject={addCustomExamSubject}
          updateCustomExamSubject={updateCustomExamSubject}
          removeCustomExamSubject={removeCustomExamSubject}
          updateExamAdminGroupLabel={updateExamAdminGroupLabel}
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchCourses}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
          <button
            type="button"
            onClick={downloadImportTemplate}
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
          >
            <FileSpreadsheet size={15} /> Tải mẫu
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? 'Đang nhập...' : 'Nhập Excel'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => importCourses(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={exportCourses}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Download size={15} /> Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => setModalCourse(null)}
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition shadow-sm shrink-0 w-full sm:w-auto"
          >
            <Plus size={15} /> Thêm khóa học
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-[13px] text-amber-900 flex items-start gap-2.5 leading-relaxed">
        <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong className="font-semibold">Lưu ý giá cũ:</strong> Học viên đã đăng ký trước giữ nguyên giá cũ.
          Điều chỉnh từng học viên › Quản lý Học viên.
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
              const hasDiscount = isCourseDiscountActive(course);
              const ep = hasDiscount ? calcEffective(course.price, course.discountPercent) : Number(course.price) || 0;
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
                  const hasDiscount = isCourseDiscountActive(course);
                  const ep = hasDiscount ? calcEffective(course.price, course.discountPercent) : Number(course.price) || 0;
                  return (
                    <tr key={course._id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 text-sm leading-snug">
                          {course.name}
                          <span className={`ml-2 align-middle rounded-full px-2 py-0.5 text-[10px] font-bold ${Array.isArray(course.examSubjects) && course.examSubjects.length === 1 ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                            {Array.isArray(course.examSubjects) && course.examSubjects.length === 1 ? 'Khóa lẻ' : 'Trọn gói'}
                          </span>
                        </p>
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
