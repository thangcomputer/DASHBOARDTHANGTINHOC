import React, { useState, useEffect, useCallback } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { X, Save, KeyRound, Edit3, Loader2 } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';

function courseEffectivePrice(c) {
  return Math.round(Number(c?.price || 0) * (1 - (Number(c?.discountPercent) || 0) / 100));
}

function courseDefaultSessions(c) {
  const n = Number(c?.totalSessions);
  return n > 0 ? n : 12;
}

function findCourse(dbCourses, idOrName) {
  if (!idOrName) return null;
  const key = String(idOrName).trim().toLowerCase();
  return dbCourses.find(
    (x) => String(x._id) === String(idOrName) || String(x.name || '').trim().toLowerCase() === key
  ) || null;
}

function normalizeTeacherId(teacherId) {
  if (!teacherId) return '';
  if (typeof teacherId === 'object') return String(teacherId._id || teacherId.id || '');
  return String(teacherId);
}

const blockWheelOnNumber = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

export default function EditStudentModal({ student, onSave, onClose, teachers, onResetPassword }) {
  const toast = useToast();
  const API = import.meta.env.VITE_API_URL || '';
  const { isSuperAdmin, branches } = useBranch();

  const [dbCourses, setDbCourses] = useState([]);
  const [form, setForm] = useState(() => ({
    name: student.name || '',
    age: student.age || '',
    phone: student.phone || '',
    zalo: student.zalo || '',
    courseId: student.courseId ? String(student.courseId._id || student.courseId) : '',
    course: student.course || '',
    price: student.price || 0,
    totalSessions: student.totalSessions || 12,
    paid: !!student.paid,
    teacherId: normalizeTeacherId(student.teacherId),
    learningMode: student.learningMode || 'OFFLINE',
    branchId: student.branchId ? String(student.branchId._id || student.branchId) : '',
    branchCode: student.branchCode || '',
  }));
  const [studentExamUnlocked, setStudentExamUnlocked] = useState(!!student.studentExamUnlocked);

  const applyCourse = useCallback((c, syncSessions = true) => {
    if (!c) return;
    setForm((f) => ({
      ...f,
      courseId: String(c._id),
      course: c.name,
      price: courseEffectivePrice(c),
      ...(syncSessions ? { totalSessions: courseDefaultSessions(c) } : {}),
    }));
  }, []);

  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success || !res.data?.length) return;
        setDbCourses(res.data);
        setForm((f) => {
          const matched = findCourse(res.data, f.courseId || f.course);
          if (!matched) return f;
          // Đồng bộ học phí + số buổi theo catalog khi mở form (tránh giữ 12 buổi cũ)
          return {
            ...f,
            courseId: String(matched._id),
            course: matched.name,
            price: courseEffectivePrice(matched),
            totalSessions: courseDefaultSessions(matched),
          };
        });
      })
      .catch(() => {});
  }, [API]);

  const handleCourseSelect = (e) => {
    const c = findCourse(dbCourses, e.target.value);
    if (c) applyCourse(c, true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'name') { setForm((f) => ({ ...f, name: value.toUpperCase() })); return; }

    if (name === 'branchId') {
      const selectedB = branches.find((b) => String(b._id) === String(value));
      let mode = form.learningMode;
      if (selectedB && selectedB.name.toLowerCase().includes('online')) mode = 'ONLINE';
      setForm((f) => ({ ...f, branchId: value, branchCode: selectedB?.code || '', learningMode: mode }));
      return;
    }

    if (name === 'studentExamUnlocked') {
      setStudentExamUnlocked(checked);
      return;
    }

    if (name === 'age' || name === 'price' || name === 'totalSessions') {
      const digits = value.replace(/\D/g, '');
      setForm((f) => ({ ...f, [name]: digits === '' ? '' : Number(digits) }));
      return;
    }

    if (type === 'checkbox') { setForm((f) => ({ ...f, [name]: checked })); return; }
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmitForm = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Vui lòng nhập họ tên và số điện thoại!');
      return;
    }
    onSave({
      ...student,
      ...form,
      totalSessions: Number(form.totalSessions) || 12,
      remainingSessions: Math.max(
        0,
        (Number(form.totalSessions) || 12) - (Number(student.completedSessions) || 0)
      ),
      price: Number(form.price) || 0,
      studentExamUnlocked,
    });
  };

  const selectCourseId = form.courseId || findCourse(dbCourses, form.course)?._id || '';

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chỉnh sửa học viên"
        className="cms-sheet cms-sheet--wide w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-red-50 text-red-600" aria-hidden="true">
            <Edit3 size={18} />
          </span>
          <h3 className="cms-sheet-header__title">Chỉnh sửa học viên</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-body space-y-6">
          <section className="cms-form">
            <div className="cms-step">
              <span className="cms-step__num">1</span>
              <span className="cms-step__label">Thông tin cá nhân</span>
            </div>

            <div>
              <label className="cms-label">Họ tên học viên <span className="text-red-500">*</span></label>
              <input name="name" value={form.name} onChange={handleChange} className="cms-input uppercase" placeholder="VD: Nguyễn Văn A" />
            </div>

            <div className="cms-form-row">
              <div>
                <label className="cms-label">Tuổi</label>
                <input
                  name="age"
                  type="text"
                  inputMode="numeric"
                  value={form.age}
                  onChange={handleChange}
                  onWheel={blockWheelOnNumber}
                  className="cms-input text-center"
                  placeholder="VD: 20"
                />
              </div>
              <div>
                <label className="cms-label">Số điện thoại / Zalo <span className="text-red-500">*</span></label>
                <input name="phone" value={form.phone} onChange={handleChange} className="cms-input font-mono" placeholder="0911222333" />
              </div>
            </div>
          </section>

          <section className="cms-form">
            <div className="cms-step">
              <span className="cms-step__num cms-step__num--muted">2</span>
              <span className="cms-step__label">Thông tin khóa học</span>
            </div>

            {isSuperAdmin && (
              <div>
                <label className="cms-label">Cơ sở đăng ký</label>
                <CmsSelect name="branchId" value={form.branchId || ''} onChange={handleChange} className="cms-input">
                  <option value="">-- Chọn cơ sở --</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </CmsSelect>
              </div>
            )}

            <div>
              <label className="cms-label">Hình thức học</label>
              <div className="cms-chip-grid">
                <label className={`cms-chip-option ${form.learningMode === 'OFFLINE' ? 'is-on' : ''}`}>
                  <input type="radio" name="learningMode" value="OFFLINE" checked={form.learningMode === 'OFFLINE'} onChange={handleChange} className="sr-only" />
                  🏢 Trực tiếp
                </label>
                <label className={`cms-chip-option ${form.learningMode === 'ONLINE' ? 'is-on' : ''}`}>
                  <input type="radio" name="learningMode" value="ONLINE" checked={form.learningMode === 'ONLINE'} onChange={handleChange} className="sr-only" />
                  🌐 Online
                </label>
              </div>
            </div>

            <div>
              <label className="cms-label">Khóa học đăng ký</label>
              {dbCourses.length > 0 ? (
                <CmsSelect
                  name="courseId"
                  value={selectCourseId}
                  onChange={handleCourseSelect}
                  className="cms-input"
                >
                  {dbCourses.map((c) => {
                    const ep = courseEffectivePrice(c);
                    const sessions = courseDefaultSessions(c);
                    return (
                      <option key={c._id} value={c._id}>
                        {c.name} — {ep.toLocaleString('vi-VN')}đ ({sessions} buổi)
                      </option>
                    );
                  })}
                </CmsSelect>
              ) : (
                <div className="cms-input flex items-center gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu...
                </div>
              )}

              <div className="cms-form-row mt-4">
                <div>
                  <label className="cms-label">Học phí (VNĐ)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    onWheel={blockWheelOnNumber}
                    className="cms-input font-mono text-emerald-700"
                  />
                </div>
                <div>
                  <label className="cms-label">Tổng số buổi</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="totalSessions"
                    value={form.totalSessions}
                    onChange={handleChange}
                    onWheel={blockWheelOnNumber}
                    className="cms-input font-mono text-sky-700"
                  />
                  {!!selectCourseId && (
                    <button
                      type="button"
                      className="mt-1.5 text-[11px] font-semibold text-sky-600 hover:underline text-left"
                      onClick={() => {
                        const c = findCourse(dbCourses, selectCourseId);
                        if (c) applyCourse(c, true);
                      }}
                    >
                      Đồng bộ từ khóa học ({courseDefaultSessions(findCourse(dbCourses, selectCourseId) || {})} buổi)
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="cms-label">Giảng viên hướng dẫn <span className="font-normal text-slate-400">(Tùy chọn)</span></label>
              <CmsSelect name="teacherId" value={form.teacherId} onChange={handleChange} className="cms-input">
                <option value="">-- Có thể chọn sau --</option>
                {(teachers || []).filter(Boolean).filter((t) => {
                  const s = (t.status || '').toLowerCase();
                  return s === 'active';
                }).map((t) => (
                  <option key={t.id || t._id} value={t.id || t._id}>{t.name}{t.phone ? ` — ${t.phone}` : ''}</option>
                ))}
              </CmsSelect>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                <input type="checkbox" name="paid" checked={form.paid} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-[13px] font-semibold text-emerald-800">Đã đóng học phí</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-sky-200 bg-sky-50 p-3.5">
                <input type="checkbox" name="studentExamUnlocked" checked={studentExamUnlocked} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                <span className="text-[13px] font-semibold text-sky-800">Mở khóa phòng thi đặc cách</span>
              </label>
            </div>
          </section>
        </div>

        <div className="cms-sheet-footer cms-sheet-footer--triple">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy bỏ</button>
          <button
            type="button"
            onClick={() => onResetPassword && onResetPassword(student.id || student._id, student.name)}
            className="cms-btn cms-btn-secondary"
          >
            <KeyRound size={15} /> Cấp MK
          </button>
          <button type="button" onClick={handleSubmitForm} className="cms-btn cms-btn-primary">
            <Save size={16} /> Lưu thay đổi
          </button>
        </div>
      </div>
    </>
  );
}
