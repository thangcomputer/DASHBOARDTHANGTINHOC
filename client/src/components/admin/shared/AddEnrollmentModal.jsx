import React, { useState, useEffect } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { X, BookOpen, Loader2, Plus } from 'lucide-react';
import { useToast } from '../../../utils/toast';
import { teacherMatchesCourse } from '../../../utils/examSubjects';

function courseEffectivePrice(c) {
  return Math.round(Number(c?.price || 0) * (1 - (Number(c?.discountPercent) || 0) / 100));
}

function courseDefaultSessions(c) {
  const n = Number(c?.totalSessions);
  return n > 0 ? n : 12;
}

function applyCourseToForm(c) {
  return {
    courseId: c._id,
    courseName: c.name,
    price: courseEffectivePrice(c),
    totalSessions: courseDefaultSessions(c),
  };
}

export default function AddEnrollmentModal({ student, teachers, onSubmit, onClose }) {
  const toast = useToast();
  const API = import.meta.env.VITE_API_URL || '';
  const [dbCourses, setDbCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    courseId: '',
    courseName: '',
    teacherId: '',
    price: 0,
    totalSessions: 12,
  });

  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.length) {
          setDbCourses(res.data);
          const first = res.data[0];
          setForm((f) => ({ ...f, ...applyCourseToForm(first) }));
        }
      })
      .catch(() => {});
  }, [API]);

  const handleCourseChange = (courseId) => {
    const c = dbCourses.find((x) => String(x._id) === String(courseId));
    if (!c) return;
    setForm((f) => ({ ...f, ...applyCourseToForm(c) }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const selected = dbCourses.find((c) => String(c._id) === String(form.courseId));
    const courseName = (selected?.name || form.courseName || '').trim();
    if (!courseName) {
      toast.error('Vui lòng chọn khóa học');
      return;
    }
    if (typeof onSubmit !== 'function') {
      toast.error('Lỗi hệ thống: chưa gắn hàm lưu');
      return;
    }
    setLoading(true);
    try {
      const ok = await onSubmit({
        courseId: form.courseId || selected?._id,
        courseName,
        teacherId: form.teacherId || undefined,
        price: Number(form.price) || 0,
        totalSessions: Number(form.totalSessions) || courseDefaultSessions(selected),
      });
      if (ok !== false) onClose();
    } catch {
      toast.error('Không thể thêm khóa học');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Thêm khóa học</h3>
              <p className="text-xs text-slate-500 font-semibold truncate max-w-[220px]">{student?.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Khóa học</label>
            <CmsSelect
              value={form.courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
              required
            >
              {dbCourses.length === 0 && <option value="">Đang tải...</option>}
              {dbCourses.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </CmsSelect>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Giảng viên</label>
            <CmsSelect
              value={form.teacherId}
              onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
            >
              <option value="">Chưa phân công</option>
              {(teachers || [])
                .filter((t) => String(t.status || '').toLowerCase() === 'active')
                .map((t) => {
                  const match = teacherMatchesCourse(t, form.courseName);
                  return (
                    <option
                      key={t.id || t._id}
                      value={String(t.id || t._id)}
                      disabled={!match}
                    >
                      {match ? t.name : `${t.name} (khác môn)`}
                    </option>
                  );
                })}
            </CmsSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Học phí</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Số buổi</label>
              <input
                type="number"
                min="1"
                value={form.totalSessions}
                onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))}
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !form.courseId}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : <><Plus size={16} /> Thêm khóa học</>}
          </button>
        </form>
      </div>
    </div>
  );
}
