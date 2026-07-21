import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { loadState } from './dataStorage';

/**
 * Schedules state and attendance for DataProvider.
 */
export function useDataSchedule({ students, teachers, setStudents, triggerBackgroundSync, addNotification }) {
  const [schedules, setSchedules] = useState(() => loadState('thvp_schedules', []));

  // Strip null entries that may exist in legacy localStorage caches
  useEffect(() => {
    setSchedules((prev) => {
      if (!Array.isArray(prev)) return prev;
      const next = prev.filter(Boolean);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('thvp_schedules', JSON.stringify(schedules));
  }, [schedules]);

  // Điểm danh (GV)
  const markAttendance = useCallback(async (studentId, note, grade) => {
    // 1. Kiểm tra Gate giữ chỗ
    const targetStudentSync = students.find(s => String(s._id || s.id) === String(studentId));
    if (!targetStudentSync) throw new Error('Không tìm thấy học viên');

    // 🔐 COOLDOWN 12H: Chặn ngay nếu cờ can_check_in = false
    if (targetStudentSync.can_check_in === false) {
      const remain = targetStudentSync.remaining_cooldown_hours || 0;
      const err = new Error(`Học viên này đã được điểm danh. Vui lòng thử lại sau ${remain} tiếng.`);
      err.cooldown = true;
      err.remainingHours = remain;
      throw err;
    }

    if (targetStudentSync.remainingSessions <= 0) {
      throw new Error('Học viên đã hết số buổi học. Vui lòng gia hạn thêm.');
    }

    const previousStudents = [...students];
    const previousSchedules = [...schedules];

    try {
      const todayVN = new Date().toLocaleDateString('vi-VN');
      const todayISO = new Date().toISOString().split('T')[0];

      const newGrade = {
        date: todayVN,
        note: note || 'Đã điểm danh',
        grade: grade || 0,
      };

      const newGrades = [newGrade, ...(targetStudentSync.grades || [])];
      const validGrades = newGrades.filter(g => g.grade > 0);
      const avg = validGrades.length > 0
        ? Math.round((validGrades.reduce((sum, g) => sum + g.grade, 0) / validGrades.length) * 10) / 10
        : 0;

      const newCompleted = (targetStudentSync.completedSessions || 0) + 1;
      const newRemaining = targetStudentSync.remainingSessions - 1;

      // Optimistic Student Update
      setStudents(prev => prev.map(s => {
        if (String(s._id || s.id) !== String(studentId)) return s;
        return {
          ...s,
          completedSessions: newCompleted,
          remainingSessions: newRemaining,
          lastGrade: grade || s.lastGrade,
          avgGrade: avg,
          grades: newGrades,
          status: newRemaining <= 0 ? 'Hoàn thành' : 'Đang học',
          can_check_in: false,
          remaining_cooldown_hours: 12,
        };
      }));

      // Check if schedule exists today
      const existSch = schedules.find(sch => {
        const schDate = new Date(sch.date).toISOString().split('T')[0];
        return String(sch.studentId) === String(studentId) && schDate === todayISO && sch.status !== 'cancelled';
      });

      if (existSch) {
        // Optimistic Schedule Update
        setSchedules(prev => prev.map(s => (s._id || s.id) === (existSch._id || existSch.id) ? { ...s, status: 'completed' } : s));

        const resSch = await api.schedules?.update(existSch._id || existSch.id, { status: 'completed' });
        if (!resSch?.success) throw new Error(resSch?.message || 'Lỗi cập nhật lịch học');
      } else {
        // Create new schedule
        const getActiveSession = () => {
          try {
            return JSON.parse(localStorage.getItem('teacher_user') || localStorage.getItem('admin_user') || '{}');
          } catch { return {}; }
        };
        const activeSession = getActiveSession();
        const now = new Date();
        const tempId = 'temp-' + Date.now();

        const newSch = {
          id: tempId,
          teacherId: String(targetStudentSync.teacherId?._id || targetStudentSync.teacherId || activeSession.id || activeSession._id),
          teacherName: activeSession.name || 'Giảng viên',
          studentId: String(studentId),
          studentName: targetStudentSync.name,
          date: now.toISOString().split('T')[0],
          startTime: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          course: targetStudentSync.course || '',
          status: 'completed',
          paymentStatus: 'pending',
        };

        setSchedules(prev => [...prev, newSch]);
        const resCreate = await api.schedules?.create(newSch);
        if (resCreate?.success) {
          setSchedules(prev => prev.map(s => s.id === tempId ? { ...resCreate.data, id: resCreate.data._id } : s));
        } else {
          throw new Error(resCreate?.message || 'Lỗi tạo lịch học mới');
        }
      }

      // Finalize Student on Server (Already did optimistic UI)
      const resStud = await api.students?.update(studentId, {
        lastGrade: grade || targetStudentSync.lastGrade,
        avgGrade: avg,
        grades: newGrades,
        completedSessions: newCompleted,
        remainingSessions: newRemaining,
        status: newRemaining <= 0 ? 'Hoàn thành' : 'Đang học',
      });

      if (!resStud?.success) throw new Error(resStud?.message || 'Lỗi đồng bộ thông tin học viên');

      addNotification(studentId, 'student', `Giảng viên đã điểm danh buổi học. Điểm: ${grade || 0}/10`);
      triggerBackgroundSync();
      return true;

    } catch (err) {
      console.error('[DataContext] markAttendance error:', err);
      // Rollback
      setStudents(previousStudents);
      setSchedules(previousSchedules);
      throw err;
    }
  }, [students, schedules, setStudents, triggerBackgroundSync, addNotification]);

  const addSchedule = useCallback((schedule) => {
    const student = students.find(s => String(s.id) === String(schedule.studentId) || String(s._id) === String(schedule.studentId));
    const teacher = teachers.find(t => String(t.id) === String(schedule.teacherId) || String(t._id) === String(schedule.teacherId));
    const studentDisplayName = student
      ? ((student.name && !/^\d{5,}$/.test(student.name)) ? student.name : student.email || student.phone || `HV-${String(student.id || student._id || '').slice(-4)}`)
      : (schedule.studentName || '');
    const tempId = `temp_${Date.now()}`;
    const newSched = {
      ...schedule,
      id: tempId,
      status: schedule.status || 'scheduled',
      studentName: studentDisplayName,
      teacherName: teacher?.name || schedule.teacherName || '',
    };
    // Optimistic UI: hiện ngay
    setSchedules(prev => [...prev, newSched]);
    // Đồng bộ nextClass cho student
    if (student) {
      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const d = new Date(schedule.date);
      const dayName = dayNames[d.getDay()];
      const dateStr = `${schedule.startTime} - ${dayName} (${d.toLocaleDateString('vi-VN')})`;
      setStudents(prev => prev.map(s =>
        (String(s.id) === String(schedule.studentId) || String(s._id) === String(schedule.studentId))
          ? { ...s, nextClass: dateStr, nextClassTime: `${schedule.date}T${schedule.startTime}:00` } : s
      ));
    }
    addNotification(schedule.studentId, 'student', `📅 Lịch học mới: ${schedule.course} lúc ${schedule.startTime} ngày ${schedule.date}`);

    // Gửi lên server — không gửi local id
    const payload = { ...newSched };
    delete payload.id;
    delete payload._id;

    api.schedules?.create(payload).then(res => {
      if (res?.success && res.data) {
        // Thay thế temp record bằng record thật từ DB
        setSchedules(prev => prev.map(s =>
          s.id === tempId ? { ...res.data, id: res.data._id } : s
        ));
        triggerBackgroundSync();
      } else {
        // Rollback nếu fail
        alert(`Không thể xếp lịch: ${res?.message || 'Lỗi không xác định'}`);
        setSchedules(prev => prev.filter(s => s.id !== tempId));
      }
    }).catch(err => {
      alert('Lỗi mạng kết nối, không thể xếp lịch.');
      setSchedules(prev => prev.filter(s => s.id !== tempId));
    });

    return newSched;
  }, [students, teachers, setStudents, triggerBackgroundSync, addNotification]);

  // Cập nhật lịch học (GV đổi giờ/link/topic)
  const updateSchedule = useCallback(async (scheduleId, updates) => {
    const previousSchedules = [...schedules];
    const previousStudents = [...students];
    let updatedSched = null;

    setSchedules(prev => prev.map(sch => {
      if (String(sch.id) === String(scheduleId) || String(sch._id) === String(scheduleId)) {
        updatedSched = { ...sch, ...updates };
        return updatedSched;
      }
      return sch;
    }));

    if (updatedSched) {
      if (updates.linkHoc) {
        setStudents(prev => prev.map(s =>
          String(s.id) === String(updatedSched.studentId) ? { ...s, linkHoc: updates.linkHoc } : s
        ));
      }
      try {
        const res = await api.schedules?.update(scheduleId, updates);
        if (res && res.success === false) throw new Error(res.message);
        addNotification(updatedSched.studentId, 'student',
          `📅 Lịch học đã cập nhật: ${updates.topic || updatedSched.topic} — ${updates.startTime || updatedSched.startTime} ngày ${updates.date || updatedSched.date}`);
        triggerBackgroundSync();
        return res;
      } catch (err) {
        setSchedules(previousSchedules);
        setStudents(previousStudents);
        throw err;
      }
    }
  }, [schedules, students, setStudents, triggerBackgroundSync, addNotification]);

  // Hủy buổi học
  const cancelSchedule = useCallback(async (scheduleId, reason) => {
    const previousSchedules = [...schedules];
    let cancelled = null;
    setSchedules(prev => prev.map(sch => {
      if (String(sch.id) === String(scheduleId) || String(sch._id) === String(scheduleId)) {
        cancelled = { ...sch, status: 'cancelled', cancelReason: reason };
        return cancelled;
      }
      return sch;
    }));
    if (cancelled) {
      try {
        const res = await api.schedules?.update(scheduleId, { status: 'cancelled', cancelReason: reason });
        if (res && res.success === false) throw new Error(res.message);
        addNotification(cancelled.studentId, 'student',
          `⚠️ Buổi học ngày ${cancelled.date} đã bị hủy. Lý do: ${reason || 'Không rõ'}`);
        addNotification(cancelled.teacherId, 'teacher',
          `Đã hủy buổi học với ${cancelled.studentName} ngày ${cancelled.date}`);
        triggerBackgroundSync();
        return res;
      } catch (err) {
        setSchedules(previousSchedules);
        throw err;
      }
    }
  }, [schedules, triggerBackgroundSync, addNotification]);

  const getSchedulesByTeacher = useCallback((teacherId) => {
    return schedules.filter(s => String(s.teacherId) === String(teacherId));
  }, [schedules]);

  const getSchedulesByStudent = useCallback((studentId) => {
    return schedules.filter(s => String(s.studentId) === String(studentId));
  }, [schedules]);

  return {
    schedules,
    setSchedules,
    addSchedule,
    updateSchedule,
    cancelSchedule,
    markAttendance,
    getSchedulesByTeacher,
    getSchedulesByStudent,
  };
}
