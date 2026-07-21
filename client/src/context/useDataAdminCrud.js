import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { isTeacherActive, isTeacherPending } from '../constants/teacherStatus';
import { loadState } from './dataStorage';

/**
 * Admin/teacher student-teacher CRUD, exam results, and related helpers for DataProvider.
 */
export function useDataAdminCrud({
  students, setStudents, teachers, setTeachers, transactions, setTransactions,
  triggerBackgroundSync, addNotification,
  fetchStudentsPaginated, studentsPagination, currentUser,
}) {
  const [examResults, setExamResults] = useState(() => loadState('thvp_examResults', []));

  useEffect(() => {
    localStorage.setItem('thvp_examResults', JSON.stringify(examResults));
  }, [examResults]);

  const addStudent = useCallback(async (student) => {
    const payload = {
      name:          student.name,
      age:           student.age || undefined,
      phone:         student.phone || '',
      zalo:          student.zalo || student.phone || '',
      address:       student.address || '',
      course:        student.course,
      price:         student.price || 0,
      totalSessions: student.totalSessions || 12,
      paid:          !!student.paid,
      notes:         student.notes || '',
      linkHoc:       student.linkHoc || '',
      teacherId:     student.teacherId || null,
      learningMode:  student.learningMode || 'OFFLINE',
      branchId:      student.branchId || undefined,
      branchCode:    student.branchCode || '',
    };

    try {
      const res = await api.students.create(payload);
      if (res?.success && res.data) {
        const saved = { ...res.data, id: res.data._id };
        setStudents(prev => [...prev, saved]);
        return saved;
      } else {
        throw new Error(res?.message || 'Lỗi từ máy chủ khi thêm học viên');
      }
    } catch (err) {
      throw err;
    }
  }, [setStudents]);

  const addTeacher = useCallback(async (teacher) => {
    const payload = {
      name:      teacher.name,
      phone:     teacher.phone,
      email:     teacher.email || '',
      specialty: teacher.specialty || '',
      password:  teacher.password || teacher.phone,
      status:    teacher.status || 'inactive',
      branchId:   teacher.branchId || undefined,
      branchCode: teacher.branchCode || undefined,
    };

    try {
      const res = await api.teachers.create(payload);
      if (res?.success && res.data) {
        const saved = { ...res.data, id: res.data._id };
        setTeachers(prev => [...prev, saved]);
        return saved;
      } else {
        throw new Error(res?.message || 'Lỗi từ máy chủ khi thêm giảng viên');
      }
    } catch (err) {
      throw err;
    }
  }, [setTeachers]);

  // Cấp quyền chờ duyệt (Inactive/Locked → Pending): GV đăng nhập được, chỉ thi được
  const grantPending = useCallback(async (teacherId) => {
    const resetData = {
      status: 'pending',
      testScore: 0,
      testStatus: null,
      testDate: null,
      practicalFile: null,
      practicalStatus: 'none',
      lockReason: null,
    };
    const res = await api.teachers.update(teacherId, resetData);
    if (res && res.success === false) {
      throw new Error(res.message || 'Không thể cấp quyền thi');
    }
    setTeachers(prev => prev.map(t =>
      String(t.id) === String(teacherId) || String(t._id) === String(teacherId)
        ? { ...t, ...resetData }
        : t
    ));
  }, [setTeachers]);

  const removeTeacher = useCallback(async (teacherId) => {
    try {
      const res = await api.teachers.remove(teacherId);
      if (res?.success) {
        setTeachers(prev => prev.filter(t => String(t.id) !== String(teacherId) && String(t._id) !== String(teacherId)));
        setStudents(prev => prev.map(s => String(typeof s.teacherId === 'object' && s.teacherId !== null ? s.teacherId._id || s.teacherId.id : s.teacherId) === String(teacherId) ? { ...s, teacherId: null, teacherName: null } : s));
        return true;
      } else {
        throw new Error(res?.message || 'Xoá thất bại');
      }
    } catch (err) {
      throw err;
    }
  }, [setTeachers, setStudents]);

  const updateTeacher = useCallback(async (teacherId, updates) => {
    const previousTeachers = [...teachers];
    setTeachers(prev => prev.map(t => (String(t.id) === String(teacherId) || String(t._id) === String(teacherId)) ? { ...t, ...updates } : t));
    try {
      const res = await api.teachers?.update(teacherId, updates);
      if (res && res.success === false) throw new Error(res.message);
      triggerBackgroundSync();
      return res;
    } catch(err) {
      setTeachers(previousTeachers);
      throw err;
    }
  }, [teachers, setTeachers, triggerBackgroundSync]);

  const updateStudent = useCallback(async (studentId, updates) => {
    const previousStudents = [...students];
    setStudents(prev => prev.map(s => (String(s.id) === String(studentId) || String(s._id) === String(studentId)) ? { ...s, ...updates } : s));
    try {
      const res = await api.students?.update(studentId, updates);
      if (res && res.success === false) throw new Error(res.message);
      triggerBackgroundSync();
      return res;
    } catch(err) {
      setStudents(previousStudents);
      throw err;
    }
  }, [students, setStudents, triggerBackgroundSync]);

  const assignTeacher = useCallback(async (studentId, teacherId) => {
    // 1. Unassign logic
    if (!teacherId || teacherId === '') {
      setStudents(prev => prev.map(s => (String(s.id) === String(studentId) || String(s._id) === String(studentId)) ? { ...s, teacherId: null, teacherName: '', status: 'Chưa phân công' } : s));
      try {
        await api.students?.assignTeacher(studentId, null);
        triggerBackgroundSync();
        // For admin, we should also refetch current page of students
        if (currentUser?.role === 'admin' || currentUser?.role === 'staff') {
          fetchStudentsPaginated({ page: studentsPagination.currentPage });
        }
      } catch (err) {
        console.error('Unassign teacher error:', err);
      }
      return;
    }

    // 2. Assign logic
    const teacher = teachers.find(t => String(t.id) === String(teacherId) || String(t._id) === String(teacherId));
    // Even if teacher is not found in local state (unlikely), we proceed to let API handle it
    const teacherName = teacher ? teacher.name : 'Giảng viên';

    // Optimistic update
    const previousStudents = [...students];
    setStudents(prev => prev.filter(Boolean).map(s => (String(s.id) === String(studentId) || String(s._id) === String(studentId)) ? { ...s, teacherId, teacherName, status: 'Đang học' } : s));

    try {
      const res = await api.students?.assignTeacher(studentId, teacherId);
      if (res?.success) {
        triggerBackgroundSync();
        if (currentUser?.role === 'admin' || currentUser?.role === 'staff') {
          fetchStudentsPaginated({ page: studentsPagination.currentPage });
        }
        const student = students.find(s => String(s.id) === String(studentId) || String(s._id) === String(studentId));
        addNotification(teacherId, 'teacher', `Admin phân công học viên ${student?.name || 'mới'} cho bạn`);
      } else {
        // Rollback
        setStudents(previousStudents);
        throw new Error(res?.message || 'Lỗi phân công');
      }
    } catch (err) {
      console.error('Assign teacher error:', err);
      // Rollback
      setStudents(previousStudents);
      throw err;
    }
  }, [teachers, students, setStudents, triggerBackgroundSync, fetchStudentsPaginated, studentsPagination.currentPage, currentUser, addNotification]);

  const approveTeacher = useCallback(async (teacherId) => {
    const previousTeachers = [...teachers];
    setTeachers(prev => prev.map(t => (String(t.id) === String(teacherId) || String(t._id) === String(teacherId)) ? { ...t, status: 'Active', practicalStatus: 'approved' } : t));

    try {
      const res = await api.teachers?.approve(teacherId);
      if (!res?.success) throw new Error(res?.message || 'Lỗi phê duyệt');
      addNotification(teacherId, 'teacher', 'Chúc mừng! Admin đã cấp quyền Giảng viên cho bạn.');
      triggerBackgroundSync();
      return true;
    } catch (err) {
      setTeachers(previousTeachers);
      throw err;
    }
  }, [teachers, setTeachers, triggerBackgroundSync, addNotification]);

  const rejectTeacher = useCallback(async (teacherId, reason) => {
    const previousTeachers = [...teachers];
    setTeachers(prev => prev.map(t =>
      (String(t.id) === String(teacherId) || String(t._id) === String(teacherId)) ? { ...t, status: 'Locked', practicalStatus: 'rejected' } : t
    ));
    try {
      const res = await api.teachers?.update(teacherId, { status: 'Suspended', lockReason: reason });
      if (!res?.success) throw new Error(res?.message || 'Lỗi từ chối');
      addNotification(teacherId, 'teacher', `Bài thực hành bị từ chối: ${reason}`);
      triggerBackgroundSync();
      return true;
    } catch (err) {
      setTeachers(previousTeachers);
      throw err;
    }
  }, [teachers, setTeachers, triggerBackgroundSync, addNotification]);

  // Chuyển tiền GV → gọi backend tạo Transaction
  const payTeacher = useCallback(async (teacherId, amount, note) => {
    const teacher = teachers.find(t => (String(t.id) === String(teacherId) || String(t._id) === String(teacherId)));
    if (!teacher) return;

    const previousTeachers = [...teachers];
    const previousTransactions = [...transactions];
    const now = new Date();
    const month = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

    // Optimistic update
    const tempId = Date.now();
    const tx = {
      id: tempId, teacherId, teacherName: teacher.name,
      amount, date: now.toLocaleDateString('vi-VN'),
      note: note || `Thù lao ${month}`,
      status: 'confirmed',
    };
    setTransactions(prev => [...prev, tx]);
    setTeachers(prev => prev.map(t =>
      (String(t.id) === String(teacherId) || String(t._id) === String(teacherId)) ? { ...t, paidAmount: (t.paidAmount || 0) + amount } : t
    ));

    try {
      const res = await api.transactions?.create({
        teacherId, amount,
        description: note || `Thù lao ${month}`,
        month,
      });
      if (!res?.success) throw new Error(res?.message || 'Lỗi tạo giao dịch');

      const confirmRes = await api.transactions?.confirm(res.data._id);
      if (!confirmRes?.success) throw new Error(confirmRes?.message || 'Lỗi xác nhận giao dịch');

      setTransactions(prev => prev.map(m => m.id === tempId ? { ...confirmRes.data, id: confirmRes.data._id } : m));
      addNotification(teacherId, 'teacher', `Admin đã chuyển ${amount.toLocaleString('vi-VN')}đ - ${tx.note}`);
      triggerBackgroundSync();
    } catch (err) {
      setTransactions(previousTransactions);
      setTeachers(previousTeachers);
      throw err;
    }
  }, [teachers, transactions, setTeachers, setTransactions, triggerBackgroundSync, addNotification]);

  // Xóa học viên
  const removeStudent = useCallback(async (studentId) => {
    try {
      const res = await api.students.remove(studentId);
      if (res?.success) {
        setStudents(prev => prev.filter(s => String(s.id) !== String(studentId) && String(s._id) !== String(studentId)));
        setTeachers(prev => prev.map(t => ({
          ...t, assignedStudents: (t.assignedStudents || []).filter(id => String(id) !== String(studentId))
        })));
        return true;
      } else {
        throw new Error(res?.message || 'Xoá thất bại');
      }
    } catch (err) {
      throw err;
    }
  }, [setStudents, setTeachers]);

  // Đánh dấu học phí đã thanh toán → gọi backend (tự tạo hóa đơn)
  const markStudentPaid = useCallback(async (studentId, isPaid = true, paymentMethod = 'transfer') => {
    const previousStudents = [...students];
    // Optimistic update UI ngay
    setStudents(prev => prev.map(s =>
      (String(s.id) === String(studentId) || String(s._id) === String(studentId))
        ? { ...s, paid: isPaid, status: isPaid ? 'Đang học' : s.status }
        : s
    ));
    if (isPaid) {
      try {
        const res = await api.students?.pay(studentId, paymentMethod);
        if (!res?.success) throw new Error(res?.message || 'Lỗi thanh toán');
        triggerBackgroundSync();
      } catch (err) {
        setStudents(previousStudents);
        throw err;
      }
    }
  }, [students, setStudents, triggerBackgroundSync]);

  const updateStudentLink = useCallback(async (studentId, linkHoc) => {
    const previousStudents = [...students];
    setStudents(prev => prev.map(s =>
      (String(s.id) === String(studentId) || String(s._id) === String(studentId)) ? { ...s, linkHoc } : s
    ));
    try {
      const res = await api.students?.update(studentId, { linkHoc });
      if (!res?.success) throw new Error(res?.message || 'Lỗi cập nhật link học');
      addNotification(studentId, 'student', `📍 Giảng viên đã cập nhật link học mới. Nhấn vào đây để tham gia.`);
      triggerBackgroundSync();
    } catch (err) {
      setStudents(previousStudents);
      throw err;
    }
  }, [students, setStudents, triggerBackgroundSync, addNotification]);

  // Cập nhật lịch học — sync sang StudentDashboard
  const updateStudentSchedule = useCallback(async (studentId, nextClass, nextClassTime) => {
    const previousStudents = [...students];
    setStudents(prev => prev.map(s =>
      (String(s.id) === String(studentId) || String(s._id) === String(studentId)) ? { ...s, nextClass, nextClassTime } : s
    ));
    try {
      const res = await api.students?.update(studentId, { nextClass, nextClassTime });
      if (!res?.success) throw new Error(res?.message || 'Lỗi cập nhật lịch');
      addNotification(studentId, 'student', `📅 Lịch học đã được cập nhật: ${nextClass}. Nhớ tham gia đúng giờ!`);
      triggerBackgroundSync();
    } catch (err) {
      setStudents(previousStudents);
      throw err;
    }
  }, [students, setStudents, triggerBackgroundSync, addNotification]);

  // GV nộp bài test
  const submitTestResult = useCallback((teacherId, score, passed) => {
    setTeachers(prev => prev.map(t =>
      String(t.id) === String(teacherId) ? { ...t, testScore: score, testStatus: passed ? 'passed' : 'failed' } : t
    ));
    addNotification(null, 'admin', `Giảng viên ID ${teacherId} đã nộp bài test: ${score} điểm - ${passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
  }, [setTeachers, addNotification]);

  // Admin duyệt cho học viên thi cuối khóa → gọi backend unlock
  const approveStudentExam = useCallback(async (studentId) => {
    const previousStudents = [...students];
    const student = students.find(s => (String(s.id) === String(studentId) || String(s._id) === String(studentId)));
    if (!student) return;

    // Optimistic update
    setStudents(prev => prev.map(s =>
      (String(s.id) === String(studentId) || String(s._id) === String(studentId))
        ? { ...s, examApproved: true, studentExamUnlocked: true }
        : s
    ));

    try {
      const res = await api.students?.update(studentId, { studentExamUnlocked: true, examApproved: true });
      if (!res?.success) throw new Error(res?.message || 'Lỗi duyệt thi');
      addNotification(studentId, 'student', '🎓 Admin đã duyệt cho bạn thi cuối khóa! Vào Phòng Thi để bắt đầu.');
      addNotification(null, 'admin', `Đã duyệt thi cuối khóa cho học viên ${student.name}`);
      triggerBackgroundSync();
    } catch (err) {
      setStudents(previousStudents);
      throw err;
    }
  }, [students, setStudents, triggerBackgroundSync, addNotification]);

  // Admin thu hồi quyền thi → gọi backend lock
  const revokeStudentExam = useCallback(async (studentId, reason = '') => {
    const previousStudents = [...students];
    setStudents(prev => prev.map(s =>
      (String(s.id) === String(studentId) || String(s._id) === String(studentId))
        ? { ...s, examApproved: false, studentExamUnlocked: false }
        : s
    ));
    try {
      const res = await api.students?.update(studentId, { studentExamUnlocked: false, examApproved: false });
      if (!res?.success) throw new Error(res?.message || 'Lỗi thu hồi quyền thi');
      triggerBackgroundSync();
    } catch (err) {
      setStudents(previousStudents);
      throw err;
    }
  }, [students, setStudents, triggerBackgroundSync]);

  const saveExamResult = useCallback((studentId, subject, score, passed) => {
    setStudents(prev => prev.map(s =>
      String(s.id) === String(studentId)
        ? { ...s, examResults: { ...(s.examResults || {}), [subject]: { score, passed, date: new Date().toLocaleDateString('vi-VN') } } }
        : s
    ));
  }, [setStudents]);

  // ── KẾT QUẢ THI ADMIN — ghi nhận & chấm điểm (lưu vào MongoDB) ─────────────
  const addExamResult = useCallback(async (data) => {
    const previousExamResults = [...examResults];
    const tempId = `temp_${Date.now()}`;
    const newEntry = { ...data, id: tempId, createdAt: new Date().toISOString() };
    setExamResults(prev => [newEntry, ...prev]);
    try {
      const saved = await api.examResults.create(data);
      if (!saved?.success) throw new Error(saved?.message || 'Lỗi lưu kết quả thi');
      const realData = saved.data;
      setExamResults(prev => prev.map(r => r.id === tempId ? { ...realData, id: realData._id } : r));
      triggerBackgroundSync();
    } catch (err) {
      setExamResults(previousExamResults);
      throw err;
    }
  }, [examResults, triggerBackgroundSync]);

  const updateExamResult = useCallback(async (id, updates) => {
    const previousExamResults = [...examResults];
    setExamResults(prev => prev.map(r => (String(r.id) === String(id) || String(r._id) === String(id)) ? { ...r, ...updates } : r));
    try {
      const mongoId = id.startsWith?.('temp_') ? null : id;
      if (mongoId) {
        const res = await api.examResults.update(mongoId, updates);
        if (!res?.success) throw new Error(res?.message || 'Lỗi cập nhật kết quả thi');
      }
      triggerBackgroundSync();
    } catch (err) {
      setExamResults(previousExamResults);
      throw err;
    }
  }, [examResults, triggerBackgroundSync]);

  const removeExamResult = useCallback(async (id) => {
    const previousExamResults = [...examResults];
    setExamResults(prev => prev.filter(r => String(r.id) !== String(id) && String(r._id) !== String(id)));
    try {
      const mongoId = id.startsWith?.('temp_') ? null : id;
      if (mongoId) {
        const res = await api.examResults.remove(mongoId);
        if (!res?.success) throw new Error(res?.message || 'Lỗi xóa kết quả thi');
      }
      triggerBackgroundSync();
    } catch (err) {
      setExamResults(previousExamResults);
      throw err;
    }
  }, [examResults, triggerBackgroundSync]);

  // GV nộp file thực hành
  const submitPracticalFile = useCallback((teacherId, fileName) => {
    setTeachers(prev => prev.map(t =>
      String(t.id) === String(teacherId) ? { ...t, practicalFile: fileName, practicalStatus: 'pending' } : t
    ));
    addNotification(null, 'admin', `Giảng viên ID ${teacherId} đã nộp bài thực hành: ${fileName}`);
  }, [setTeachers, addNotification]);

  const getStudentsByTeacher = useCallback((teacherId) => {
    return students.filter(Boolean).filter(s => String(typeof s.teacherId === 'object' && s.teacherId !== null ? s.teacherId._id || s.teacherId.id : s.teacherId) === String(teacherId));
  }, [students]);

  const getTeacherStats = useCallback((teacherId) => {
    const myStudents = students.filter(Boolean).filter(s => String(typeof s.teacherId === 'object' && s.teacherId !== null ? s.teacherId._id || s.teacherId.id : s.teacherId) === String(teacherId));
    const totalSessions = myStudents.reduce((sum, s) => sum + (s.completedSessions != null ? s.completedSessions : (s.totalSessions - s.remainingSessions) || 0), 0);
    const avgGrade = myStudents.length > 0
      ? Math.round((myStudents.reduce((sum, s) => sum + (s.avgGrade || 0), 0) / myStudents.length) * 10) / 10
      : 0;
    const completed = myStudents.filter(s => s.status === 'Hoàn thành' || s.remainingSessions <= 0).length;
    return { studentCount: myStudents.length, totalSessions, avgGrade, completed };
  }, [students]);

  const getAdminStats = useCallback(() => {
    const safeStudents = students.filter(Boolean);
    const safeTeachers = teachers.filter(Boolean);
    const totalRevenue = safeStudents.filter(s => s.paid).reduce((sum, s) => sum + (s.price || 0), 0);
    const activeTeachers = safeTeachers.filter(t => isTeacherActive(t.status)).length;
    const pendingTeachers = safeTeachers.filter(t => isTeacherPending(t.status)).length;
    return {
      totalStudents: safeStudents.length,
      totalTeachers: safeTeachers.length,
      activeTeachers,
      pendingTeachers,
      totalRevenue,
    };
  }, [students, teachers]);

  const getTransactionsByTeacher = useCallback((teacherId) => {
    return transactions.filter(t => String(t.teacherId) === String(teacherId));
  }, [transactions]);

  return {
    examResults,
    setExamResults,
    addStudent,
    addTeacher,
    grantPending,
    removeTeacher,
    updateTeacher,
    updateStudent,
    assignTeacher,
    approveTeacher,
    rejectTeacher,
    payTeacher,
    removeStudent,
    markStudentPaid,
    updateStudentLink,
    updateStudentSchedule,
    submitTestResult,
    submitPracticalFile,
    approveStudentExam,
    revokeStudentExam,
    saveExamResult,
    addExamResult,
    updateExamResult,
    removeExamResult,
    getStudentsByTeacher,
    getTeacherStats,
    getAdminStats,
    getTransactionsByTeacher,
  };
}
