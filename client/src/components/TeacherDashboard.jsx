import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import CmsSelect from './ui/CmsSelect';
import {
  Calendar, Video, CheckCircle, Save, MessageSquare, FileText,
  GraduationCap, TrendingUp, Clock, Star, Link2, Upload,
  Bell, LogOut, Plus, ChevronRight, BookOpen, Award, Zap,
  BarChart3, Users, ArrowLeft, ChevronLeft, Eye, X, XCircle,
  Search, Download, AlertCircle, Clipboard, Send, UserCheck, Check,
  Activity, DollarSign, Filter, User, Phone, Mail, Building2,
  CreditCard, Landmark, Copy, Edit3, Shield, MapPin, Trash2, Ban, PlayCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useSocket } from '../context/SocketContext';
import api, { teachersAPI, csrfFetch, resolveMediaUrl, buildMediaDownloadUrl } from '../services/api';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import PopupBanner from './PopupBanner';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import {
  isEndTimeAfterStart, normalizeScheduleDate, normalizeTimeHHmm,
  getCurrentTimeHHmm, endTimeFromStart, isScheduleOngoingNow,
  findStudentScheduleConflict, formatScheduleConflictMessage,
} from '../utils/scheduleTime';
import { getGradeBadgeClasses, getGradeLabel } from '../utils/gradeColors';

import { showGlossyAlert, GlossyAlertProvider } from './teacher/TeacherShared';
import TeacherRatingDisplay from './teacher/TeacherRatingDisplay';
import {
  TeacherLazyTrainingTab,
  TeacherLazyAssignmentsTab,
  TeacherLazyProfileTab,
  TeacherLazyMonthlyCalendar,
  TeacherLazyScheduleModal,
  TeacherLazyStudentCard,
} from './teacher/TeacherLazyTabShell';

export { showGlossyAlert, GlossyAlertProvider } from './teacher/TeacherShared';

const getDisplayName = (person) => {
  if (!person) return 'Không rõ';
  const name = person.name || '';
  if (name && !/^\d{5,}$/.test(name)) return name;
  return person.email || person.phone || person.zalo || `HV-${String(person.id || person._id || '').slice(-4)}`;
};

const TeacherDashboard = ({ onNavigate }) => {
  const { showModal } = useModal();
  const session = JSON.parse(localStorage.getItem('teacher_user') || '{}');
  const TEACHER_ID = session.id || session._id || 1;
  const {
    students: allStudents, teachers, schedules,
    getStudentsByTeacher, getTeacherStats,
    markAttendance: ctxMarkAttendance,
    updateStudentLink,
    notifications, getNotifications,
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

  // Active Attendance Modal State
  const [pendingAttendanceSchedule, setPendingAttendanceSchedule] = useState(null);
  const [noShowReason, setNoShowReason] = useState('');

  // Active Attendance Checker
  useEffect(() => {
    const interval = setInterval(() => {
      // Don't override if already handling one
      if (pendingAttendanceSchedule) return;

      const now = new Date();
      const mySchedulesList = getSchedulesByTeacher(TEACHER_ID);

      const pending = mySchedulesList.find(s => {
        if (s.status !== 'scheduled') return false;
        
        // Ensure the date is today
        const sd = new Date(s.date);
        if (
          sd.getFullYear() !== now.getFullYear() ||
          sd.getMonth() !== now.getMonth() ||
          sd.getDate() !== now.getDate()
        ) return false;

        // Check time
        if (!s.endTime) return false;
        const [eh, em] = s.endTime.split(':');
        // Subtract 0 so it's a number
        const endObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(eh, 10), parseInt(em, 10), 0);
        
        return now >= endObj;
      });

      if (pending) {
        setPendingAttendanceSchedule(pending);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [pendingAttendanceSchedule, getSchedulesByTeacher, TEACHER_ID]);

  const handleActiveAttend = async () => {
    if (!pendingAttendanceSchedule) return;
    try {
      const s = pendingAttendanceSchedule;
      // Mark local students attendance + minus lesson
      await markAttendance(s.studentId, 'Hệ thống: Điểm danh tự động', 0);
      // Update schedule to completed
      updateSchedule(s.id || s._id, { status: 'completed' });
    } catch (e) {
      toast.error('Lỗi điểm danh!');
    }
    setPendingAttendanceSchedule(null);
  };

  const handleActiveNoShow = async () => {
    if (!pendingAttendanceSchedule || !noShowReason.trim()) return;
    try {
      const s = pendingAttendanceSchedule;
      const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");
      const token = localStorage.getItem('teacher_access_token') || localStorage.getItem('admin_access_token');
      await csrfFetch(`${API}/api/schedules/${s._id || s.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: noShowReason }),
      });
      cancelSchedule(s._id || s.id, noShowReason);
    } catch (e) {
    }
    setPendingAttendanceSchedule(null);
    setNoShowReason('');
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
    setEditingSchedule(sch);
    setShowScheduleModal(true);
  };

  const students = getStudentsByTeacher(TEACHER_ID).map(s => {
    const studentId = s._id || s.id;
    return {
      ...s,
      displayName: getDisplayName(s),
      avatar: getDisplayName(s).substring(0, 2).toUpperCase(),
      color: (typeof studentId === 'number' ? studentId : (String(studentId).charCodeAt(0) || 0)) % 2 === 1 ? 'bg-purple-500' : 'bg-blue-500',
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
  const currentHash = location.hash?.replace('#', '') || '';
  const toast = useToast();
  const [selectedEnrollmentKey, setSelectedEnrollmentKey] = useState(null);

  // Auto-select first student if none selected OR from URL params (Notifications)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('studentId=')) {
      const params = new URLSearchParams(hash.split('?')[1]);
      const studentId = params.get('studentId');
      if (studentId) {
        const match = students.find((s) => String(s._id || s.id) === String(studentId));
        const key = match?._enrollmentKey || studentId;
        if (key && String(selectedEnrollmentKey) !== String(key)) {
          setSelectedEnrollmentKey(key);
          return;
        }
      }
    }

    if (!selectedEnrollmentKey && students.length > 0) {
      setSelectedEnrollmentKey(students[0]._enrollmentKey || students[0]._id || students[0].id);
    }
  }, [students, selectedEnrollmentKey, location.hash]);

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
        toast.error('Lỗi khi điểm danh. Vui lòng thử lại.');
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
  const myNotifs = getNotifications(TEACHER_ID, 'teacher').filter(n => !n.read).length;

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
                      color: 'bg-blue-500',
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
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 shadow-blue-500/30'
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
    <div className="bg-transparent h-full">
      {/* Popup thông báo — hiện 1 lần/ngày */}
      <PopupBanner role="teacher" />

      <div className="min-w-0 pt-4">
        {/* Topbar removed - using DashboardLayout header */}


        {/* ═══ CONTENT ═══ */}
        {currentHash === 'training' ? (
           <TeacherLazyTrainingTab onBack={() => window.location.hash = ''} />
        ) : currentHash === 'students' ? (
          /* ═══ QUẢN LÝ HỌC VIÊN 2 CỘT ═══ */
          <div className="px-4 md:px-8 py-6 min-h-[calc(100vh-120px)] xl:h-[calc(100vh-120px)] flex flex-col xl:flex-row gap-6 xl:overflow-hidden">
            
            {/* CỘT 1: DANH SÁCH HỌC VIÊN (Sidebar) */}
            <div className="w-full xl:w-80 h-[500px] xl:h-full flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
               <div className="p-4 border-b border-gray-50 bg-gray-50/30">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Tìm học viên..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-all"
                    />
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {students
                    .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.course?.toLowerCase().includes(studentSearch.toLowerCase()))
                    .map(s => {
                      const sId = s._id || s.id;
                      const rowKey = s._enrollmentKey || String(sId);
                      const isOnline = onlineUsers.some(u => String(u.userId) === String(sId));
                      const isSelected = String(selectedEnrollmentKey) === String(rowKey);
                      return (
                        <div
                          key={rowKey}
                          onClick={() => setSelectedEnrollmentKey(rowKey)}
                          role="button"
                          tabIndex={0}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group cursor-pointer ${
                            isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedEnrollmentKey(rowKey); } }}
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm bg-white">
                              <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
                            </div>
                            {isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" title="Đang hoạt động" />
                            )}
                          </div>
                          
                          <div className="flex-1 text-left min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>{s.name}</p>
                            {s.course && (
                              <p className={`text-[10px] font-black uppercase tracking-tight truncate mt-0.5 ${isSelected ? 'text-blue-200' : 'text-indigo-600'}`}>
                                {s.course}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isOnline ? (
                                <span className={`text-xs font-bold uppercase tracking-tighter ${isSelected ? 'text-blue-200' : 'text-green-500'}`}>Đang online</span>
                              ) : (
                                <span className={`text-xs font-medium ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                                  {lastSeenUsers[String(sId)]
                                    ? `${timeAgo(lastSeenUsers[String(sId)])}`
                                    : 'Chưa online'}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {!isSelected && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                navigate('/teacher/inbox'); 
                              }} 
                              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600 transition-all border-none outline-none"
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  }
                  {students.length === 0 && (
                     <div className="text-center py-10 opacity-30">
                        <Users size={40} className="mx-auto mb-2" />
                        <p className="text-sm font-bold">Chưa có học viên</p>
                     </div>
                  )}
               </div>
            </div>

            {/* CỘT 2: CHI TIẾT HỌC VIÊN (Main Content) */}
            <div className="flex-1 xl:overflow-y-auto pr-1">
              {selectedEnrollmentKey ? (
                (() => {
                  const student = students.find(s => String(s._enrollmentKey || s._id || s.id) === String(selectedEnrollmentKey));
                  if (!student) return <div className="p-20 text-center text-gray-400">Không tìm thấy thông tin</div>;

                  // ─── TÍNH TOÁN CỔNG ĐIỂM DANH (THEO LỊCH + KHÓA) ───
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  const d = String(now.getDate()).padStart(2, '0');
                  const todayStr = `${y}-${m}-${d}`;

                  const studentId = student._id || student.id;
                  const courseName = student.course || '';
                  const todaySchedules = mySchedules.filter(s =>
                    String(s.studentId) === String(studentId) &&
                    s.date.startsWith(todayStr) &&
                    s.status === 'scheduled' &&
                    (!courseName || !s.course || s.course === courseName)
                  );
                  
                  let attendanceGate = { status: 'no_schedule' };
                  if (todaySchedules.length > 0) {
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const readySch = todaySchedules.find(s => currentTime >= s.startTime);
                    if (readySch) {
                      attendanceGate = { status: 'ready' };
                    } else {
                      attendanceGate = { status: 'not_yet' };
                    }
                  }

                  return (
                    <TeacherLazyStudentCard 
                      key={student._enrollmentKey || student._id || student.id} student={student}
                      onAttendance={(id, note, grade) => markAttendance(id, note, grade, courseName)} onUpdateLink={updateLink}
                      onSaveGrade={saveGrade} onUpdateNotes={updateNotes}
                      onLockExam={lockStudentExam} 
                      isDetailed={true}
                      attendanceGate={attendanceGate}
                    />
                  );
                })()
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-gray-100 text-gray-300">
                   <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <GraduationCap size={40} />
                   </div>
                   <p className="font-bold">Vui lòng chọn học viên ở danh sách bên trái</p>
                </div>
              )}
            </div>
          </div>

        ) : currentHash === 'schedule' ? (
          /* ═══ LỊCH DẠY ═══ */
          <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
            <div className="cms-toolbar sm:flex-row sm:items-center sm:justify-between min-w-0">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 min-w-0">
                <Calendar size={20} className="text-blue-600 shrink-0" /> Lịch dạy
              </h2>
              <button onClick={() => { setEditingSchedule(null); setShowScheduleModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
                <Plus size={14} /> Xếp lịch mới
              </button>
            </div>
            <TeacherLazyMonthlyCalendar
              schedules={mySchedules}
              onEditSchedule={startEditSchedule}
              onAddSchedule={(date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                setEditingSchedule({ date: `${yyyy}-${mm}-${dd}` }); // pre-fill correctly localized
                setShowScheduleModal(true);
              }}
              onCancelSchedule={(scheduleId, reason) => {
                cancelSchedule(scheduleId, reason);
              }}
            />
          </div>

        ) : currentHash === 'assignments' ? (
          /* ═══ BÀI TẬP / THỰC HÀNH ═══ */
          <div className="px-4 md:px-8 py-6 md:py-8">
            <TeacherLazyAssignmentsTab teacherId={TEACHER_ID} myStudents={students} />
          </div>

        ) : currentHash === 'profile' ? (
          /* ═══ HỒ SƠ CÁ NHÂN ═══ */
          <TeacherLazyProfileTab teacherId={TEACHER_ID} currentTeacher={currentTeacher} />

        ) : (
          /* ═══ TỔNG QUAN CHUYÊN NGHIỆP ═══ */
          <div className="px-4 md:px-8 py-6 md:py-8 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            
            {/* ── HIGHLIGHT HERO SECTION ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {/* Income & Performance Card */}
               <div className="md:col-span-2 xl:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-[40px] p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 h-full">
                     <div className="space-y-4">
                        <div>
                           <p className="text-blue-300 text-xs font-black uppercase tracking-widest mb-1">Thu nhập tháng {new Date().getMonth()+1}</p>
                           <h3 className="text-2xl sm:text-4xl font-black">{totalMonthlyIncome.toLocaleString('vi-VN')} <span className="text-lg sm:text-xl">đ</span></h3>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex flex-col">
                              <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Học viên hoàn thành</span>
                              <span className="text-2xl font-black text-emerald-400">{completed} <span className="text-xs text-slate-400">người</span></span>
                           </div>
                           <div className="w-[1px] h-10 bg-white/10" />
                           <div className="flex flex-col">
                              <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Buổi dạy đã xong</span>
                              <span className="text-2xl font-black text-blue-400">{totalDone} <span className="text-xs text-slate-400">buổi</span></span>
                           </div>
                        </div>
                     </div>
                     <button onClick={() => navigate('/teacher/finance')} 
                        className="bg-white/10 hover:bg-white/20 border border-white/10 px-8 py-4 rounded-3xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2 group">
                        Chi tiết thu nhập <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                     </button>
                  </div>
               </div>

               {/* Rating & Identity Card */}
               <div className="md:col-span-2 xl:col-span-1 bg-white rounded-[40px] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-amber-300" />
                  <div className={`w-20 h-20 ${(currentTeacher?.color || 'bg-blue-600')} rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-lg mb-4`}>
                    {teacherName.substring(0, 2).toUpperCase()}
                  </div>
                  <h4 className="text-lg font-black text-gray-800 mb-1">{teacherName}</h4>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Giảng viên Chuyên môn</p>
                  
                  {/* STAR RATING DISPLAY */}
                  <div className="bg-orange-50 px-6 py-4 rounded-[32px] border border-orange-100 w-full">
                     <div className="flex items-center justify-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(star => (
                           <Star key={star} size={20} className={star <= Math.round(teacherRating.avg) ? "text-orange-500 fill-orange-500" : "text-gray-200"} />
                        ))}
                     </div>
                     <p className="text-2xl font-black text-orange-600 leading-none">{teacherRating.avg || '—'}</p>
                     <p className="text-xs font-black text-orange-400 uppercase tracking-widest mt-1">{teacherRating.count} lượt đánh giá từ học viên</p>
                  </div>
               </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 min-[576px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: Users, label: 'Đang dạy', value: students.length, sub: 'học viên', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
                { icon: BookOpen, label: 'Lộ trình', value: `${totalDone}/${totalSess}`, sub: 'tổng số buổi', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50' },
                { icon: Award, label: 'Điểm TB', value: avgGrade, sub: '/ 10 điểm', color: 'from-amber-500 to-orange-500', bg: 'bg-orange-50' },
                { icon: Star, label: 'Uy tín', value: teacherRating.avg, sub: `${teacherRating.count} đánh giá`, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
              ].map(({ icon: Icon, label, value, sub, color, bg }) => (
                <div key={label} className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all group overflow-hidden relative min-w-0">
                  <div className={`absolute -right-4 -bottom-4 w-20 h-20 ${bg} rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700`} />
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg group-hover:rotate-12 transition-transform`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">{label}</p>
                  <p className="text-2xl sm:text-3xl font-black text-gray-800 relative z-10 truncate">{value}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1 relative z-10">{sub}</p>
                </div>
              ))}
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/20">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-yellow-300" />
                <h3 className="font-black text-base">Công việc cần xử lý ngay</h3>
              </div>
              <div className="grid grid-cols-1 min-[576px]:grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    icon: UserCheck,
                    label: 'Điểm danh',
                    sub: `${mySchedules.filter(s => s.status === 'scheduled' && new Date(s.date).toDateString() === new Date().toDateString()).length} buổi hôm nay`,
                    color: 'bg-green-500/20 hover:bg-green-500/30 border-green-400/30',
                    action: () => navigate('/teacher#students'),
                  },
                  {
                    icon: Clipboard,
                    label: 'Chấm điểm',
                    sub: `${students.filter(s => !s.lastGrade || s.lastGrade === 0).length} HV chưa có điểm`,
                    color: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-400/30',
                    action: () => navigate('/teacher#students'),
                  },
                  {
                    icon: MessageSquare,
                    label: 'Tin nhắn',
                    sub: `${myNotifs} chưa đọc`,
                    color: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/30',
                    action: () => navigate('/teacher/inbox'),
                  },
                  {
                    icon: Calendar,
                    label: 'Xếp lịch',
                    sub: 'Thêm buổi dạy mới',
                    color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/30',
                    action: () => { navigate('/teacher#schedule'); },
                  },
                ].map(({ icon: Icon, label, sub, color, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`${color} border rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <Icon size={22} className="text-white mb-2" />
                    <p className="font-bold text-sm text-white">{label}</p>
                    <p className="text-xs text-white/60 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Student cards (compact) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <GraduationCap size={18} className="text-blue-600" /> Học viên được phân công
                  </h3>
                </div>
                {students.map(s => {
                  const done = s.totalSessions - s.remainingSessions;
                  const pct = Math.round((done / s.totalSessions) * 100);
                  return (
                    <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition group">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-white shadow-sm">
                        <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.course}</p>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-blue-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-gray-800">{pct}%</p>
                        <p className="text-xs text-gray-400">{done}/{s.totalSessions}</p>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => navigate('/teacher#students')}
                  className="w-full text-sm font-bold text-blue-600 bg-blue-50 py-3 rounded-xl hover:bg-blue-100 transition flex items-center justify-center gap-1">
                  Quản lý chi tiết <ChevronRight size={14} />
                </button>
              </div>

              {/* Right sidebar */}
              <div className="lg:col-span-5 space-y-6">
                {/* Rating summary */}
                <TeacherRatingDisplay rating={teacherRating} RATING_CRITERIA={RATING_CRITERIA} />

                {/* Upcoming schedule */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                      <Calendar size={14} className="text-blue-500" /> Lịch dạy sắp tới
                    </h4>
                    <button onClick={() => navigate('/teacher#schedule')} className="text-xs text-blue-600 font-bold hover:underline">
                      Xem tất cả →
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {mySchedules.filter(s => s.status === 'scheduled').slice(0, 3).length === 0 && (
                      <p className="px-5 py-4 text-xs text-gray-400 text-center">Chưa có lịch dạy.</p>
                    )}
                    {mySchedules.filter(s => s.status === 'scheduled').slice(0, 3).map(s => (
                      <div key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-blue-50/30 transition group">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex flex-col items-center justify-center text-blue-600 flex-shrink-0">
                          <span className="text-sm font-black">{new Date(s.date).getDate()}</span>
                          <span className="text-[8px] font-bold opacity-60">T{new Date(s.date).getMonth()+1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{s.topic}</p>
                          <p className="text-xs text-gray-400">{s.startTime} • {s.studentName}</p>
                        </div>
                        <span className="text-xs text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-lg flex-shrink-0">{s.startTime}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity summary */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-blue-400" />
                    <h4 className="font-bold text-sm">Tóm tắt hoạt động</h4>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Tổng buổi dạy đã hoàn thành', value: mySchedules.filter(s => s.status === 'completed').length, color: 'text-green-400' },
                      { label: 'Đánh giá trung bình', value: `${teacherRating?.avg || '—'} ⭐`, color: 'text-yellow-400' },
                      { label: 'HV đã hoàn thành KH', value: completed, color: 'text-blue-400' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">{item.label}</span>
                        <span className={`font-black ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showScheduleModal && (
        <TeacherLazyScheduleModal
          students={students}
          allSchedules={schedules}
          schedule={editingSchedule}
          onClose={() => setShowScheduleModal(false)}
          onSubmit={handleScheduleSubmit}
        />
      )}
      {/* ─ ACTIVE ATTENDANCE MODAL ─ */}
      {pendingAttendanceSchedule && (
        <div className="fixed inset-0 bg-slate-900/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-4 border-blue-500/20">
            <div className="bg-blue-600 p-6 text-white flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                <Clock size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-lg">Xác nhận hoàn thành buổi dạy</h3>
                <p className="text-blue-100 text-sm mt-1">Đã quá giờ kết thúc, vui lòng điểm danh.</p>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="grid gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 text-sm font-semibold">Học viên</span>
                    <span className="font-bold text-slate-800 text-base">{pendingAttendanceSchedule.studentName}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 text-sm font-semibold">Môn học</span>
                    <span className="font-bold text-blue-700">{pendingAttendanceSchedule.course}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 text-sm font-semibold">Thời gian</span>
                    <span className="font-black text-slate-800 tracking-wide bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                      {pendingAttendanceSchedule.startTime} - {pendingAttendanceSchedule.endTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <button
                  onClick={handleActiveAttend}
                  className="w-full py-4 text-white font-black bg-blue-600 rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-lg hover:-translate-y-0.5"
                >
                  <CheckCircle size={22} /> Điểm danh ngay
                </button>
                
                <div className="border border-red-100 bg-red-50/50 rounded-2xl p-4">
                  <label className="text-xs font-black text-red-800 uppercase tracking-widest block mb-2">Học viên không học?</label>
                  <textarea
                    rows={2}
                    value={noShowReason}
                    onChange={e => setNoShowReason(e.target.value)}
                    placeholder="Bắt buộc nhập lý do (VD: HS xin nghỉ, GV bận đột xuất...)"
                    className="w-full border-2 border-red-200 focus:border-red-400 rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white mb-3"
                  />
                  <button
                    onClick={handleActiveNoShow}
                    disabled={!noShowReason.trim()}
                    className="w-full py-3 text-red-600 font-bold bg-white border-2 border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Báo hủy buổi học
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;
