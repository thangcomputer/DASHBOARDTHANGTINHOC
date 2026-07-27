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
          return {
            ...f,
            courseId: String(matched._id),
            course: matched.name,
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
      price: Number(form.price) || 0,
      studentExamUnlocked,
    });
  };

  const selectCourseId = form.courseId || findCourse(dbCourses, form.course)?._id || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-white font-bold text-lg flex items-center gap-2"><Edit3 size={20} /> Chỉnh sửa Học Viên</h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 md:px-8 overflow-y-auto overscroll-contain flex-1 min-h-0 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-6 md:border-r border-gray-100 md:pr-8">
              <h4 className="font-black text-gray-800 text-sm mb-4 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">1</span>
                Thông tin Cá nhân
              </h4>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Họ tên học viên <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 uppercase font-semibold focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition" placeholder="VD: NGUYỄN VĂN A" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Tuổi</label>
                  <input
                    name="age"
                    type="text"
                    inputMode="numeric"
                    value={form.age}
                    onChange={handleChange}
                    onWheel={blockWheelOnNumber}
                    className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition"
                    placeholder="VD: 20"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Số điện thoại / Zalo <span className="text-red-500">*</span></label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition font-mono" placeholder="0911222333" />
                </div>
              </div>
            </div>

            <div className="space-y-6 md:pl-2">
              <h4 className="font-black text-gray-800 text-sm mb-4 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
                Thông tin Khóa học
              </h4>

              {isSuperAdmin && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Cơ sở đăng ký</label>
                  <CmsSelect name="branchId" value={form.branchId || ''} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition text-sm font-bold text-gray-800 bg-gray-50 cursor-pointer">
                    <option value="">-- Chọn cơ sở --</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </CmsSelect>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Hình thức học</label>
                <div className="flex gap-3">
                  <label className={`flex flex-col items-center justify-center gap-1 cursor-pointer border-2 p-3 rounded-xl transition flex-1 ${form.learningMode === 'OFFLINE' ? 'border-red-500 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input type="radio" name="learningMode" value="OFFLINE" checked={form.learningMode === 'OFFLINE'} onChange={handleChange} className="hidden" />
                    <span className={`font-black text-base ${form.learningMode === 'OFFLINE' ? 'text-red-700' : 'text-gray-400'}`}>🏢 Offline</span>
                    <span className={`text-xs font-semibold ${form.learningMode === 'OFFLINE' ? 'text-red-600/70' : 'text-gray-400'}`}>Tại cơ sở</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center gap-1 cursor-pointer border-2 p-3 rounded-xl transition flex-1 ${form.learningMode === 'ONLINE' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input type="radio" name="learningMode" value="ONLINE" checked={form.learningMode === 'ONLINE'} onChange={handleChange} className="hidden" />
                    <span className={`font-black text-base ${form.learningMode === 'ONLINE' ? 'text-blue-700' : 'text-gray-400'}`}>🌐 Online</span>
                    <span className={`text-xs font-semibold ${form.learningMode === 'ONLINE' ? 'text-blue-600/70' : 'text-gray-400'}`}>Từ xa</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Khóa học đăng ký</label>
                {dbCourses.length > 0 ? (
                  <CmsSelect
                    name="courseId"
                    value={selectCourseId}
                    onChange={handleCourseSelect}
                    className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition font-bold text-blue-800 bg-gray-50 cursor-pointer text-sm"
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
                  <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl p-3.5 text-gray-400 text-sm bg-gray-50">
                    <Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu...
                  </div>
                )}

                <div className="flex gap-4 mt-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Học phí (VNĐ)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="price"
                      value={form.price}
                      onChange={handleChange}
                      onWheel={blockWheelOnNumber}
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:border-blue-500 outline-none bg-emerald-50 text-emerald-700 font-bold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Tổng số buổi</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="totalSessions"
                      value={form.totalSessions}
                      onChange={handleChange}
                      onWheel={blockWheelOnNumber}
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:border-blue-500 outline-none bg-blue-50 text-blue-700 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Giảng viên hướng dẫn <span className="text-gray-400 font-normal">(Tùy chọn)</span></label>
                <CmsSelect name="teacherId" value={form.teacherId} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition text-sm bg-gray-50 cursor-pointer">
                  <option value="">-- Có thể chọn sau --</option>
                  {(teachers || []).filter(Boolean).filter((t) => {
                    const s = (t.status || '').toLowerCase();
                    return s === 'active';
                  }).map((t) => (
                    <option key={t.id || t._id} value={t.id || t._id}>{t.name}{t.phone ? ` — ${t.phone}` : ''}</option>
                  ))}
                </CmsSelect>
              </div>
            </div>
          </div>
        </div>

        {/* Footer cố định — không scroll theo nội dung */}
        <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-4 py-3 md:px-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 justify-between">
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-green-50 border border-green-200 rounded-xl transition hover:bg-green-100/70">
                <input type="checkbox" name="paid" checked={form.paid} onChange={handleChange} className="w-4 h-4 accent-green-600 rounded cursor-pointer" />
                <span className="text-xs font-bold text-green-800">Đã đóng học phí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl transition hover:bg-blue-100/70">
                <input type="checkbox" name="studentExamUnlocked" checked={studentExamUnlocked} onChange={handleChange} className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                <span className="text-xs font-bold text-blue-800">Mở khóa phòng thi đặc cách</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition">
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => onResetPassword && onResetPassword(student.id || student._id, student.name)}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all whitespace-nowrap"
              >
                <KeyRound size={13} /> Cấp lại MK
              </button>
              <button type="button" onClick={handleSubmitForm} className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl text-xs font-black hover:from-red-700 hover:to-red-600 shadow-sm transition-all flex items-center justify-center gap-1.5">
                <Save size={14} /> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
