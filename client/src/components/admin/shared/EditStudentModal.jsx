import React, { useState, useEffect } from 'react';
import { X, Save, KeyRound, MapPin, CheckCircle2, Edit3, Loader2 } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';

export default function EditStudentModal({ student, onSave, onClose, teachers, onResetPassword }) {
  const toast    = useToast();
  const API      = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");
  const { isSuperAdmin, branches } = useBranch();

  const [dbCourses, setDbCourses] = useState([]);
  const [form, setForm] = useState({
    name: student.name || '',
    age: student.age || '',
    phone: student.phone || '',
    zalo: student.zalo || '',
    courseId: student.courseId || '',
    course: student.course || '',
    price: student.price || 0,
    totalSessions: student.totalSessions || 12,
    paid: !!student.paid,
    teacherId: student.teacherId || '',
    learningMode: student.learningMode || 'OFFLINE',
    branchId: student.branchId || '',
    branchCode: student.branchCode || ''
  });
  const [studentExamUnlocked, setStudentExamUnlocked] = useState(!!student.studentExamUnlocked);

  // Fetch courses from DB
  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data.length) {
          setDbCourses(res.data);
          // Only auto-set if course is completely empty, otherwise keep user's original course
          if (!form.courseId && !form.course) {
             const first = res.data[0];
             const ep = Math.round(first.price * (1 - (first.discountPercent || 0) / 100));
             setForm(f => ({ ...f, courseId: first._id, course: first.name, price: ep }));
          }
        }
      })
      .catch(() => {});
  }, [API, form.courseId, form.course]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'name') { setForm(f => ({ ...f, name: value.toUpperCase() })); return; }
    
    if (name === 'branchId') {
      const selectedB = branches.find(b => String(b._id) === String(value));
      let mode = form.learningMode;
      if (selectedB && selectedB.name.toLowerCase().includes('online')) {
        mode = 'ONLINE';
      }
      setForm(f => ({ ...f, branchId: value, branchCode: selectedB?.code || '', learningMode: mode }));
      return;
    }

    if (name === 'courseId') {
      // Find course by ID or name
      const c = dbCourses.find(x => String(x._id) === String(value) || x.name === value);
      if (c) {
        // Only update price if it's changing the course
        const ep = Math.round(c.price * (1 - (c.discountPercent || 0) / 100));
        setForm(f => ({ ...f, courseId: c._id, course: c.name, price: ep }));
      }
      return;
    }
    
    if (name === 'studentExamUnlocked') {
      setStudentExamUnlocked(checked);
      return;
    }

    if (type === 'checkbox') { setForm(f => ({ ...f, [name]: checked })); return; }
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmitForm = () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại!'); return; }
    onSave({
      ...student,
      ...form,
      studentExamUnlocked
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-5 flex items-center justify-between">
          <h3 className="text-white font-bold text-xl flex items-center gap-3"><Edit3 size={24} /> Chỉnh sửa Học Viên</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition cursor-pointer">
            <X size={24} />
          </button>
        </div>

        {/* Body Lưới 2 cột */}
        <div className="p-8 max-h-[75vh] overflow-y-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cột Trái: Thông tin Cá nhân */}
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
                  <input name="age" type="number" value={form.age} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition" placeholder="VD: 20" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Số điện thoại / Zalo <span className="text-red-500">*</span></label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition font-mono" placeholder="0911222333" />
                </div>
              </div>
            </div>

            {/* Cột Phải: Thông tin Khóa học */}
            <div className="space-y-6 md:pl-2">
              <h4 className="font-black text-gray-800 text-sm mb-4 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
                Thông tin Khóa học
              </h4>

              {/* Dropdown Chi nhánh */}
              {isSuperAdmin && (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Cơ sở đăng ký</label>
                <select name="branchId" value={form.branchId || ''} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition text-sm font-bold text-gray-800 bg-gray-50 cursor-pointer">
                  <option value="">-- Chọn cơ sở --</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Hình thức học</label>
                <div className="flex gap-3">
                  <label className={`flex flex-col items-center justify-center gap-1 cursor-pointer border-2 p-3 rounded-xl transition flex-1 ${form.learningMode === 'OFFLINE' ? 'border-red-500 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input type="radio" name="learningMode" value="OFFLINE" checked={form.learningMode === 'OFFLINE'} onChange={handleChange} className="w-4 h-4 accent-red-600 cursor-pointer hidden" />
                    <span className={`font-black text-base ${form.learningMode === 'OFFLINE' ? 'text-red-700' : 'text-gray-400'}`}>🏢 Offline</span>
                    <span className={`text-xs font-semibold ${form.learningMode === 'OFFLINE' ? 'text-red-600/70' : 'text-gray-400'}`}>Tại cơ sở</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center gap-1 cursor-pointer border-2 p-3 rounded-xl transition flex-1 ${form.learningMode === 'ONLINE' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input type="radio" name="learningMode" value="ONLINE" checked={form.learningMode === 'ONLINE'} onChange={handleChange} className="w-4 h-4 accent-blue-600 cursor-pointer hidden" />
                    <span className={`font-black text-base ${form.learningMode === 'ONLINE' ? 'text-blue-700' : 'text-gray-400'}`}>🌐 Online</span>
                    <span className={`text-xs font-semibold ${form.learningMode === 'ONLINE' ? 'text-blue-600/70' : 'text-gray-400'}`}>Từ xa</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Khóa học đăng ký</label>
                {dbCourses.length > 0 ? (
                  <select name="courseId" value={form.courseId || form.course} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition font-bold text-blue-800 bg-gray-50 cursor-pointer text-sm">
                    {/* Preserve existing course if not found in dbCourses */}
                    {!dbCourses.some(c => String(c._id) === String(form.courseId) || c.name === form.course) && (form.courseId || form.course) && <option value={form.courseId || form.course}>{form.course}</option>}
                    {dbCourses.map(c => {
                      const ep = Math.round(c.price * (1 - (c.discountPercent || 0) / 100));
                      // We use c._id as value, but if old student has only course name, we might fallback
                      return <option key={c._id} value={c._id}>{c.name} — {ep.toLocaleString('vi-VN')}đ</option>;
                    })}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl p-3.5 text-gray-400 text-sm bg-gray-50">
                    <Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu...
                  </div>
                )}
                
                <div className="flex gap-4 mt-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Học phí (VNĐ)</label>
                    <input type="number" name="price" value={form.price} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:border-blue-500 outline-none bg-emerald-50 text-emerald-700 font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Tổng số buổi</label>
                    <input type="number" name="totalSessions" value={form.totalSessions} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:border-blue-500 outline-none bg-blue-50 text-blue-700 font-bold" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Giảng viên hướng dẫn <span className="text-gray-400 font-normal">(Tùy chọn)</span></label>
                <select name="teacherId" value={form.teacherId} onChange={handleChange} className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition text-sm bg-gray-50 cursor-pointer">
                  <option value="">-- Có thể chọn sau --</option>
                  {(teachers || []).filter(Boolean).filter(t => {
                    const s = (t.status || '').toLowerCase();
                    return s === 'active';
                  }).map(t => (
                    <option key={t.id || t._id} value={t.id || t._id}>{t.name}{t.phone ? ` — ${t.phone}` : ''}</option>
                  ))}
                </select>
                {(teachers || []).filter(Boolean).filter(t => { const s = (t.status || '').toLowerCase(); return s === 'active'; }).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Chưa có giảng viên chính thức (Active).</p>
                )}
              </div>
            </div>
          </div>

          {/* Full width row: checkboxes + buttons */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <label className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 bg-green-50 border-2 border-green-200 rounded-2xl transition hover:bg-green-100/70">
                  <input type="checkbox" name="paid" checked={form.paid} onChange={handleChange} className="w-5 h-5 accent-green-600 rounded cursor-pointer" />
                  <span className="text-sm font-black text-green-800">Đã đóng học phí</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-2xl transition hover:bg-blue-100/70">
                  <input type="checkbox" name="studentExamUnlocked" checked={studentExamUnlocked} onChange={handleChange} className="w-5 h-5 accent-blue-600 rounded cursor-pointer" />
                  <span className="text-sm font-black text-blue-800">[Mở khóa phòng thi đặc cách]</span>
                </label>
              </div>

              <div className="flex gap-3 w-full md:w-auto">
              <button 
                onClick={onClose} 
                className="flex-1 md:flex-none px-8 py-3.5 bg-white border-2 border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => onResetPassword && onResetPassword(student.id || student._id, student.name)}
                className="flex-1 md:flex-none px-4 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-100 transition-all whitespace-nowrap"
              >
                <KeyRound size={15} /> Cấp lại MK
              </button>
              <button 
                onClick={handleSubmitForm} 
                className="flex-[2] md:flex-none px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl font-black hover:from-red-700 hover:to-red-600 shadow-[0_8px_16px_rgba(220,38,38,0.2)] hover:shadow-[0_8px_20px_rgba(220,38,38,0.3)] transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                <Save size={20} className="drop-shadow-sm" /> Lưu Thay Đổi
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
