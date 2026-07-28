import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CmsSelect from '../ui/CmsSelect';
import {
  Calendar, Video, CheckCircle, Save, MessageSquare, FileText,
  GraduationCap, TrendingUp, Clock, Star, Link2, Upload,
  ChevronRight, BookOpen, Award, Zap, BarChart3, Users, Eye, X, XCircle,
  Search, Download, AlertCircle, Clipboard, Send, UserCheck, Check,
  Activity, Trash2, Ban, PlayCircle, Phone, Mail, Edit3, Shield,
  Plus, Loader2,
} from 'lucide-react';
import api, { buildMediaDownloadUrl, resolveMediaUrl } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useModal } from '../../utils/Modal.jsx';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import { getGradeBadgeClasses, getGradeLabel } from '../../utils/gradeColors';
import { isScheduleOngoingNow } from '../../utils/scheduleTime';
import { showGlossyAlert } from './TeacherShared';

const getDisplayName = (person) => {
  if (!person) return 'Không rõ';
  const name = person.name || '';
  if (name && !/^\d{5,}$/.test(name)) return name;
  return person.email || person.phone || person.zalo || `HV-${String(person.id || person._id || '').slice(-4)}`;
};

/** Chỉ đánh trượt khi học viên đã được mở khóa phòng thi (chưa mở / đã trượt → không bấm lại). */
const canTeacherFailStudentExam = (student) => Boolean(student?.studentExamUnlocked);

const FailExamButton = ({ student, onLockExam, compact = false }) => {
  const { showModal } = useModal();
  const canFail = canTeacherFailStudentExam(student);
  const hint = canFail
    ? 'Đánh trượt học viên đang được mở khóa phòng thi'
    : 'Chưa mở khóa phòng thi hoặc đã bị đánh trượt';

  const openConfirm = () => {
    if (!canFail) return;
    showModal({
      title: 'Xác nhận ĐÁNH TRƯỢT',
      content: `Hành động này sẽ KHOÁ TRUY CẬP PHÒNG THI của ${getDisplayName(student)} ngay lập tức.`,
      type: 'warning',
      confirmText: 'ĐÁNH TRƯỢT NGAY',
      onConfirm: () => onLockExam(student),
    });
  };

  if (compact) {
    return (
      <button
        type="button"
        disabled={!canFail}
        title={hint}
        aria-label="Đánh trượt"
        onClick={openConfirm}
        className={`inline-flex justify-center items-center w-8 h-8 rounded-lg transition-all shrink-0 ${
          canFail
            ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
        }`}
      >
        <XCircle size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!canFail}
      title={hint}
      onClick={openConfirm}
      className={`flex flex-1 min-[360px]:flex-initial justify-center items-center gap-2 text-xs font-black px-4 py-3 sm:px-5 rounded-2xl transition-all uppercase tracking-widest ${
        canFail
          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/40'
          : 'bg-slate-100 text-slate-400 border-2 border-slate-200 cursor-not-allowed opacity-60'
      }`}
    >
      <XCircle size={16} /> ĐÁNH TRƯỢT
    </button>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

export const StudentCard = ({ student, onAttendance, onUpdateLink, onSaveGrade, onUpdateNotes, onLockExam, isDetailed, attendanceGate }) => {
  const navigate = useNavigate();
  const { showModal } = useModal();
  const { onDataRefresh, socket } = useSocket();
  const [linkInput, setLinkInput] = useState(student.linkHoc);
  const [gradeInput, setGradeInput] = useState(student.avgGrade ?? student.lastGrade ?? '');
  const [notesInput, setNotesInput] = useState(student.notes || '');
  const [activePanel, setActivePanel] = useState('progress');
  const [linkSaved, setLinkSaved] = useState(false);
  const [gradeSaved, setGradeSaved] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attForm, setAttForm] = useState({ note: 'Đã điểm danh hoàn thành buổi học', grade: student.avgGrade ?? student.lastGrade ?? 0 });

  useEffect(() => {
    setGradeInput(student.avgGrade ?? student.lastGrade ?? '');
    setLinkInput(student.linkHoc);
    setNotesInput(student.notes || '');
    setAttForm((prev) => ({
      ...prev,
      grade: student.avgGrade ?? student.lastGrade ?? 0,
    }));
  }, [student._enrollmentKey, student.course, student.avgGrade, student.lastGrade, student.linkHoc, student.notes]);

  // ASSIGNMENTS STATE
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [showAddAssign, setShowAddAssign] = useState(false);
  const [newAssign, setNewAssign] = useState({ title: '', deadline: '', fileUrl: '', description: '' });
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [editingAssign, setEditingAssign] = useState({ title: '', deadline: '', fileUrl: '', description: '' });
  const [gradingInputs, setGradingInputs] = useState({});

  const handleGradeSubmit = async (submissionId) => {
    const gradeValue = gradingInputs[submissionId];
    if (gradeValue === undefined || gradeValue === '' || isNaN(gradeValue) || gradeValue < 0 || gradeValue > 10) {
      showGlossyAlert('Vui lòng nhập điểm hợp lệ (0-10)');
      return;
    }
    try {
      const wasGraded = (courseAssignments || []).some((a) =>
        (a.submissions || []).some((s) => String(s._id) === String(submissionId) && s.status === 'graded')
      );
      const res = await api.assignments.grade(submissionId, {
        grade: Number(gradeValue),
        teacherFeedback: wasGraded ? 'Giảng viên đã sửa điểm' : 'Đã chấm điểm trực tiếp',
      });
      if (res.success) {
        if (typeof fetchStudentAssignments === 'function') fetchStudentAssignments();
        showGlossyAlert(wasGraded ? 'Đã cập nhật điểm!' : 'Chấm điểm thành công!');
      } else {
        showGlossyAlert(res.message || 'Lỗi chấm bài');
      }
    } catch(e) {
      showGlossyAlert('Lỗi mạng khi lưu điểm');
    }
  };

  const done = student.completedSessions != null ? student.completedSessions : (student.totalSessions - student.remainingSessions);
  const progressPct = Math.round((done / student.totalSessions) * 100);
  const isCompleted = student.remainingSessions === 0;

  const todayStr = new Date().toLocaleDateString('vi-VN');
  const hasAttendedToday = (student.grades || []).some(g => g.date === todayStr);

  const [attendanceTick, setAttendanceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setAttendanceTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const lastAttendanceAt = student.last_attendance_at ? new Date(student.last_attendance_at) : null;
  const cooldownHours = useMemo(() => {
    if (lastAttendanceAt) {
      const diffMs = Date.now() - lastAttendanceAt.getTime();
      if (diffMs >= 12 * 60 * 60 * 1000) return 0;
      return parseFloat((12 - diffMs / (1000 * 60 * 60)).toFixed(1));
    }
    return student.remaining_cooldown_hours || 0;
  }, [lastAttendanceAt, student.remaining_cooldown_hours, attendanceTick]);

  const canCheckIn = cooldownHours > 0
    ? false
    : (student.can_check_in !== undefined ? student.can_check_in : !hasAttendedToday);

  // ⏰ GIỚI HẠN HỦY ĐIỂM DANH 1 TIẾNG
  const minsElapsedSinceAttend = lastAttendanceAt ? Math.floor((Date.now() - lastAttendanceAt.getTime()) / 60000) : null;
  const canCancelAttendance = hasAttendedToday && (minsElapsedSinceAttend === null || minsElapsedSinceAttend < 60);
  const cancelTimeLeft = (minsElapsedSinceAttend !== null && minsElapsedSinceAttend < 60)
    ? (60 - minsElapsedSinceAttend)
    : 0;

  const fetchStudentAssignments = useCallback(async () => {
    setLoadingAssign(true);
    try {
      const sid = student.id || student._id;
      const course = String(student.course || '').trim();
      const res = await api.assignments.getByStudentAndCourse(sid, course);
      if (res.success) {
        const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const want = norm(course);
        setCourseAssignments(
          (res.data || [])
            .filter((a) => !want || norm(a.courseId) === want)
            .map((a) => ({
              ...a,
              submissions: a.mySubmission ? [a.mySubmission] : [],
            }))
        );
      }
    } catch (e) { void 0 }
    setLoadingAssign(false);
  }, [student.id, student._id, student.course]);

  useEffect(() => {
    if (activePanel === 'assignments') {
      fetchStudentAssignments();
    }
  }, [activePanel, student.id, student.course, fetchStudentAssignments]);

  /** Realtime: học viên nộp bài → cập nhật trạng thái ngay */
  useEffect(() => {
    if (!socket) return;
    const sid = String(student.id || student._id);

    const onSubmissionForStudent = (submission) => {
      const subStudent = String(submission?.studentId?._id || submission?.studentId || '');
      if (subStudent && subStudent !== sid) return;
      fetchStudentAssignments();
    };

    const shouldRefresh = (data) => {
      if (!data || typeof data !== 'object') return false;
      if (data.type === 'submission' || data.type === 'assignment') return true;
      const ev = data.eventName;
      if (typeof ev === 'string' && ev.startsWith('submission:')) return true;
      if (data.assignmentId != null && data.studentId != null) return true;
      return false;
    };

    socket.on('submission:new', onSubmissionForStudent);
    socket.on('submission:graded', onSubmissionForStudent);

    const unsubRefresh = onDataRefresh((data) => {
      if (shouldRefresh(data)) fetchStudentAssignments();
    });

    return () => {
      socket.off('submission:new', onSubmissionForStudent);
      socket.off('submission:graded', onSubmissionForStudent);
      unsubRefresh?.();
    };
  }, [socket, student.id, student._id, onDataRefresh, fetchStudentAssignments]);

  const handleCreateAssign = async () => {
    if (!newAssign.title || !newAssign.deadline) return;
    try {
      const res = await api.assignments.create({
        ...newAssign,
        courseId: student.course,
        teacherId: student.teacherId || 'current',
        studentId: student.id || student._id,
      });
      if (res.success) {
        setShowAddAssign(false);
        setNewAssign({ title: '', deadline: '', fileUrl: '', description: '' });
        fetchStudentAssignments();
      }
    } catch (e) { void 0 }
  };

  const isAssignmentGraded = (assign) => {
    const sub = assign.submissions?.find(s => String(s.studentId?._id || s.studentId) === String(student.id || student._id))
      || assign.mySubmission;
    return sub?.status === 'graded';
  };

  const handleEditAssign = (assign) => {
    if (isAssignmentGraded(assign)) {
      showGlossyAlert('Bài đã chấm điểm — không thể sửa. Chỉ có thể chỉnh sửa điểm.');
      return;
    }
    setEditingAssignmentId(assign._id);
    setEditingAssign({
      title: assign.title,
      deadline: assign.deadline ? new Date(assign.deadline).toISOString().slice(0,16) : '',
      fileUrl: assign.fileUrl || '',
      description: assign.description || ''
    });
  };

  const handleUpdateAssign = async () => {
    if (!editingAssign.title || !editingAssign.deadline) return;
    try {
      const res = await api.assignments.update(editingAssignmentId, editingAssign);
      if (res.success) {
        setEditingAssignmentId(null);
        fetchStudentAssignments();
      }
    } catch (e) { void 0 }
  };

  const handleDeleteAssign = async (id) => {
    const assign = courseAssignments.find(a => String(a._id) === String(id));
    if (assign && isAssignmentGraded(assign)) {
      showGlossyAlert('Bài đã chấm điểm — không thể xóa.');
      return;
    }
    if (!window.confirm("Bạn có chắc muốn xóa bài tập này?")) return;
    try {
      const res = await api.assignments.delete(id);
      if (res.success) {
        fetchStudentAssignments();
      }
    } catch (e) { void 0 }
  };

  const handleAssignmentUpload = async (e, type = 'new') => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showGlossyAlert("File đính kèm quá lớn. Xin vui lòng giới hạn dưới 3MB!");
      e.target.value = '';
      return;
    }
    try {
      const res = await api.assignments.uploadFile(file);
      if (res.success) {
        if (type === 'new') setNewAssign(prev => ({...prev, fileUrl: res.fileUrl}));
        else setEditingAssign(prev => ({...prev, fileUrl: res.fileUrl}));
      } else {
        showGlossyAlert(res.message || "Lỗi khi tải file lên");
      }
    } catch(err) {
      showGlossyAlert("Lỗi mạng khi tải file");
    }
    e.target.value = '';
  };

  const handleUndoAttendance = async () => {
    const sid = student._id || student.id;

    // FE guard: kiểm tra trước khi call API
    if (minsElapsedSinceAttend !== null && minsElapsedSinceAttend >= 60) {
      showModal({ title: 'Không thể hủy', content: `Đã quá 1 tiếng kể từ lúc điểm danh (${minsElapsedSinceAttend} phút). Không thể hủy nữa.`, type: 'error' });
      return;
    }

    showModal({
      title: 'Hủy điểm danh hôm nay',
      content: `Xác nhận hủy điểm danh hôm nay của "${student.name || sid}"? Số buổi đã học sẽ giảm 1.${cancelTimeLeft > 0 ? `\n⏰ Còn ${cancelTimeLeft} phút để hủy.` : ''}`,
      type: 'warning',
      confirmText: 'XÁC NHẬN HỦY',
      onConfirm: async () => {
        try {
          const res = await api.students.resetTodayAttendance(sid);
          if (res.success) {
            window.location.reload();
          } else if (res.code === 'CANCEL_TIMEOUT') {
            showModal({ title: '⏰ Hết thời gian hủy', content: res.message, type: 'error' });
          } else {
            showModal({ title: 'Lỗi', content: res.message || 'Lỗi khi hủy điểm danh', type: 'error' });
          }
        } catch (e) {
          showModal({ title: 'Lỗi', content: 'Lỗi kết nối server', type: 'error' });
        }
      }
    });
  };

  const handleLinkSave = () => {
    onUpdateLink(student._id || student.id, linkInput);
    setLinkSaved(true); setTimeout(() => setLinkSaved(false), 2000);
  };

  const handleGradeSave = () => {
    onSaveGrade(student._id || student.id, Number(gradeInput), student.course);
    setGradeSaved(true); setTimeout(() => setGradeSaved(false), 2000);
  };

  const gradeValue = Number(gradeInput) || 0;
  const gradeLetter = gradeValue >= 8.5 ? 'A' : gradeValue >= 7 ? 'B' : gradeValue >= 5 ? 'C' : 'D';

  const panels = [
    { key: 'progress', icon: Activity, label: 'Tiến độ' },
    { key: 'assignments', icon: BookOpen, label: 'Bài tập' },
    { key: 'link', icon: Video, label: 'Link học' },
    { key: 'grade', icon: Award, label: 'Đánh giá' },
  ];

  if (isDetailed) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-[40px] shadow-lg sm:shadow-2xl shadow-blue-900/5 border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="bg-slate-50/80 px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 border-b border-slate-100">
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl sm:rounded-[28px] p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-6 min-w-0">
            <div className="w-10 h-10 sm:w-20 sm:h-20 rounded-full sm:rounded-[28px] overflow-hidden shadow-sm border border-slate-200 bg-white shrink-0">
              <img
                src={resolveAvatarUrl({ avatar: student.avatarUrl || student.photo, role: 'student' })}
                alt={getDisplayName(student)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-2xl font-bold tracking-tight text-slate-800 break-words line-clamp-2 leading-snug">
                    {getDisplayName(student)}
                  </h2>
                  <p className="text-slate-500 text-[11px] sm:text-sm font-semibold mt-0.5 break-words line-clamp-2 leading-snug">
                    {student.course}{student.age ? ` · ${student.age} tuổi` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`hidden min-[380px]:inline-flex px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                    isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {isCompleted ? 'Hoàn thành' : 'Đang học'}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/teacher/inbox', {
                      state: { selectUserId: String(student.id || student._id) },
                    })}
                    className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-all border border-blue-100"
                    title="Nhắn tin nội bộ"
                    aria-label="Nhắn tin nội bộ"
                  >
                    <MessageSquare size={14} />
                  </button>
                  {onLockExam && (
                    <FailExamButton student={student} onLockExam={onLockExam} compact />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={`min-[380px]:hidden px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                  isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {isCompleted ? 'Hoàn thành' : 'Đang học'}
                </span>
                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                  {student.learningMode || 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center mb-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-slate-400">
              <span>Tiến độ khóa học</span>
              <span className="text-slate-700 tabular-nums">{done}/{student.totalSessions} buổi ({progressPct}%)</span>
            </div>
            <div className="h-1.5 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
        </div>

        {/* Tabs — 4 cột, icon + nhãn rõ ràng */}
        <div className="grid grid-cols-4 w-full bg-white border-b border-slate-100">
          {panels.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePanel(key)}
              title={label}
              aria-label={label}
              aria-current={activePanel === key ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 sm:py-3.5 text-[9px] sm:text-[11px] font-semibold tracking-wide transition-all min-w-0 ${
                activePanel === key ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full leading-tight">{label}</span>
              {activePanel === key && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Action Content */}
        <div className="p-3 sm:p-6 md:p-10 space-y-4 sm:space-y-8">
           {activePanel === 'progress' && (
              <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-500">
                 {/* Stat Boxes — 3 cột trên mobile */}
                 <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl sm:rounded-2xl text-center flex flex-col items-center justify-center p-3 sm:p-6">
                       <p className="text-[9px] sm:text-xs font-bold text-blue-400 uppercase tracking-wide mb-1">Đã học</p>
                       <h4 className="text-xl sm:text-4xl font-extrabold text-blue-600 leading-none tabular-nums">{done}</h4>
                       <p className="text-[9px] sm:text-xs font-semibold text-blue-300 mt-1 uppercase">buổi</p>
                    </div>
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl sm:rounded-2xl text-center flex flex-col items-center justify-center p-3 sm:p-6">
                       <p className="text-[9px] sm:text-xs font-bold uppercase tracking-wide mb-1 text-amber-400">Còn lại</p>
                       <h4 className="text-xl sm:text-4xl font-extrabold leading-none tabular-nums text-amber-600">{student.remainingSessions}</h4>
                       <p className="text-[9px] sm:text-xs font-semibold mt-1 uppercase text-amber-300">buổi</p>
                    </div>
                    <div className="bg-purple-50/60 border border-purple-100 rounded-xl sm:rounded-2xl text-center flex flex-col items-center justify-center p-3 sm:p-6">
                       <p className="text-[9px] sm:text-xs font-bold text-purple-400 uppercase tracking-wide mb-1">Điểm TB</p>
                       <div className="flex items-baseline justify-center gap-0.5">
                          <h4 className="text-xl sm:text-4xl font-extrabold text-purple-600 leading-none tabular-nums">{student.lastGrade || 0}</h4>
                          <span className="text-[10px] sm:text-lg font-bold text-purple-300">/10</span>
                       </div>
                       <p className="text-[9px] sm:text-xs font-semibold text-purple-300 mt-1 uppercase hidden sm:block">Đánh giá chung</p>
                    </div>
                 </div>

                 {/* Actions outlined gọn */}
                 <div className="grid grid-cols-2 gap-2 mt-4 sm:gap-4">
                   {attendanceGate?.status === 'not_yet' ? (
                     <div className="flex items-center justify-center h-9 sm:h-auto sm:py-5 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide border border-dashed border-slate-300 rounded-xl bg-slate-50">
                        Chưa đến giờ dạy
                     </div>
                   ) : (
                     <button 
                       type="button"
                       onClick={() => {
                         if (!canCheckIn && !isCompleted) return;
                         const tGrade = (student.grades || []).find(g => g.date === todayStr);
                         setAttForm({ note: tGrade?.note || 'Đã điểm danh hoàn thành buổi học', grade: tGrade?.grade ?? (student.lastGrade || 0) });
                         setShowAttendanceModal(true);
                       }} 
                       disabled={isCompleted || !canCheckIn || attendanceGate?.status === 'no_schedule'}
                       title={
                         isCompleted ? 'Khóa học đã hoàn thành' :
                         attendanceGate?.status === 'no_schedule' ? 'Hôm nay chưa có lịch dạy' :
                         !canCheckIn ? `Đã điểm danh. Mở khóa sau ${cooldownHours} tiếng.` : 
                         'Bấm để điểm danh buổi học hôm nay'
                       }
                       className={`h-10 sm:h-auto sm:py-5 rounded-xl font-medium text-[10px] sm:text-sm uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                         isCompleted 
                           ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                         : attendanceGate?.status === 'no_schedule'
                           ? 'bg-slate-100 text-slate-700 cursor-not-allowed'
                         : !canCheckIn
                           ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                           : 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.98]'
                       }`}
                     >
                       <CheckCircle size={14} className="shrink-0" aria-hidden="true" />
                       <span className="truncate">
                         {isCompleted 
                           ? 'Hoàn thành'
                           : attendanceGate?.status === 'no_schedule'
                             ? 'Chưa có lịch'
                             : !canCheckIn
                               ? (cooldownHours > 0 ? `Chờ ${cooldownHours}h` : 'Đã điểm danh')
                               : 'Điểm danh'}
                       </span>
                     </button>
                   )}

                   <button
                     type="button"
                     onClick={() => { if (canCancelAttendance) handleUndoAttendance(); }}
                     disabled={!canCancelAttendance || isCompleted}
                     title={
                       !hasAttendedToday ? 'Chưa điểm danh hôm nay'
                       : !canCancelAttendance ? `Đã quá 1 tiếng, không thể hủy (${minsElapsedSinceAttend} phút trước)`
                       : `Còn ${cancelTimeLeft} phút để hủy. Nhấn để hủy điểm danh hôm nay`
                     }
                     className={`h-10 sm:h-auto sm:py-5 rounded-xl font-medium text-[10px] sm:text-sm uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                       canCancelAttendance && !isCompleted
                         ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.98]'
                         : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                     }`}
                   >
                     <X size={14} className="shrink-0" aria-hidden="true" />
                     <span className="truncate">
                       {canCancelAttendance && cancelTimeLeft > 0
                         ? `Hủy (${cancelTimeLeft}p)`
                         : 'Hủy điểm danh'}
                     </span>
                   </button>
                 </div>

                 {/* Notes */}
                 <div className="mt-4 sm:mt-0">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                       <FileText size={12} aria-hidden="true" /> Ghi chú học viên
                    </label>
                    <div className="border border-slate-200 rounded-xl p-3 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <textarea 
                       value={notesInput} onChange={e => setNotesInput(e.target.value)}
                       onBlur={() => onUpdateNotes((student._id || student.id), notesInput)}
                       placeholder="Nhận xét cá nhân, ghi nhận đặc biệt về học viên này..."
                       className="w-full bg-transparent border-0 rounded-none p-0 text-xs sm:text-sm font-medium outline-none resize-none"
                       rows={3}
                    />
                    <span className="text-[11px] text-slate-400 ml-auto block mt-2">Tự động lưu khi rời ô nhập</span>
                    </div>
                 </div>
              </div>
           )}

           {activePanel === 'link' && (
              <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
                 <div className="bg-indigo-50 border border-indigo-100 rounded-[40px] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-200/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="flex items-center gap-4 mb-6">
                       <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                          <Video size={24} />
                       </div>
                       <div>
                          <h3 className="text-xl font-black text-indigo-900">Link học trực tuyến</h3>
                          <p className="text-xs font-bold text-indigo-400">Tự động đồng bộ hóa với Dashboard của học viên</p>
                       </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                       <div className="flex-1 relative">
                          <input 
                            type="text" value={linkInput} onChange={e => setLinkInput(e.target.value)}
                            className="w-full bg-white border-2 border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-700 focus:border-indigo-500 outline-none transition-all shadow-sm"
                            placeholder="Nhập link Google Meet / Zoom..."
                          />
                       </div>
                       <button 
                         onClick={handleLinkSave}
                         className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                            linkSaved ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'
                         }`}
                       >
                         {linkSaved ? 'ĐÃ LƯU ✓' : 'CẬP NHẬT'}
                       </button>
                    </div>
                 </div>
              </div>
           )}

            {activePanel === 'assignments' && (
              <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-right-10 duration-500">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-600 truncate min-w-0">
                    Danh sách bài tập
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddAssign(!showAddAssign)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1"
                  >
                    {showAddAssign ? <X size={14} /> : <Plus size={14} />}
                    {showAddAssign ? 'Hủy' : 'Giao bài'}
                  </button>
                </div>

                {showAddAssign && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-6 space-y-4 shadow-inner animate-in zoom-in-95">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs cms-min-text-xs font-black text-indigo-400 uppercase mb-1 block">Tiêu đề bài tập</label>
                        <input type="text" value={newAssign.title} onChange={e => setNewAssign({...newAssign, title: e.target.value})}
                          className="w-full bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-900 focus:border-indigo-500 outline-none" placeholder="VD: Homework Buổi 1" />
                      </div>
                      <div>
                        <label className="text-xs cms-min-text-xs font-black text-indigo-400 uppercase mb-1 block">Hạn nộp (Deadline)</label>
                        <input type="datetime-local" value={newAssign.deadline} onChange={e => setNewAssign({...newAssign, deadline: e.target.value})}
                          className="w-full bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-900 focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs cms-min-text-xs font-black text-indigo-400 uppercase mb-1 block">Tài liệu đính kèm (Link Drive/File hoặc Tải lên)</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={newAssign.fileUrl} onChange={e => setNewAssign({...newAssign, fileUrl: e.target.value})}
                            className="flex-1 bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-900 focus:border-indigo-500 outline-none" placeholder="Dán link Drive/File..." />
                          <label className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-3 rounded-2xl cursor-pointer transition flex items-center justify-center" title="Tải file lên (Tối đa 3MB)">
                            <Upload size={18} />
                            <input type="file" className="hidden" onChange={(e) => handleAssignmentUpload(e, 'new')} accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" />
                          </label>
                        </div>
                        <p className="text-xs cms-min-text-xs text-gray-400 font-medium italic mt-1.5 ml-1">* Cho phép: PDF, Word, Excel, ZIP, RAR. Tối đa 3MB.</p>
                      </div>
                      <button onClick={handleCreateAssign} className="md:col-span-2 bg-red-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-100">GỬI BÀI TẬP CHO HỌC VIÊN</button>
                    </div>
                  </div>
                )}

                {loadingAssign ? (
                   <div className="py-20 text-center animate-pulse text-xs font-black text-slate-300 uppercase tracking-[4px]">Đang tải dữ liệu...</div>
                ) : (
                  <div className="space-y-4">
                    {courseAssignments.map(assign => {
                      const submission = assign.submissions?.find(s => String(s.studentId?._id || s.studentId) === String(student.id || student._id));
                      const isSubmitted = !!submission;
                      const isGraded = submission?.status === 'graded';
                      
                      return editingAssignmentId === assign._id ? (
                        <div key={`edit-${assign._id}`} className="bg-indigo-50 border border-indigo-200 rounded-[32px] p-6 space-y-4 shadow-inner animate-in zoom-in-95 relative z-10 transition-all">
                          <div className="flex items-center justify-between">
                             <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">Chỉnh sửa Bài tập</h4>
                             <button onClick={() => setEditingAssignmentId(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16}/></button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs cms-min-text-xs font-black text-indigo-400 uppercase mb-1 block">Tiêu đề bài tập</label>
                              <input type="text" value={editingAssign.title} onChange={e => setEditingAssign({...editingAssign, title: e.target.value})}
                                className="w-full bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-900 focus:border-indigo-500 outline-none"/>
                            </div>
                            <div>
                              <label className="text-xs cms-min-text-xs font-black text-indigo-400 uppercase mb-1 block">Hạn nộp (Deadline)</label>
                              <input type="datetime-local" value={editingAssign.deadline} onChange={e => setEditingAssign({...editingAssign, deadline: e.target.value})}
                                className="w-full bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-900 focus:border-indigo-500 outline-none text-center" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-xs cms-min-text-xs font-black text-indigo-400 uppercase mb-1 block">Tài liệu đính kèm (Link Drive/File hoặc Tải lên)</label>
                              <div className="flex items-center gap-2">
                                <input type="text" value={editingAssign.fileUrl} onChange={e => setEditingAssign({...editingAssign, fileUrl: e.target.value})}
                                  className="flex-1 bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-900 focus:border-indigo-500 outline-none" placeholder="Dán link Drive/File..." />
                                <label className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-3 rounded-2xl cursor-pointer transition flex items-center justify-center" title="Tải file lên (Tối đa 3MB)">
                                  <Upload size={18} />
                                  <input type="file" className="hidden" onChange={(e) => handleAssignmentUpload(e, 'edit')} accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" />
                                </label>
                              </div>
                              <p className="text-xs cms-min-text-xs text-gray-400 font-medium italic mt-1.5 ml-1">* Cho phép: PDF, Word, Excel, ZIP, RAR. Tối đa 3MB.</p>
                            </div>
                            <button onClick={handleUpdateAssign} className="md:col-span-2 bg-red-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-100">CẬP NHẬT BÀI TẬP</button>
                          </div>
                        </div>
                      ) : (
                        <div key={assign._id} className="bg-white rounded-2xl sm:rounded-[40px] p-4 sm:p-6 border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all group relative overflow-hidden">
                          {isGraded && <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />}

                          {/* Dòng 1: tên + badge */}
                          <div className="flex items-start justify-between gap-2 relative z-10">
                            <h5 className="line-clamp-2 font-semibold text-slate-800 text-sm sm:text-base leading-snug break-words flex-1 min-w-0">
                              {assign.title}
                            </h5>
                            {isSubmitted ? (
                              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide flex items-center gap-1 border ${isGraded ? getGradeBadgeClasses(submission.grade) : 'bg-blue-100 text-blue-700 border-transparent'}`}>
                                {isGraded ? <Check size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                {isGraded ? `${getGradeLabel(submission.grade)}: ${submission.grade}/10` : 'Đã nộp'}
                              </span>
                            ) : (
                              <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide bg-slate-50 text-slate-400">
                                Chưa nộp
                              </span>
                            )}
                          </div>

                          {/* Dòng 2: hạn + tải bài + sửa/xóa */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 relative z-10">
                            <p className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1">
                              <Clock size={12} className="text-orange-400 shrink-0" />
                              Hạn: {new Date(assign.deadline).toLocaleDateString('vi-VN')}
                            </p>
                            {isSubmitted && submission.submittedFileUrl && (
                              <a
                                href={buildMediaDownloadUrl(submission.submittedFileUrl, submission.submittedFileUrl.split('/').pop())}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] sm:text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                title="Tải bài làm của học viên"
                              >
                                <Download size={12} /> Tải bài làm
                              </a>
                            )}
                            {!isGraded && (
                              <div className="flex items-center gap-1 ml-auto">
                                <button type="button" onClick={() => handleEditAssign(assign)} title="Sửa bài tập" className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50">
                                  <Edit3 size={14} />
                                </button>
                                <button type="button" onClick={() => handleDeleteAssign(assign._id)} title="Xóa bài tập" className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Dòng 3: chấm điểm */}
                          {isSubmitted && (
                            <div className="grid grid-cols-2 gap-2 mt-3 relative z-10">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                placeholder={isGraded ? 'Sửa điểm' : 'Điểm 0-10'}
                                value={gradingInputs[submission._id] ?? (isGraded ? (submission.grade ?? '') : '')}
                                onChange={(e) => setGradingInputs({ ...gradingInputs, [submission._id]: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleGradeSubmit(submission._id)}
                                className={`w-full py-2 rounded-lg text-xs font-medium text-white transition-all ${
                                  isGraded ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                              >
                                {isGraded ? 'Sửa điểm' : 'Lưu điểm'}
                              </button>
                            </div>
                          )}

                          {isGraded && submission.teacherFeedback && (
                            <p className="text-[11px] text-slate-400 italic mt-2 line-clamp-2 relative z-10">*{submission.teacherFeedback}</p>
                          )}
                          {isGraded && !submission.teacherFeedback && (
                            <p className="text-[11px] text-slate-400 italic mt-2 relative z-10">*Giảng viên đã sửa điểm</p>
                          )}

                          {/* Link phụ: xem đề bài */}
                          {assign.fileUrl && (
                            <a
                              href={resolveMediaUrl(assign.fileUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-2.5 text-[11px] sm:text-xs font-medium text-blue-600 hover:text-blue-800 relative z-10"
                            >
                              <Link2 size={12} /> Xem đề bài
                            </a>
                          )}
                        </div>
                      );
                    })}
                    {courseAssignments.length === 0 && !showAddAssign && (
                      <div className="py-24 text-center bg-gray-50/50 rounded-[40px] border-4 border-dashed border-white">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-sm">
                           <BookOpen size={28} />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-10 leading-relaxed">Chưa có bài tập nào được giao<br/>cho lộ trình này</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activePanel === 'grade' && (
              <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-right-10 duration-500">
                 <div className="bg-amber-50 border border-amber-100 rounded-2xl sm:rounded-[40px] p-5 sm:p-10 text-center flex flex-col items-center gap-4 sm:gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                        <Award size={22} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-amber-900">Đánh giá quá trình</h3>
                      <p className="text-[11px] sm:text-xs font-medium text-amber-600 max-w-sm leading-relaxed">
                        Môn {student.course} · Cập nhật điểm trung bình dựa trên bài tập
                      </p>
                    </div>

                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={gradeInput}
                      onChange={e => setGradeInput(e.target.value)}
                      className="w-28 sm:w-32 bg-white border-2 border-amber-200 rounded-xl p-3 text-2xl font-bold text-amber-700 text-center focus:border-amber-500 outline-none"
                    />

                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-full border-4 border-amber-100 flex flex-col items-center justify-center shadow-md">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Xếp loại</span>
                      <span className="text-4xl sm:text-5xl font-bold text-amber-600 leading-none mt-0.5">{gradeLetter}</span>
                    </div>

                    <p className="text-[11px] font-medium text-amber-500 italic">* Điểm số sẽ được hiển thị công khai trên học bạ</p>

                    <button
                      type="button"
                      onClick={handleGradeSave}
                      className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium text-sm transition-all"
                    >
                      {gradeSaved ? 'Đã lưu ✓' : 'Lưu kết quả đánh giá'}
                    </button>
                 </div>
              </div>
           )}
        </div>
        
        {/* Attendance Modal - Added to Detailed View */}
        {showAttendanceModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
              <div className="bg-gradient-to-r from-emerald-600 to-green-500 p-8 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <CheckCircle size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight">Điểm danh & Chấm điểm</h3>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">{student.course}</p>
                  </div>
                </div>
                <button onClick={() => setShowAttendanceModal(false)} className="hover:bg-white/10 p-2 rounded-2xl transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="p-10 space-y-6">
                <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                  <p className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1">Học viên</p>
                  <p className="text-lg font-black text-emerald-600">{getDisplayName(student)}</p>
                  <p className="text-xs font-bold text-emerald-400 mt-2">Tiến độ hiện tại: {done}/{student.totalSessions} buổi</p>
                </div>
                
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Đánh giá buổi học (0-10)</label>
                  <div className="relative">
                    <input 
                      type="number" min="0" max="10" step="0.5" 
                      value={attForm.grade}
                      onChange={(e) => setAttForm({ ...attForm, grade: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white rounded-2xl px-6 py-4 text-3xl font-black text-slate-700 outline-none transition-all"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 text-lg font-black">/ 10</div>
                  </div>
                </div>

                <div>
                   <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Ghi chú nhanh</label>
                   <textarea 
                     value={attForm.note}
                     onChange={(e) => setAttForm({ ...attForm, note: e.target.value })}
                     placeholder="Ví dụ: Học tốt, nộp bài đầy đủ..."
                     className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none transition-all resize-none"
                     rows={3}
                   />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowAttendanceModal(false)}
                    className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => {
                      onAttendance((student._id || student.id), attForm.note, Number(attForm.grade));
                      setShowAttendanceModal(false);
                    }}
                    className="flex-[2] py-4 text-white font-black text-xs uppercase tracking-widest bg-gradient-to-r from-emerald-600 to-green-500 rounded-2xl shadow-lg shadow-green-100 hover:shadow-green-200 transition-all active:scale-95"
                  >
                    Xác nhận Điểm danh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STANDARD COMPACT VIEW (For Dashboard/List)
  return (
    <React.Fragment>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 min-[440px]:flex-row min-[440px]:items-start min-[440px]:justify-between min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shrink-0 bg-white">
              <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-lg tracking-wide truncate">{getDisplayName(student)}</p>
              <p className="text-slate-300 text-xs mt-0.5 flex flex-wrap items-center gap-2">
                {student.course} · {student.age} tuổi
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs cms-min-text-xs font-black tracking-wider uppercase ${student.learningMode === 'ONLINE' ? 'bg-red-500/20 text-blue-300' : 'bg-white/10 text-slate-300'}`}>
                  {student.learningMode === 'ONLINE' ? '🌐 ONLINE' : '🏢 OFFLINE'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full min-[440px]:w-auto min-[440px]:justify-end">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-blue-400'
            }`}>{isCompleted ? '✓ Hoàn thành' : student.status}</span>
            <a href={`https://zalo.me/${student.zalo}`} target="_blank" rel="noreferrer"
              className="inline-flex flex-1 min-[440px]:flex-initial justify-center items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all min-w-0 max-w-full">
              <MessageSquare size={14} className="shrink-0" /> <span className="truncate">{student.zalo}</span>
            </a>
            {onLockExam && (
              <FailExamButton student={student} onLockExam={onLockExam} compact />
            )}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5 text-xs">
            <span className="text-slate-400">Tiến độ khóa học</span>
            <span className="text-white font-bold">{done}/{student.totalSessions} buổi ({progressPct}%)</span>
          </div>
          <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${
              progressPct >= 70 ? 'bg-green-400' : progressPct >= 40 ? 'bg-yellow-400' : 'bg-blue-400'
            }`} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {panels.map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setActivePanel(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all ${
              activePanel === key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Panel Content (Standard View) */}
      <div className="p-6">
        {activePanel === 'progress' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
                <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Đã học</p>
                <p className="text-3xl font-black text-blue-700">{done}</p>
                <p className="text-xs text-blue-400">buổi</p>
              </div>
              <div className={`rounded-2xl p-4 text-center border ${isCompleted ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isCompleted ? 'text-green-500' : 'text-orange-500'}`}>Còn lại</p>
                <p className={`text-3xl font-black ${isCompleted ? 'text-green-700' : 'text-orange-700'}`}>{student.remainingSessions}</p>
                <p className={`text-xs ${isCompleted ? 'text-green-400' : 'text-orange-400'}`}>buổi</p>
              </div>
              <div className="bg-purple-50 rounded-2xl p-4 text-center border border-purple-100">
                <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide mb-1">Điểm TB</p>
                <p className="text-3xl font-black text-purple-700">{student.lastGrade}</p>
                <p className="text-xs text-purple-400">/ 10</p>
              </div>
            </div>
            {/* === 2-COLUMN LAYOUT: Điểm danh | Hủy điểm danh === */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CỘT TRÁI: Nút ĐIỂM DANH */}
              {attendanceGate?.status === 'not_yet' ? (
                <div className="flex items-center justify-center py-4 text-xs font-black text-slate-600 uppercase tracking-widest border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                  Chưa đến giờ
                </div>
              ) : (
                <button onClick={() => {
                    if (!canCheckIn && !isCompleted) return;
                    const tGrade = (student.grades || []).find(g => g.date === todayStr);
                    setAttForm({ note: tGrade?.note || 'Đã điểm danh hoàn thành buổi học', grade: tGrade?.grade ?? (student.lastGrade || 0) });
                    setShowAttendanceModal(true);
                  }} 
                  disabled={isCompleted || !canCheckIn || attendanceGate?.status === 'no_schedule'}
                  title={
                    isCompleted ? 'Hoàn thành' :
                    attendanceGate?.status === 'no_schedule' ? 'Chưa có lịch dạy' :
                    !canCheckIn ? `Đã điểm danh. Mở khóa sau ${cooldownHours} tiếng.` : 
                    'Bấm để điểm danh'
                  }
                  className={`py-4 rounded-2xl font-black text-sm uppercase tracking-tight flex items-center justify-center gap-2 transition-all shadow-md ${
                    isCompleted 
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-2 border-gray-300'
                    : attendanceGate?.status === 'no_schedule'
                      ? 'bg-slate-100 text-slate-800 cursor-not-allowed border-2 border-slate-300'
                    : !canCheckIn
                      ? 'bg-slate-50 text-slate-600 cursor-not-allowed pointer-events-none select-none border-2 border-slate-200'
                      : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:shadow-green-200 shadow-green-100 active:scale-[0.97] border-2 border-transparent'
                  }`}>
                  <CheckCircle size={18} />
                  <span className="text-xs text-center leading-tight">
                    {isCompleted 
                      ? 'HOÀN THÀNH'
                      : attendanceGate?.status === 'no_schedule'
                        ? 'KHÔNG CÓ LỊCH'
                        : !canCheckIn
                          ? (cooldownHours > 0 ? `CHỜ ${cooldownHours}H` : 'ĐÃ ĐIỂM DANH')
                          : 'ĐIỂM DANH'}
                  </span>
                </button>
              )}

              {/* CỘT PHẢI: Nút HỦY */}
              <button
                onClick={() => { if (canCancelAttendance) handleUndoAttendance(); }}
                disabled={!canCancelAttendance || isCompleted}
                title={
                  !hasAttendedToday ? 'Chưa điểm danh hôm nay'
                  : !canCancelAttendance ? `Đã quá 1 tiếng, không thể hủy (${minsElapsedSinceAttend ?? 0} phút trước)`
                  : `Còn ${cancelTimeLeft} phút để hủy. Nhấn để hủy điểm danh hôm nay`
                }
                className={`py-4 rounded-2xl font-black text-sm uppercase tracking-tight flex items-center justify-center gap-2 transition-all border-2 ${
                  canCancelAttendance && !isCompleted
                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400 active:scale-[0.97] cursor-pointer shadow-sm'
                    : 'bg-slate-50 border-slate-300 text-slate-700 cursor-not-allowed pointer-events-none select-none shadow-sm'
                }`}>
                <X size={18} />
                <span className="text-xs text-center leading-tight">
                  {canCancelAttendance && cancelTimeLeft > 0
                    ? <>{`HỦY`}<br/>{`(${cancelTimeLeft}p)`}</>
                    : <>HỦY<br/>ĐIỂM DANH</>}
                </span>
              </button>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2 font-black uppercase text-xs text-gray-400 tracking-widest">📝 Ghi chú học viên</label>
              <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)}
                onBlur={() => onUpdateNotes(student._id || student.id, notesInput)} rows={3}
                placeholder="Nhận xét, ghi chú về học viên..."
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:border-blue-400 outline-none" />
            </div>
          </div>
        )}

        {activePanel === 'link' && (
          <div className="space-y-5">
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
               <div className="flex items-center gap-2 mb-3">
                 <Video size={18} className="text-blue-600" />
                 <h3 className="font-bold text-blue-800 text-sm">Link học trực tuyến</h3>
               </div>
               <p className="text-xs text-blue-500 mb-4 font-bold uppercase">Cập nhật link buổi học mới tại đây</p>
               <div className="flex gap-2">
                 <input type="text" value={linkInput} onChange={e => setLinkInput(e.target.value)}
                   className="flex-1 border-2 border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none"
                   placeholder="Dán link họp..." />
                 <button onClick={handleLinkSave}
                   className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${linkSaved ? 'bg-green-500 text-white' : 'bg-slate-800 text-white'}`}>
                   Lưu
                 </button>
               </div>
            </div>
          </div>
        )}

        {activePanel === 'grade' && (
          <div className="space-y-5">
             <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">Điểm trung bình</p>
                  <h4 className="text-3xl font-black text-orange-700">{student.lastGrade || 0}</h4>
                </div>
                <button onClick={() => setActivePanel('grade')} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Cập nhật điểm</button>
             </div>
          </div>
        )}
      </div>
    </div>

      {/* === DUY NHẤT 1 MODAL ĐIỂM DANH (dùng chung cho cả 2 view) === */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
            <div className="bg-gradient-to-r from-emerald-600 to-green-500 p-8 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight">Điểm danh &amp; Chấm điểm</h3>
                  <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">{student.course}</p>
                </div>
              </div>
              <button onClick={() => setShowAttendanceModal(false)} className="hover:bg-white/10 p-2 rounded-2xl transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                <p className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1">Học viên</p>
                <p className="text-lg font-black text-emerald-600">{getDisplayName(student)}</p>
                <p className="text-xs font-bold text-emerald-400 mt-2">Tiến độ hiện tại: {done}/{student.totalSessions} buổi</p>
              </div>
              
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Đánh giá buổi học (0-10)</label>
                <div className="relative">
                  <input 
                    type="number" min="0" max="10" step="0.5" 
                    value={attForm.grade}
                    onChange={(e) => setAttForm({ ...attForm, grade: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white rounded-2xl px-6 py-4 text-3xl font-black text-slate-700 outline-none transition-all"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 text-lg font-black">/ 10</div>
                </div>
              </div>

              <div>
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Ghi chú nhanh</label>
                 <textarea 
                   value={attForm.note}
                   onChange={(e) => setAttForm({ ...attForm, note: e.target.value })}
                   placeholder="Ví dụ: Học tốt, nộp bài đầy đủ..."
                   className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white rounded-2xl px-6 py-4 text-sm font-semibold text-slate-700 outline-none transition-all resize-none h-24"
                 />
              </div>

            </div>

            <div className="bg-slate-50 px-8 py-6 flex gap-4 flex-shrink-0">
              <button 
                onClick={closeModal}
                className="flex-[1] py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSubmit}
                disabled={submitting || (attForm._originalData?.status === 'completed' && !activeTab)}
                className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {attForm._originalData?.status === 'completed' ? 'Cập nhật' : 'Xác nhận Điểm danh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

export default StudentCard;
