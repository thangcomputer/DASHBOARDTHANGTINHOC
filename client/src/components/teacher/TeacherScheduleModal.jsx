import React, { useState } from 'react';
import CmsSelect from '../ui/CmsSelect';
import { X, Save, Calendar } from 'lucide-react';
import {
  isEndTimeAfterStart, normalizeScheduleDate, normalizeTimeHHmm,
  getCurrentTimeHHmm, endTimeFromStart, findStudentScheduleConflict, formatScheduleConflictMessage,
} from '../../utils/scheduleTime';
import { showGlossyAlert } from './TeacherShared';

export const ScheduleModal = ({ schedule, students, allSchedules, onClose, onSubmit }) => {
  const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const getDayOfWeek = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return DAY_NAMES[d.getDay()] || 'Thứ 2';
  };

  const studentKey = (s) => String(s?._enrollmentKey || s?.id || s?._id || '');
  const findStudentByKey = (key) => students.find((s) => studentKey(s) === String(key));

  const isEdit = Boolean(schedule?.id || schedule?._id);
  const initDate = normalizeScheduleDate(schedule?.date);
  const nowStart = getCurrentTimeHHmm();
  const initStart = isEdit ? normalizeTimeHHmm(schedule?.startTime, nowStart) : nowStart;
  const initEnd = isEdit
    ? normalizeTimeHHmm(schedule?.endTime, endTimeFromStart(initStart))
    : endTimeFromStart(nowStart);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(() => {
    const initStudentId = String(schedule?.studentId?._id || schedule?.studentId || '');
    const initCourse = schedule?.course || '';
    const matched = students.find(
      (s) => String(s.id || s._id) === initStudentId && (!initCourse || s.course === initCourse)
    ) || students.find((s) => String(s.id || s._id) === initStudentId) || students[0];
    const key = matched ? studentKey(matched) : studentKey(students[0]);
    return {
      enrollmentKey: key,
      studentId: String(matched?.id || matched?._id || initStudentId),
      date: initDate,
      startTime: initStart,
      endTime: initEnd,
      dayOfWeek: getDayOfWeek(initDate),
      topic: schedule?.topic || schedule?.note || '',
      course: matched?.course || initCourse || students[0]?.course || '',
    };
  });

  const applyStartTime = (raw) => {
    const start = normalizeTimeHHmm(raw, getCurrentTimeHHmm());
    setFormError('');
    setForm((prev) => ({
      ...prev,
      startTime: start,
      endTime: endTimeFromStart(start),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormError('');
    if (name === 'enrollmentKey') {
      const s = findStudentByKey(value);
      setForm((prev) => ({
        ...prev,
        enrollmentKey: String(value),
        studentId: String(s?.id || s?._id || ''),
        course: s?.course || '',
      }));
    } else if (name === 'date') {
      setForm((prev) => ({ ...prev, date: value, dayOfWeek: getDayOfWeek(value) }));
    } else if (name === 'startTime') {
      applyStartTime(value);
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = () => {
    if (!form.studentId?.trim()) {
      setFormError('Vui lòng chọn học viên');
      return;
    }
    if (!form.date?.trim()) {
      setFormError('Vui lòng chọn ngày học');
      return;
    }
    if (!form.startTime?.trim()) {
      setFormError('Vui lòng chọn giờ bắt đầu');
      return;
    }
    // Mỗi buổi cố định 1 giờ 30 phút
    const startTime = normalizeTimeHHmm(form.startTime);
    const endTime = endTimeFromStart(startTime);
    if (!isEndTimeAfterStart(startTime, endTime)) {
      setFormError('Giờ kết thúc phải lớn hơn giờ bắt đầu');
      return;
    }
    const conflict = findStudentScheduleConflict({
      schedules: allSchedules,
      studentId: form.studentId,
      date: form.date,
      startTime,
      endTime,
      excludeScheduleId: schedule?.id || schedule?._id,
    });
    if (conflict) {
      setFormError(formatScheduleConflictMessage(conflict));
      return;
    }
    setFormError('');
    onSubmit({ ...form, startTime, endTime });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-600 px-6 py-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><Calendar size={18}/> {(schedule?.id || schedule?._id) ? 'Cập nhật lịch học' : 'Xếp lịch học mới'}</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Chọn học viên</label>
            <CmsSelect name="enrollmentKey" value={form.enrollmentKey} onChange={handleChange} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none">
              {students.map(s => {
                const key = studentKey(s);
                const sid = String(s.id || s._id || '');
                const displayName = (s.name && !/^\d{5,}$/.test(s.name)) ? s.name : (s.email || s.phone || `HV-${sid.slice(-4)}`);
                return <option key={key} value={key}>{displayName} ({s.course})</option>;
              })}
            </CmsSelect>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Ngày học (Ngày / Tháng / Năm)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              <CmsSelect value={parseInt(form.date.split('-')[2])} onChange={(e) => {
                const parts = form.date.split('-');
                const newDate = `${parts[0]}-${parts[1]}-${String(e.target.value).padStart(2,'0')}`;
                setForm({...form, date: newDate, dayOfWeek: getDayOfWeek(newDate)});
              }} className="bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none text-center">
                {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
              </CmsSelect>
              <CmsSelect value={parseInt(form.date.split('-')[1])} onChange={(e) => {
                const parts = form.date.split('-');
                const newDate = `${parts[0]}-${String(e.target.value).padStart(2,'0')}-${parts[2]}`;
                setForm({...form, date: newDate, dayOfWeek: getDayOfWeek(newDate)});
              }} className="bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none text-center">
                {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>Tháng {m}</option>)}
              </CmsSelect>
              <CmsSelect value={parseInt(form.date.split('-')[0])} onChange={(e) => {
                const parts = form.date.split('-');
                const newDate = `${e.target.value}-${parts[1]}-${parts[2]}`;
                setForm({...form, date: newDate, dayOfWeek: getDayOfWeek(newDate)});
              }} className="bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none text-center">
                {[2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}
              </CmsSelect>
            </div>
            <p className="text-xs text-blue-500 font-semibold mt-1.5 text-center">
              📅 {form.dayOfWeek}, ngày {parseInt(form.date.split('-')[2])}/{parseInt(form.date.split('-')[1])}/{form.date.split('-')[0]}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Bắt đầu</label>
              <input
                type="time"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                onInput={handleChange}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Kết thúc</label>
              <input
                type="time"
                name="endTime"
                value={form.endTime}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                title="Tự động = giờ bắt đầu + 1 giờ 30 phút"
                className="w-full bg-slate-100 border-2 border-gray-100 rounded-xl p-3 text-sm text-slate-600 outline-none cursor-default"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium -mt-2">
            Mỗi buổi học cố định <span className="font-bold text-slate-700">1 giờ 30 phút</span> — giờ kết thúc tự cập nhật khi đổi giờ bắt đầu.
          </p>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Chủ đề buổi học</label>
            <input type="text" name="topic" value={form.topic} onChange={handleChange} placeholder="VD: Ôn tập hàm IF, VLOOKUP" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none" />
          </div>
          {formError && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{formError}</p>
          )}
          <button type="button" onClick={handleSubmit} className="w-full bg-red-600 py-4 rounded-2xl text-white font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition">
            {(schedule?.id || schedule?._id) ? 'CẬP NHẬT LỊCH' : 'XẾP LỊCH NGAY'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── STUDENT CARD ─────────────────────────────────────────────────────────

export default ScheduleModal;
