import { useCallback } from 'react';
import api from '../services/api';

/**
 * Schedule mutations and attendance (schedules list owned by ScheduleContext / SWR).
 */
export function useDataSchedule({
  schedules, setSchedules, students, teachers, setStudents, triggerBackgroundSync, addNotification,
}) {

  // Điểm danh (GV)
  const markAttendance = useCallback(async (studentId, note, grade, courseName) => {
    const root = students.find(s => String(s._id || s.id) === String(studentId));
    if (!root) throw new Error('Không tìm thấy học viên');

    let targetStudentSync = root;
    if (courseName) {
      const enr = (root.enrollments || []).find((e) => e.courseName === courseName);
      if (enr) {
        targetStudentSync = {
          ...root,
          course: enr.courseName,
          teacherId: enr.teacherId || root.teacherId,
          completedSessions: enr.completedSessions ?? root.completedSessions,
          remainingSessions: enr.remainingSessions ?? root.remainingSessions,
          totalSessions: enr.totalSessions ?? root.totalSessions,
          grades: enr.grades?.length ? enr.grades : root.grades,
          can_check_in: enr.can_check_in ?? root.can_check_in,
          remaining_cooldown_hours: enr.remaining_cooldown_hours ?? root.remaining_cooldown_hours,
        };
      } else if (root.course === courseName) {
        targetStudentSync = root;
      }
    } else {
      const expanded = students.find(
        (s) => String(s._id || s.id) === String(studentId) && s.course && s._enrollmentKey
      );
      if (expanded) targetStudentSync = expanded;
    }

    // 🔐 COOLDOWN 12H: Cho phép CẬP NHẬT ĐIỂM hôm nay, chặn điểm danh buổi mới
    const alreadyCheckedIn = targetStudentSync.can_check_in === false;
    if (alreadyCheckedIn) {
      const todayVN = new Date().toLocaleDateString('vi-VN');
      const todayISO = new Date().toISOString().split('T')[0];
      const gradeNum = Number(grade) || 0;
      const noteText = note || 'Đã điểm danh';
      const priorGrades = [...(targetStudentSync.grades || [])];
      const sameDayIdx = priorGrades.findIndex((g) => {
        const raw = String(g.date || '');
        return raw === todayVN || raw.startsWith(todayISO) || (
          (() => {
            const d = new Date(g.date);
            return !Number.isNaN(d.getTime()) && d.toLocaleDateString('vi-VN') === todayVN;
          })()
        );
      });
      if (sameDayIdx < 0) {
        const remain = targetStudentSync.remaining_cooldown_hours || 0;
        const err = new Error(`Học viên này đã được điểm danh. Vui lòng thử lại sau ${remain} tiếng.`);
        err.cooldown = true;
        err.remainingHours = remain;
        throw err;
      }

      const newGrade = { date: todayVN, note: noteText, grade: gradeNum };
      const newGrades = priorGrades.map((g, i) => (i === sameDayIdx ? { ...g, ...newGrade } : g));
      const validGrades = newGrades.filter((g) => g.grade > 0);
      const avg = validGrades.length > 0
        ? Math.round((validGrades.reduce((sum, g) => sum + g.grade, 0) / validGrades.length) * 10) / 10
        : 0;

      setStudents((prev) => prev.map((s) => {
        if (String(s._id || s.id) !== String(studentId)) return s;
        const patch = { lastGrade: gradeNum || s.lastGrade, avgGrade: avg, grades: newGrades };
        if (courseName && Array.isArray(s.enrollments) && s.enrollments.length) {
          return {
            ...s,
            ...patch,
            enrollments: s.enrollments.map((e) =>
              e.courseName === courseName ? { ...e, grades: newGrades, avgGrade: avg } : e
            ),
          };
        }
        return { ...s, ...patch };
      }));

      const existSch = schedules.find((sch) => {
        const schDate = new Date(sch.date).toISOString().split('T')[0];
        const courseOk = !courseName || !sch.course || sch.course === courseName;
        return String(sch.studentId) === String(studentId) && schDate === todayISO && sch.status === 'completed' && courseOk;
      });
      if (existSch) {
        await api.schedules?.update(existSch._id || existSch.id, {
          status: 'completed',
          note: noteText,
          grade: gradeNum,
        });
      }

      const resStud = await api.students?.update(studentId, {
        lastGrade: gradeNum || targetStudentSync.lastGrade,
        avgGrade: avg,
        grades: newGrades,
        ...(courseName ? { courseName } : {}),
      });
      if (!resStud?.success) throw new Error(resStud?.message || 'Lỗi cập nhật điểm');
      addNotification(studentId, 'student', `Giảng viên đã cập nhật điểm buổi học: ${gradeNum}/10`);
      triggerBackgroundSync();
      return true;
    }

    if (targetStudentSync.remainingSessions <= 0) {
      throw new Error('Học viên đã hết số buổi học. Vui lòng gia hạn thêm.');
    }

    const previousStudents = [...students];
    const previousSchedules = [...schedules];

    try {
      const todayVN = new Date().toLocaleDateString('vi-VN');
      const todayISO = new Date().toISOString().split('T')[0];
      const gradeNum = Number(grade) || 0;

      const newGrade = {
        date: todayVN,
        note: note || 'Đã điểm danh',
        grade: gradeNum,
      };

      const priorGrades = [...(targetStudentSync.grades || [])];
      const sameDayIdx = priorGrades.findIndex((g) => {
        const raw = String(g.date || '');
        return raw === todayVN || raw.startsWith(todayISO) || (
          (() => {
            const d = new Date(g.date);
            return !Number.isNaN(d.getTime()) && d.toLocaleDateString('vi-VN') === todayVN;
          })()
        );
      });
      const newGrades = sameDayIdx >= 0
        ? priorGrades.map((g, i) => (i === sameDayIdx ? { ...g, ...newGrade } : g))
        : [newGrade, ...priorGrades];
      const validGrades = newGrades.filter(g => g.grade > 0);
      const avg = validGrades.length > 0
        ? Math.round((validGrades.reduce((sum, g) => sum + g.grade, 0) / validGrades.length) * 10) / 10
        : 0;

      const newCompleted = (targetStudentSync.completedSessions || 0) + 1;
      const newRemaining = targetStudentSync.remainingSessions - 1;

      // Optimistic Student Update
      setStudents(prev => prev.map(s => {
        if (String(s._id || s.id) !== String(studentId)) return s;
        const patch = {
          completedSessions: newCompleted,
          remainingSessions: newRemaining,
          lastGrade: gradeNum || s.lastGrade,
          avgGrade: avg,
          grades: newGrades,
          status: newRemaining <= 0 ? 'Hoàn thành' : 'Đang học',
          can_check_in: false,
          remaining_cooldown_hours: 12,
        };
        if (courseName && Array.isArray(s.enrollments) && s.enrollments.length) {
          return {
            ...s,
            ...patch,
            enrollments: s.enrollments.map((e) =>
              e.courseName === courseName
                ? { ...e, completedSessions: newCompleted, remainingSessions: newRemaining, grades: newGrades, avgGrade: avg }
                : e
            ),
          };
        }
        return { ...s, ...patch };
      }));

      // Check if schedule exists today
      const existSch = schedules.find(sch => {
        const schDate = new Date(sch.date).toISOString().split('T')[0];
        const courseOk = !courseName || !sch.course || sch.course === courseName;
        return String(sch.studentId) === String(studentId) && schDate === todayISO && sch.status !== 'cancelled' && courseOk;
      });

      if (existSch) {
        // Optimistic Schedule Update
        setSchedules(prev => prev.map(s => (s._id || s.id) === (existSch._id || existSch.id) ? { ...s, status: 'completed' } : s));

        const resSch = await api.schedules?.update(existSch._id || existSch.id, {
          status: 'completed',
          note: note || existSch.note || 'Đã điểm danh hoàn thành buổi học',
          grade: gradeNum,
        });
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
          course: courseName || targetStudentSync.course || '',
          note: note || 'Đã điểm danh hoàn thành buổi học',
          status: 'completed',
          paymentStatus: 'pending',
          grade: gradeNum,
          sessionGrade: gradeNum,
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
        lastGrade: gradeNum || targetStudentSync.lastGrade,
        avgGrade: avg,
        grades: newGrades,
        completedSessions: newCompleted,
        remainingSessions: newRemaining,
        status: newRemaining <= 0 ? 'Hoàn thành' : 'Đang học',
        ...(courseName ? { courseName } : {}),
      });

      if (!resStud?.success) throw new Error(resStud?.message || 'Lỗi đồng bộ thông tin học viên');

      addNotification(studentId, 'student', `Giảng viên đã điểm danh buổi học. Điểm: ${gradeNum}/10`);
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

    return api.schedules?.create(payload).then(res => {
      if (res?.success && res.data) {
        setSchedules(prev => prev.map(s =>
          s.id === tempId ? { ...res.data, id: res.data._id } : s
        ));
        triggerBackgroundSync();
        return res;
      }
      setSchedules(prev => prev.filter(s => s.id !== tempId));
      if (student) {
        setStudents(prev => prev.map(s =>
          (String(s.id) === String(schedule.studentId) || String(s._id) === String(schedule.studentId))
            ? { ...s, nextClass: student.nextClass, nextClassTime: student.nextClassTime } : s
        ));
      }
      return { success: false, message: res?.message || 'Lỗi không xác định' };
    }).catch(() => {
      setSchedules(prev => prev.filter(s => s.id !== tempId));
      if (student) {
        setStudents(prev => prev.map(s =>
          (String(s.id) === String(schedule.studentId) || String(s._id) === String(schedule.studentId))
            ? { ...s, nextClass: student.nextClass, nextClassTime: student.nextClassTime } : s
        ));
      }
      return { success: false, message: 'Lỗi mạng kết nối, không thể xếp lịch.' };
    });
  }, [students, teachers, setStudents, triggerBackgroundSync, addNotification]);

  // Cập nhật lịch học (GV đổi giờ/link/topic)
  const updateSchedule = useCallback(async (scheduleId, updates) => {
    const previousSchedules = [...schedules];
    const previousStudents = [...students];
    const payload = {
      date: updates.date,
      startTime: updates.startTime,
      endTime: updates.endTime,
      note: updates.note ?? updates.topic ?? '',
    };
    if (payload.date == null) delete payload.date;
    if (payload.startTime == null) delete payload.startTime;
    if (payload.endTime == null) delete payload.endTime;

    setSchedules((prev) => prev.map((sch) => {
      if (String(sch.id) === String(scheduleId) || String(sch._id) === String(scheduleId)) {
        return { ...sch, ...payload, topic: payload.note };
      }
      return sch;
    }));

    try {
      const res = await api.schedules?.update(scheduleId, payload);
      if (!res?.success) throw new Error(res?.message || 'Lỗi cập nhật lịch');
      if (res.data) {
        const merged = { ...res.data, id: res.data._id || res.data.id };
        setSchedules((prev) => prev.map((sch) =>
          (String(sch.id) === String(scheduleId) || String(sch._id) === String(scheduleId))
            ? { ...sch, ...merged, topic: merged.note || sch.topic }
            : sch
        ));
      }
      const sid = res.data?.studentId?._id || res.data?.studentId;
      if (sid) {
        addNotification(sid, 'student',
          `📅 Lịch học đã cập nhật — ${payload.note || ''} ${payload.startTime || ''} ngày ${payload.date || ''}`.trim());
      }
      triggerBackgroundSync();
      return res;
    } catch (err) {
      setSchedules(previousSchedules);
      setStudents(previousStudents);
      throw err;
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
