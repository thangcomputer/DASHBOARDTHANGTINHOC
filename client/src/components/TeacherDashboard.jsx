import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Calendar, CheckCircle, Clock, BookOpen, ChevronRight,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import TeacherAssignmentsView from './TeacherAssignmentsView';
import TeacherTrainingLMS from './TeacherTrainingLMS';
import { useData } from '../context/DataContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import PopupBanner from './PopupBanner';
import TeacherScheduleModal from './teacher/TeacherScheduleModal';
import {
  TeacherLazyStudentsTab,
  TeacherLazyScheduleTab,
  TeacherLazyProfileTab,
  TeacherLazyOverviewTab,
} from './teacher/TeacherLazyTabShell';

export { showGlossyAlert, GlossyAlertProvider, getDisplayName } from './teacher/TeacherShared';
import { getDisplayName } from './teacher/TeacherShared';
import { classifyAttendancePrompt, resolveCheckInGate } from '../utils/attendancePrompt';
import { getAttendanceAction, formatGraceRemaining } from '../utils/attendanceAction';
import { isScheduleDateBeforeToday } from '../utils/scheduleTime';

const TeacherDashboard = ({ onNavigate }) => {
  const { showModal } = useModal();
  let session = {};
  try {
    session = JSON.parse(localStorage.getItem('teacher_user') || '{}') || {};
  } catch {
    session = {};
  }
  const TEACHER_ID = session.id || session._id || null;
  const toast = useToast();
  const {
    students: allStudents, teachers, schedules,
    getStudentsByTeacher, getTeacherStats,
    markAttendance: ctxMarkAttendance,
    updateStudentLink,
    getConversations,
    getSchedulesByTeacher, getTeacherRating, RATING_CRITERIA, getTransactionsByTeacher,
    addSchedule, updateSchedule, cancelSchedule,
    revokeStudentExam, updateStudent, updateTeacher, failStudentExam
  } = useData();

  const { socket, onlineUsers, lastSeenUsers } = useSocket();

  // Helper: tính "X phút trước" từ ISO string
  const timeAgo = (isoStr) => {
    if (!isoStr) return 'Chưa có dữ liệu';
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60)       return `${diff}s trước`;
    if (diff < 3600)     return `${Math.floor(diff / 60)}p trước`;
    if (diff < 86400)    return `${Math.floor(diff / 3600)}h trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  // Đánh trượt học viên — lưu server + thông báo admin & học viên
  const lockStudentExam = async (student) => {
    const reason = 'Vi phạm quy chế giám sát thi';
    try {
      await failStudentExam(
        student.id || student._id,
        `Giảng viên ${session.name || 'phụ trách'} đã đánh trượt. Lý do: ${reason}`,
      );
      showModal({
        title: 'Đã thực thi',
        content: `Hệ thống đã đánh trượt ${student.name}. Học viên và Admin đã nhận thông báo; nếu đang thi sẽ bị khóa ngay.`,
        type: 'success',
      });
    } catch (err) {
      showModal({
        title: 'Không thực hiện được',
        content: err?.message || 'Lỗi khi đánh trượt học viên. Vui lòng thử lại.',
        type: 'error',
      });
    }
  };

  // Trạng thái hiện tại của GV
  const currentTeacher = teachers.find(t => String(t.id) === String(TEACHER_ID) || String(t._id) === String(TEACHER_ID));
  // Vấn đề: `teachers` ở frontend đôi lúc không chứa giáo viên hiện tại do phân quyền gọi getAll.
  // Giải pháp: Sử dụng thêm session.status để kiểm tra fallback chuẩn xác nhất.
  const currentStatus = String(currentTeacher?.status || session.status || '').toLowerCase();
  const isApproved = currentStatus === 'active';

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Active Attendance Modal State (one schedule at a time; queue via pendingCount)
  const [pendingAttendanceSchedule, setPendingAttendanceSchedule] = useState(null);
  const [pendingAttendanceCount, setPendingAttendanceCount] = useState(0);
  const [noShowReason, setNoShowReason] = useState('');
  const [lateReason, setLateReason] = useState('');
  const dismissedAttendanceIdsRef = useRef(new Set());

  // Active Attendance Checker — NO auto popup on load (spec).
  // Only surface a soft count; overdue never opens "Điểm danh ngay".
  useEffect(() => {
    const scan = () => {
      const now = new Date();
      const mySchedulesList = getSchedulesByTeacher(TEACHER_ID) || [];
      let count = 0;
      for (const s of mySchedulesList) {
        if (s.status !== 'scheduled') continue;
        const scheduleId = String(s._id || s.id || '');
        if (scheduleId && dismissedAttendanceIdsRef.current.has(scheduleId)) continue;
        const studentId = String(
          s.studentId?._id || s.studentId?.id || s.studentId || '',
        );
        const courseName = s.course || s.courseName || '';
        const studentRow = (allStudents || []).find(
          (st) => String(st._id || st.id) === studentId,
        );
        const gate = resolveCheckInGate(studentRow, courseName);
        if (gate.canCheckIn === false) continue;
        const mode = classifyAttendancePrompt({
          schedule: s,
          canCheckIn: gate.canCheckIn,
          dismissedIds: dismissedAttendanceIdsRef.current,
          now,
        });
        // Only count in-window actions; never auto-open overdue / expired
        if (mode === 'checkin' || mode === 'late') count += 1;
      }
      setPendingAttendanceCount(count);
      // Do not auto setPendingAttendanceSchedule — teacher opens from schedule UI
    };

    scan();
    const interval = setInterval(scan, 15000);
    return () => clearInterval(interval);
  }, [getSchedulesByTeacher, TEACHER_ID, allStudents]);

  useEffect(() => {
    if (!pendingAttendanceSchedule) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const s = pendingAttendanceSchedule;
        const id = String(s?._id || s?.id || '');
        if (id) dismissedAttendanceIdsRef.current.add(id);
        setPendingAttendanceSchedule(null);
        setNoShowReason('');
        setLateReason('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingAttendanceSchedule]);

  const dismissAttendancePrompt = () => {
    const s = pendingAttendanceSchedule;
    if (s) {
      const id = String(s._id || s.id || '');
      if (id) dismissedAttendanceIdsRef.current.add(id);
    }
    setPendingAttendanceSchedule(null);
    setNoShowReason('');
    setLateReason('');
  };

  const handleActiveAttend = async () => {
    if (!pendingAttendanceSchedule) return;
    const s = pendingAttendanceSchedule;
    const mode = s._promptMode || classifyAttendancePrompt({
      schedule: s,
      canCheckIn: true,
      now: new Date(),
    });
    if (mode === 'expired') {
      toast.info('Đã quá thời gian điểm danh bổ sung. Vui lòng liên hệ Admin/Staff để duyệt điểm danh (correction chưa mở RBAC).');
      return;
    }
    if (mode === 'late' && !String(lateReason || '').trim()) {
      toast.error('Vui lòng nhập lý do điểm danh bổ sung.');
      return;
    }
    const sid = s.studentId?._id || s.studentId?.id || s.studentId;
    const note = mode === 'late'
      ? `Điểm danh bổ sung: ${lateReason.trim()}`
      : 'Hệ thống: Điểm danh';
    try {
      await ctxMarkAttendance(
        sid,
        note,
        0,
        s.course || s.courseName,
        s._id || s.id,
        mode === 'late' ? lateReason.trim() : undefined,
      );
      toast.success(mode === 'late' ? 'Đã điểm danh bổ sung!' : 'Đã điểm danh thành công!');
      dismissAttendancePrompt();
    } catch (err) {
      if (err.cooldown) {
        toast.error(err.message || 'Học viên này đã được điểm danh. Vui lòng thử lại sau 12 tiếng.');
        dismissAttendancePrompt();
      } else if (err.code === 'ATTENDANCE_WINDOW_EXPIRED') {
        toast.error(err.message || 'Đã quá thời gian điểm danh bổ sung.');
        setPendingAttendanceSchedule({ ...s, _promptMode: 'expired' });
      } else {
        toast.error(err.message || 'Lỗi khi điểm danh. Vui lòng thử lại.');
      }
    }
  };

  const handleActiveNoShow = async () => {
    if (!pendingAttendanceSchedule || !noShowReason.trim()) return;
    try {
      const s = pendingAttendanceSchedule;
      const scheduleId = s._id || s.id;
      const res = await updateSchedule(scheduleId, {
        status: 'no_show',
        note: noShowReason.trim(),
      });
      if (res?.success === false) {
        throw new Error(res?.message || 'Không ghi nhận được nghỉ buổi học');
      }
      toast.success('Đã ghi nhận học viên không học');
      dismissAttendancePrompt();
    } catch (e) {
      toast.error(e?.message || 'Lỗi khi ghi nhận nghỉ. Vui lòng thử lại.');
    }
  };

  const handleScheduleSubmit = async (form) => {
    const payload = {
      studentId: form.studentId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime || '',
      note: (form.topic || '').trim(),
      course: form.course,
    };
    try {
      if (editingSchedule && (editingSchedule.id || editingSchedule._id)) {
        const res = await updateSchedule(editingSchedule.id || editingSchedule._id, payload);
        if (res?.success === false) throw new Error(res.message);
        toast.success('Đã cập nhật lịch học');
      } else {
        const res = await addSchedule({ ...payload, topic: payload.note, teacherId: TEACHER_ID });
        if (!res?.success) throw new Error(res?.message || 'Không thể xếp lịch');
        toast.success('Đã xếp lịch học mới');
      }
      setShowScheduleModal(false);
      setEditingSchedule(null);
    } catch (err) {
      toast.error(err?.message || 'Không cập nhật được lịch học');
    }
  };

  const startEditSchedule = (sch) => {
    if (isScheduleDateBeforeToday(sch?.date)) {
      toast.error('Không thể sửa lịch đã qua ngày.');
      return;
    }
    setEditingSchedule(sch);
    setShowScheduleModal(true);
  };

  const students = getStudentsByTeacher(TEACHER_ID).map(s => {
    const studentId = s._id || s.id;
    return {
      ...s,
      displayName: getDisplayName(s),
      // Giữ avatar upload từ API — không ghi đè bằng initials (tránh fallback cartoon mặc định)
      color: (typeof studentId === 'number' ? studentId : (String(studentId).charCodeAt(0) || 0)) % 2 === 1 ? 'bg-purple-500' : 'bg-red-500',
    };
  });
  const teacherName = (currentTeacher?.name && !/^\d+$/.test(currentTeacher.name)) 
    ? currentTeacher.name 
    : currentTeacher?.email || currentTeacher?.phone || session.name || 'Giảng viên';

  const [gradeInputs, setGradeInputs] = useState({});
  const [noteInputs, setNoteInputs] = useState({});
  const [studentSearch, setStudentSearch] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  // Hash có thể kèm query (#students?studentId=…) — chỉ lấy tên tab
  const hashRaw = location.hash?.replace('#', '') || '';
  const currentHash = hashRaw.split(/[?#]/)[0];
  const hashQuery = hashRaw.includes('?') ? hashRaw.slice(hashRaw.indexOf('?') + 1) : '';
  const [selectedEnrollmentKey, setSelectedEnrollmentKey] = useState(null);

  const selectEnrollment = useCallback((studentOrKey) => {
    const student = studentOrKey && typeof studentOrKey === 'object'
      ? studentOrKey
      : students.find((s) => String(s._enrollmentKey || s._id || s.id) === String(studentOrKey));
    const rowKey = student
      ? (student._enrollmentKey || student._id || student.id)
      : studentOrKey;
    if (!rowKey) return;
    setSelectedEnrollmentKey(rowKey);
    const sid = student?._id || student?.id || '';
    const course = student?.course || '';
    const q = new URLSearchParams();
    q.set('enrollmentKey', String(rowKey));
    if (sid) q.set('studentId', String(sid));
    if (course) q.set('course', String(course));
    navigate(
      { pathname: location.pathname || '/teacher', hash: `students?${q.toString()}` },
      { replace: true },
    );
  }, [students, navigate, location.pathname]);

  // Deep-link / mặc đầu: chỉ theo hash + danh sách HV — không đè khi GV vừa chọn tay
  useEffect(() => {
    const params = new URLSearchParams(hashQuery);
    const enrollmentKeyParam = params.get('enrollmentKey');
    const studentId = params.get('studentId');
    const courseParam = params.get('course');

    if (enrollmentKeyParam) {
      const byKey = students.find(
        (s) => String(s._enrollmentKey || s._id || s.id) === String(enrollmentKeyParam),
      );
      if (byKey) {
        const key = byKey._enrollmentKey || byKey._id || byKey.id;
        setSelectedEnrollmentKey((prev) => (String(prev) === String(key) ? prev : key));
        return;
      }
      if (students.length === 0) return;
    }

    if (studentId) {
      const matches = students.filter(
        (s) => String(s._id || s.id) === String(studentId),
      );
      let match = matches[0];
      if (courseParam && matches.length > 1) {
        match = matches.find((s) => String(s.course || '') === String(courseParam)) || match;
      }
      if (match) {
        const key = match._enrollmentKey || match._id || match.id;
        setSelectedEnrollmentKey((prev) => (String(prev) === String(key) ? prev : key));
        return;
      }
      if (students.length === 0) return;
    }

    setSelectedEnrollmentKey((prev) => {
      if (prev) {
        const stillThere = students.some(
          (s) => String(s._enrollmentKey || s._id || s.id) === String(prev),
        );
        if (stillThere) return prev;
      }
      if (students.length > 0) {
        return students[0]._enrollmentKey || students[0]._id || students[0].id;
      }
      return prev;
    });
  }, [students, hashQuery]);

  const markAttendance = async (id, noteParam, gradeParam, courseName) => {
    const note = noteParam || noteInputs[id] || 'Đã điểm danh';
    const grade = gradeParam !== undefined ? gradeParam : (gradeInputs[id] || 0);
    try {
      await ctxMarkAttendance(id, note, Number(grade), courseName);
      toast.success('Đã điểm danh thành công!');
    } catch (err) {
      if (err.cooldown) {
        toast.error(err.message || 'Học viên này đã được điểm danh. Vui lòng thử lại sau 12 tiếng.');
      } else {
        toast.error(err.message || 'Lỗi khi điểm danh. Vui lòng thử lại.');
      }
    }
  };

  const updateLink = (id, newLink) => updateStudentLink(id, newLink);
  const saveGrade = (id, grade, courseName) => {
    const key = courseName ? `${id}::${courseName}` : String(id);
    setGradeInputs(prev => ({ ...prev, [key]: grade }));
    updateStudent(id, { avgGrade: grade, lastGrade: grade, courseName });
  };
  const updateNotes = (id, notes) => {
    setNoteInputs(prev => ({ ...prev, [id]: notes }));
    updateStudent(id, { notes });
  };

  const stats = getTeacherStats(TEACHER_ID);
  const totalDone = stats.totalSessions;
  const totalSess = students.reduce((sum, s) => sum + s.totalSessions, 0);
  const avgGrade = stats.avgGrade;
  const completed = stats.completed;

  const mySchedules = useMemo(() => getSchedulesByTeacher(TEACHER_ID), [getSchedulesByTeacher, TEACHER_ID]);
  const [teacherRating, setTeacherRating] = useState({ avg: 0, count: 0, ratings: [] });
  useEffect(() => {
    api.evaluations.getByTeacher(TEACHER_ID).then(res => {
      if (res.success && res.data) {
        const validRatings = res.data.filter(r => r.criteria && r.criteria.stars);
        const count = validRatings.length;
        const avg = count > 0 ? (Math.round((validRatings.reduce((s, r) => s + r.criteria.stars, 0) / count) * 10) / 10) : 0;
        setTeacherRating({ avg, count, ratings: res.data });
      }
    }).catch(err => void 0);
  }, [TEACHER_ID]);
  const myTransactions = useMemo(() => getTransactionsByTeacher(TEACHER_ID), [getTransactionsByTeacher, TEACHER_ID]);

  const monthlyTransactions = useMemo(() => {
    const today = new Date();
    const currMonth = today.getMonth();
    const currYear = today.getFullYear();
    return myTransactions.filter(t => {
      // Parse flexible date formats (ISO or local dd/mm/yyyy)
      let d;
      if (typeof t.date === 'string' && t.date.includes('/')) {
        const [day, month, year] = t.date.split('/');
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(t.createdAt || t.date);
      }
      return d.getMonth() === currMonth && d.getFullYear() === currYear;
    });
  }, [myTransactions]);

  const totalMonthlyIncome = monthlyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  // Thẻ "Tin nhắn" → inbox: đếm tin chưa đọc (khớp badge Hộp thư), không dùng thông báo chuông
  const myNotifs = useMemo(() => {
    if (!TEACHER_ID || typeof getConversations !== 'function') return 0;
    try {
      return (getConversations(TEACHER_ID) || []).reduce((sum, c) => sum + (Number(c?.unread) || 0), 0);
    } catch {
      return 0;
    }
  }, [TEACHER_ID, getConversations]);

  if (!TEACHER_ID) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <div className="max-w-md text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-lg font-bold text-slate-900">Phiên đăng nhập không hợp lệ</p>
          <p className="text-sm text-slate-500 mt-2">Vui lòng đăng xuất và đăng nhập lại.</p>
        </div>
      </div>
    );
  }

  // ── MÀN HÌNH CHỜ DUYỆT ── chỉ hiện nút Bài Test
  // ⭐ Fix: Chuyển sang logic "Pessimistic" (Coi là pending nếu KHÔNG PHẢI là active)
  const isPending = String(session?.status || '').toLowerCase() !== 'active' && 
                    String(currentTeacher?.status || '').toLowerCase() !== 'active';
  
  if (session.role === 'teacher' && isPending) {
    return (
      <div className="bg-transparent flex items-center justify-center p-6 h-full">
        <div className="max-w-lg w-full">
          {/* Card trung tâm */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-800 to-blue-950 px-8 py-8 text-white text-center">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-yellow-300" />
              </div>
              <h2 className="text-xl font-black mb-1">Tài khoản đang chờ duyệt</h2>
              <p className="text-blue-200 text-sm">Xin chào, <strong>{teacherName}</strong>!</p>
            </div>

            {/* Body */}
            <div className="p-8 space-y-5">
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
                <p className="font-bold mb-1">⏳ Trạng thái: Chờ Admin duyệt</p>
                <p className="text-yellow-700 leading-relaxed">
                  Tài khoản của bạn chưa được cấp quyền giảng dạy chính thức. Vui lòng hoàn thành <strong>bài thi đánh giá</strong> để Admin xét duyệt.
                </p>
              </div>

              {/* Quy trình */}
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">QUY TRÌNH CẤP QUYỀN</p>
                {(() => {
                  const step1Done = currentTeacher?.testScore != null;
                  const step2Done = !!currentTeacher?.practicalFile;
                  const step3Active = step1Done && step2Done;

                  const steps = [
                    {
                      step: '1',
                      label: 'Hoàn thành bài thi',
                      done: step1Done,
                      sub: step1Done ? `Điểm: ${currentTeacher.testScore}/100` : 'Chưa thi',
                      color: 'bg-green-500',
                      text: 'text-green-700'
                    },
                    {
                      step: '2',
                      label: 'Nộp bài thực hành',
                      done: step2Done,
                      sub: step2Done ? (currentTeacher.practicalStatus === 'reviewed' ? 'Đã duyệt' : 'Đã nộp bài') : 'Chưa nộp',
                      color: 'bg-red-500',
                      text: 'text-blue-700'
                    },
                    {
                      step: '3',
                      label: 'Admin xét duyệt',
                      done: false,
                      active: step3Active,
                      sub: step3Active ? 'Đang chờ Admin chấm điểm...' : 'Đang chờ...',
                      color: 'bg-red-500',
                      text: 'text-red-700'
                    },
                  ];

                  return steps.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-4 p-4 rounded-2xl transition-all border-2 ${
                        s.done ? 'bg-green-50 border-green-100' :
                        s.active ? 'bg-red-50 border-red-200 animate-pulse' :
                        'bg-gray-50 border-transparent'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 shadow-sm ${
                        s.done ? 'bg-green-500 text-white' :
                        s.active ? 'bg-red-500 text-white' :
                        'bg-gray-200 text-gray-400'
                      }`}>
                        {s.done ? '✓' : s.step}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${
                          s.done ? 'text-green-800' :
                          s.active ? 'text-red-800' :
                          'text-gray-600'
                        }`}>{s.label}</p>
                        <p className={`text-xs ${
                          s.done ? 'text-green-600/70' :
                          s.active ? 'text-red-500 font-medium' :
                          'text-gray-400'
                        }`}>{s.sub}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Nút tác vụ */}
              <button
                onClick={() => navigate('/teacher/test')}
                className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 shadow-lg ${
                  (currentTeacher?.testScore != null && !!currentTeacher?.practicalFile)
                  ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-black'
                  : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 shadow-red-500/30'
                }`}
              >
                <BookOpen size={20} />
                {currentTeacher?.testScore == null ? 'Làm bài thi ngay' :
                 !currentTeacher?.practicalFile ? 'Tiếp tục nộp bài thực hành' :
                 'Xem lại bài thi'}
                <ChevronRight size={20} />
              </button>
              <p className="text-xs text-center text-gray-400">Liên hệ Admin: <strong className="text-gray-600">093-5758-462</strong> nếu cần hỗ trợ</p>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent h-full flex flex-col min-h-0">
      {/* Popup thông báo — hiện 1 lần/ngày */}
      <PopupBanner role="teacher" />

      <div className="min-w-0 flex-1 flex flex-col min-h-0">
        {/* Topbar removed - using DashboardLayout header */}


        {/* ═══ CONTENT ═══ */}
        {currentHash === 'training' ? (
           <TeacherTrainingLMS onBack={() => window.location.hash = ''} />
        ) : currentHash === 'students' ? (
          <TeacherLazyStudentsTab
            studentSearch={studentSearch}
            setStudentSearch={setStudentSearch}
            students={students}
            onlineUsers={onlineUsers}
            lastSeenUsers={lastSeenUsers}
            timeAgo={timeAgo}
            selectedEnrollmentKey={selectedEnrollmentKey}
            setSelectedEnrollmentKey={selectEnrollment}
            navigate={navigate}
            mySchedules={mySchedules}
            markAttendance={markAttendance}
            updateLink={updateLink}
            saveGrade={saveGrade}
            updateNotes={updateNotes}
            lockStudentExam={lockStudentExam}
            cancelSchedule={cancelSchedule}
          />
        ) : currentHash === 'schedule' ? (
          <TeacherLazyScheduleTab
            setEditingSchedule={setEditingSchedule}
            setShowScheduleModal={setShowScheduleModal}
            mySchedules={mySchedules}
            startEditSchedule={startEditSchedule}
            cancelSchedule={cancelSchedule}
          />
        ) : (currentHash === 'assignments' || currentHash === 'quizzes' || currentHash === 'test') ? (
          <div className="py-2 sm:py-6 md:py-8">
            <TeacherAssignmentsView teacherId={TEACHER_ID} myStudents={students} />
          </div>
        ) : currentHash === 'profile' ? (
          <TeacherLazyProfileTab teacherId={TEACHER_ID} currentTeacher={currentTeacher} />
        ) : (
          <TeacherLazyOverviewTab
            navigate={navigate}
            totalMonthlyIncome={totalMonthlyIncome}
            completed={completed}
            totalDone={totalDone}
            teacherName={teacherName}
            currentTeacher={currentTeacher}
            teacherRating={teacherRating}
            students={students}
            totalSess={totalSess}
            avgGrade={avgGrade}
            mySchedules={mySchedules}
            myNotifs={myNotifs}
            RATING_CRITERIA={RATING_CRITERIA}
          />
        )}
      </div>

      {showScheduleModal && (
        <TeacherScheduleModal
          students={students}
          allSchedules={schedules}
          schedule={editingSchedule}
          teacherId={TEACHER_ID}
          onClose={() => setShowScheduleModal(false)}
          onSubmit={handleScheduleSubmit}
        />
      )}
      {/* ─ ACTIVE ATTENDANCE MODAL (one schedule; closable — does not lock dashboard) ─ */}
      {pendingAttendanceSchedule && (() => {
        const s = pendingAttendanceSchedule;
        const mode = s._promptMode || 'late';
        const actionMeta = getAttendanceAction(s, null, new Date());
        const endLabel = s.endTime || '—';
        const graceLabel = formatGraceRemaining(actionMeta.remainingGraceMs);
        let headerTitle = 'Xác nhận hoàn thành buổi học';
        let headerSub = 'Buổi học đã kết thúc. Vui lòng xác nhận kết quả.';
        let primaryLabel = 'Xác nhận đã dạy';
        let headerBg = 'bg-blue-700';
        if (mode === 'checkin') {
          headerTitle = 'Buổi học đang diễn ra';
          headerSub = 'Vui lòng điểm danh khi buổi học diễn ra.';
          primaryLabel = 'Điểm danh';
          headerBg = 'bg-emerald-700';
        } else if (mode === 'late') {
          headerTitle = 'Điểm danh bổ sung';
          headerSub = 'Buổi học đã kết thúc nhưng chưa được điểm danh.';
          primaryLabel = 'Điểm danh bổ sung';
          headerBg = 'bg-amber-600';
        } else if (mode === 'expired') {
          headerTitle = 'Không thể điểm danh trực tiếp';
          headerSub = 'Đã quá thời gian điểm danh bổ sung.';
          primaryLabel = null;
          headerBg = 'bg-slate-700';
        }
        return (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissAttendancePrompt();
          }}
        >
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className={`${headerBg} p-6 text-white flex items-start gap-4`}>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-lg">{headerTitle}</h3>
                <p className="text-white/85 text-sm mt-1">{headerSub}</p>
                {pendingAttendanceCount > 1 && (
                  <p className="text-white/75 text-xs mt-2">
                    Bạn có {pendingAttendanceCount} buổi chưa xác nhận — đang xem lần lượt.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={dismissAttendancePrompt}
                className="text-white/90 hover:text-white text-sm font-bold px-2 py-1 rounded-lg hover:bg-white/10"
                aria-label="Đóng"
              >
                Đóng
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="grid gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 text-sm font-semibold">Học viên</span>
                    <span className="font-bold text-slate-800 text-base">{s.studentName}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 text-sm font-semibold">Khóa học</span>
                    <span className="font-bold text-blue-700">{s.course}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 text-sm font-semibold">Thời gian</span>
                    <span className="font-black text-slate-800 tracking-wide bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                      {s.startTime} - {s.endTime}
                    </span>
                  </div>
                  {(mode === 'late' || mode === 'expired') && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500 text-sm font-semibold">Kết thúc lúc</span>
                      <span className="font-semibold text-slate-800">{endLabel}</span>
                    </div>
                  )}
                  {mode === 'late' && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500 text-sm font-semibold">Còn lại để bổ sung</span>
                      <span className="font-semibold text-amber-700">{graceLabel}</span>
                    </div>
                  )}
                </div>
              </div>

              {mode === 'late' && (
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block mb-2">
                    Lý do điểm danh bổ sung
                  </label>
                  <textarea
                    rows={2}
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    placeholder="Ví dụ: Quên điểm danh, sự cố hệ thống..."
                    className="w-full border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white"
                  />
                </div>
              )}

              <div className="space-y-3 pt-1">
                {mode === 'expired' ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.info('Correction request chưa mở (cần RBAC/Admin workflow). Liên hệ Admin/Staff để duyệt điểm danh ngoài cửa sổ.');
                    }}
                    className="w-full py-4 text-white font-black bg-slate-700 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    Gửi yêu cầu điểm danh bổ sung
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleActiveAttend}
                    disabled={mode === 'late' && !lateReason.trim()}
                    className="w-full py-4 text-white font-black bg-blue-600 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <CheckCircle size={22} /> {primaryLabel}
                  </button>
                )}

                <button
                  type="button"
                  onClick={dismissAttendancePrompt}
                  className="w-full py-3 text-slate-600 font-bold bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                >
                  Đóng
                </button>

                {mode !== 'expired' && (
                <div className="border border-red-100 bg-red-50/50 rounded-2xl p-4">
                  <label className="text-xs font-black text-red-800 uppercase tracking-widest block mb-2">Học viên không học?</label>
                  <textarea
                    rows={2}
                    value={noShowReason}
                    onChange={(e) => setNoShowReason(e.target.value)}
                    placeholder="Bắt buộc nhập lý do (VD: HS xin nghỉ, GV bận đột xuất...)"
                    className="w-full border-2 border-red-200 focus:border-red-400 rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white mb-3"
                  />
                  <button
                    type="button"
                    onClick={handleActiveNoShow}
                    disabled={!noShowReason.trim()}
                    className="w-full py-3 text-red-600 font-bold bg-white border-2 border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Báo học viên không học
                  </button>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );
};

export default TeacherDashboard;




