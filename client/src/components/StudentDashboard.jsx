import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { FileUp, XCircle, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ClassReminder from './ClassReminder';
import { useData } from '../context/DataContext';
import PopupBanner from './PopupBanner';
import TuitionPaymentModal from './TuitionPaymentModal';
import StudentProfileUpdateModal from './StudentProfileUpdateModal';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  getClientEnrollments, scopeStudentToEnrollment, filterSchedulesByCourse,
  filterStudentTrainingFiles,
  filterStudentTrainingVideos,
} from '../utils/enrollments';
import { getSubjectIdsForCourseFilter, getSubjectIdsForStudent } from '../utils/examSubjects';
import { MilestoneEvaluationModal } from './student/MilestoneEvaluationModal';
import { StudentNoteModal } from './student/StudentNoteModal';
import {
  StudentLazyEvaluationTab,
  StudentLazyScheduleTab,
  StudentLazyMaterialsTab,
  StudentLazyProfileTab,
  StudentLazyOverviewTab,
} from './student/StudentLazyTabShell';


const StudentDashboard = ({ onNavigate }) => {
  const [activeCourseName, setActiveCourseName] = useState('');
  const [evaluatingCourseId, setEvaluatingCourseId] = useState(null);
  const [noteModalSched, setNoteModalSched] = useState(null);
  const session = JSON.parse(localStorage.getItem('student_user') || '{}');
  const STUDENT_ID = session.id || 101;
  const { students, teachers, materials, schedules, getNotifications, getConversations, getSchedulesByStudent, rateTeacher, getTeacherRating, RATING_CRITERIA, privateEvaluations, submitPrivateEvaluation, studentTrainingData, studentQuestions, examSubjectsCatalog } = useData();
  const student = students.find(s => String(s.id) === String(STUDENT_ID));
  const navigate = useNavigate();
  const location = useLocation();
  const { onDataRefresh, socket } = useSocket();

  const studentData = useMemo(() => {
    if (!student) return null;
    
    // Properly handle populated vs unpopulated `teacherId`
    const actualTeacherId = (typeof student.teacherId === 'object' && student.teacherId !== null) 
      ? student.teacherId._id || student.teacherId.id 
      : student.teacherId;
      
    const teacherRecord = teachers?.find(t => String(t.id) === String(actualTeacherId));
    
    const extractedTeacherName = (typeof student.teacherId === 'object' && student.teacherId?.name) 
      ? student.teacherId.name 
      : (student.teacherName || teacherRecord?.name);
      
    const extractedTeacherPhone = (typeof student.teacherId === 'object' && student.teacherId?.phone) 
      ? student.teacherId.phone 
      : (teacherRecord?.phone || student.zalo || '');

    const joinClassUrl = [student.linkHoc, student.online_meeting_url]
      .map((u) => (u && String(u).trim()) || '')
      .find(Boolean) || '';

    let isLikelyLiveClass = false;
    if (student.nextClassTime && joinClassUrl) {
      const t = new Date(student.nextClassTime).getTime();
      if (!Number.isNaN(t)) {
        const now = Date.now();
        isLikelyLiveClass = now >= t - 15 * 60 * 1000 && now <= t + 4 * 60 * 60 * 1000;
      }
    }

    return {
      ...student,
      joinClassUrl,
      isLikelyLiveClass,
      teacher: extractedTeacherName ? `Thầy ${extractedTeacherName}` : 'Chưa phân công',
      teacherId: actualTeacherId,
      teacherZalo: extractedTeacherPhone,
      attendanceHistory: student.grades || [],
      courses: getClientEnrollments(student),
      completedSessions: student.sessionsCompleted || (student.totalSessions - student.remainingSessions) || 0,
      totalSessions: student.totalSessions || 12,
    };
  }, [student, teachers]);

  const enrollments = useMemo(() => studentData?.courses || [], [studentData?.courses]);

  useEffect(() => {
    if (enrollments.length && !activeCourseName) {
      setActiveCourseName(enrollments[0].courseName || enrollments[0].name);
    }
  }, [enrollments, activeCourseName]);

  const activeEnrollment = useMemo(() => {
    if (!enrollments.length) return null;
    return enrollments.find((e) => (e.courseName || e.name) === activeCourseName) || enrollments[0];
  }, [enrollments, activeCourseName]);

  const viewStudent = useMemo(() => {
    if (!studentData) return null;
    const base = !activeEnrollment
      ? studentData
      : scopeStudentToEnrollment(studentData, activeEnrollment);
    const joinClassUrl = [base.linkHoc, studentData.online_meeting_url, studentData.joinClassUrl]
      .map((u) => (u && String(u).trim()) || '')
      .find(Boolean) || '';
    let isLikelyLiveClass = false;
    if (base.nextClassTime && joinClassUrl) {
      const t = new Date(base.nextClassTime).getTime();
      if (!Number.isNaN(t)) {
        const now = Date.now();
        isLikelyLiveClass = now >= t - 15 * 60 * 1000 && now <= t + 4 * 60 * 60 * 1000;
      }
    }
    return { ...base, joinClassUrl, isLikelyLiveClass };
  }, [studentData, activeEnrollment]);

  const studentTrainingForLms = useMemo(() => {
    const fallbackCourse = viewStudent?.course || studentData?.course;
    const courseName = activeCourseName || fallbackCourse;
    const videoSubjectIds = getSubjectIdsForStudent(enrollments, fallbackCourse, examSubjectsCatalog);
    const fileSubjectIds = getSubjectIdsForCourseFilter(enrollments, courseName, fallbackCourse, examSubjectsCatalog);
    const opts = {
      enrollments,
      fallbackCourse,
      activeCourseName: courseName,
    };
    return {
      videos: filterStudentTrainingVideos(studentTrainingData?.videos, { ...opts, allowedSubjectIds: videoSubjectIds, catalog: examSubjectsCatalog }),
      files: filterStudentTrainingFiles(studentTrainingData?.files, { ...opts, allowedSubjectIds: fileSubjectIds, catalog: examSubjectsCatalog }),
    };
  }, [studentTrainingData?.videos, studentTrainingData?.files, enrollments, viewStudent?.course, studentData?.course, activeCourseName, examSubjectsCatalog]);

  const progressPct = useMemo(() => {
    if (!viewStudent || !viewStudent.totalSessions) return 0;
    const pct = Math.round((viewStudent.completedSessions / viewStudent.totalSessions) * 100);
    return isNaN(pct) ? 0 : pct;
  }, [viewStudent]);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDone, setUploadDone] = useState(false);
  const fileRef = useRef(null);
  const [showTuitionModal, setShowTuitionModal] = useState(false);
  const [showUpdateProfileModal, setShowUpdateProfileModal] = useState(false);

  // ─── Assignments State ───
  const [myAssignments, setMyAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [submissionLink, setSubmissionLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStudentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("File bài làm quá lớn. Xin vui lòng giới hạn dưới 3MB!");
      e.target.value = '';
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.assignments.uploadFile(file);
      if (res.success) {
        setSubmissionLink(res.fileUrl);
      } else {
        alert(res.message || "Lỗi tải file");
      }
    } catch(err) {
      alert("Lỗi mạng khi tải file");
    }
    setIsSubmitting(false);
    e.target.value = '';
  };

  const fetchMyAssignments = useCallback(() => {
    const course = viewStudent?.course || studentData?.course;
    if (!course || !STUDENT_ID) return;
    api.assignments.getByStudentAndCourse(STUDENT_ID, course)
      .then((res) => { if (res.success) setMyAssignments(res.data); })
      .catch(() => {});
  }, [viewStudent?.course, studentData?.course, STUDENT_ID]);

  useEffect(() => {
    fetchMyAssignments();
  }, [fetchMyAssignments]);

  /** Realtime: GV tạo/sửa/xóa bài tập hoặc chấm điểm → cập nhật ngay không cần F5 */
  useEffect(() => {
    if (!socket || !STUDENT_ID) return;
    const sid = String(STUDENT_ID);

    const onNewAssignment = (assignment) => {
      const target = String(assignment?.studentId?._id || assignment?.studentId || '');
      if (target && target !== sid) return;
      setMyAssignments((prev) => {
        const id = String(assignment._id || assignment.id);
        if (prev.some((a) => String(a._id || a.id) === id)) return prev;
        return [{ ...assignment, mySubmission: null }, ...prev];
      });
    };

    const shouldRefresh = (data) => {
      if (!data || typeof data !== 'object') return false;
      if (data.type === 'assignment' || data.type === 'submission') return true;
      const ev = data.eventName;
      if (typeof ev === 'string' && (ev.startsWith('assignment:') || ev.startsWith('submission:'))) return true;
      if (data.title != null && (data._id != null || data.id != null)) return true;
      return false;
    };

    const onAssignmentUpdated = () => fetchMyAssignments();
    const onAssignmentDeleted = () => fetchMyAssignments();
    const onSubmissionGraded = () => fetchMyAssignments();

    socket.on('assignment:new', onNewAssignment);
    socket.on('assignment:updated', onAssignmentUpdated);
    socket.on('assignment:deleted', onAssignmentDeleted);
    socket.on('submission:graded', onSubmissionGraded);

    const unsubRefresh = onDataRefresh((data) => {
      if (shouldRefresh(data)) fetchMyAssignments();
    });

    return () => {
      socket.off('assignment:new', onNewAssignment);
      socket.off('assignment:updated', onAssignmentUpdated);
      socket.off('assignment:deleted', onAssignmentDeleted);
      socket.off('submission:graded', onSubmissionGraded);
      unsubRefresh?.();
    };
  }, [socket, STUDENT_ID, onDataRefresh, fetchMyAssignments]);

  // Hash-based section
  const currentHash = location.hash?.replace('#', '') || '';

  // Rating state
  const [ratingCriteria, setRatingCriteria] = useState({ teaching: '', voice: '', guidance: '', support: '' });
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);

  const mySchedulesAll = useMemo(() => getSchedulesByStudent(STUDENT_ID), [getSchedulesByStudent, STUDENT_ID]);
  const mySchedules = useMemo(
    () => filterSchedulesByCourse(mySchedulesAll, viewStudent?.course || activeCourseName),
    [mySchedulesAll, viewStudent?.course, activeCourseName]
  );

  const upcomingScheduleCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return (mySchedules || []).filter((s) => {
      if (s.status !== 'scheduled') return false;
      const d = new Date(s.date);
      if (Number.isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d >= todayStart;
    }).length;
  }, [mySchedules]);
  const myMaterials = useMemo(() =>
    materials.filter(m => student?.course?.includes(m.course) || m.course?.includes('THVP NÂNG CAO')),
    [materials, student]
  );
  
  const [teacherRatingData, setTeacherRatingData] = useState({ avg: 0, count: 0, ratings: [] });
  useEffect(() => {
    if (!viewStudent?.teacherId) return;
    api.evaluations.getByTeacher(viewStudent.teacherId).then(res => {
      if (res.success && res.data) {
        const validRatings = res.data.filter(r => r.criteria && r.criteria.stars);
        const count = validRatings.length;
        const avg = count > 0 ? (Math.round((validRatings.reduce((s, r) => s + r.criteria.stars, 0) / count) * 10) / 10) : 0;
        setTeacherRatingData({ avg, count, ratings: res.data });
      }
    }).catch(err => void 0);
  }, [viewStudent?.teacherId]);

  const displayGrades = useMemo(() => {
    const rawGrades = [...(viewStudent?.grades || [])];

    const dateKeysOf = (raw) => {
      if (!raw) return [];
      const keys = new Set([String(raw).trim()]);
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        keys.add(d.toLocaleDateString('vi-VN'));
        keys.add(d.toISOString().slice(0, 10));
      }
      return [...keys];
    };

    const gradeKeySet = new Set();
    rawGrades.forEach((g) => dateKeysOf(g.date).forEach((k) => gradeKeySet.add(k)));

    // Fallback: buổi lịch đã completed nhưng chưa có trong grades → vẫn hiện nhật ký
    (mySchedules || []).forEach((s) => {
      if (s.status !== 'completed') return;
      const keys = dateKeysOf(s.date);
      if (keys.some((k) => gradeKeySet.has(k))) return;
      const parsedDate = new Date(s.date);
      const dateLabel = Number.isNaN(parsedDate.getTime())
        ? String(s.date)
        : parsedDate.toLocaleDateString('vi-VN');
      rawGrades.push({
        date: dateLabel,
        time: s.startTime || '',
        note: s.note || 'Đã điểm danh hoàn thành buổi học',
        grade: 0,
        _fromSchedule: true,
      });
      keys.forEach((k) => gradeKeySet.add(k));
    });

    if (!rawGrades.length) return [];

    const homeworkByKey = new Map();
    const others = [];

    rawGrades.forEach((g, idx) => {
      const note = g.note || '';
      const noteLower = note.toLowerCase();
      const isHomework = noteLower.includes('bài nộp') || noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm');
      if (!isHomework) {
        others.push({ ...g, _sortKey: new Date(g.date).getTime() || idx, _idx: idx });
        return;
      }

      const titleMatch = note.match(/^(?:Bài nộp|Cập nhật điểm|Sửa điểm):\s*(.+?)(?:\s*\(|(?:\s*-\s*)|$)/i);
      const key = g.assignmentId
        ? String(g.assignmentId)
        : (titleMatch ? titleMatch[1].trim().toLowerCase() : `hw_${idx}`);
      const sortKey = new Date(g.date).getTime() || idx;
      const existing = homeworkByKey.get(key);
      if (!existing || sortKey >= existing._sortKey) {
        homeworkByKey.set(key, { ...g, _sortKey: sortKey, _idx: idx });
      }
    });

    return [...others, ...homeworkByKey.values()]
      .sort((a, b) => b._sortKey - a._sortKey);
  }, [viewStudent?.grades, mySchedules]);

  const studyLogs = useMemo(() => {
    if (!viewStudent) return [];
    const logs = [];
    
    // 1. Buổi học đã hoàn thành / Điểm danh
    let sessionCount = (viewStudent.attendanceHistory || []).filter(item => !(item.note && item.note.toLowerCase().includes('bài nộp'))).length;

    (viewStudent.attendanceHistory || []).forEach((item, idx) => {
       let parsedDate = item.date;
       if (parsedDate && parsedDate.includes('T')) {
         parsedDate = new Date(parsedDate).toLocaleDateString('vi-VN');
       }
       // Lấy exact time từ mySchedules
       const sched = mySchedules?.find(s => new Date(s.date).toLocaleDateString('vi-VN') === parsedDate && s.status === 'completed');
       
       const isHomework = item.note && item.note.toLowerCase().includes('bài nộp');

       logs.push({
          type: isHomework ? 'homework' : 'attendance',
          date: parsedDate,
          time: sched ? sched.startTime : '',
          note: item.note || 'Đã điểm danh hoàn thành buổi học',
          grade: item.grade,
          index: isHomework ? null : sessionCount--, // Không đếm bài nộp vào
          timestamp: sched ? new Date(sched.updatedAt || sched.createdAt).getTime() : 0
       });
    });

    // 2. Lịch đã hủy
    (mySchedules || []).forEach(s => {
       if (s.status === 'cancelled') {
         logs.push({
            type: 'cancelled',
            date: new Date(s.date).toLocaleDateString('vi-VN'),
            time: s.startTime,
            note: s.note || 'Lịch học đã bị hủy',
            grade: null,
            index: null,
            timestamp: new Date(s.updatedAt || s.createdAt).getTime()
         });
       }
    });

    // Sắp xếp theo timestamp giảm dần nếu có, nếu không thì giữ nguyên (do attendanceHistory đã có thứ tự)
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [viewStudent, mySchedules]);

  const isNew = viewStudent?.completedSessions === 0;

  const [activeMilestone, setActiveMilestone] = useState(null);

  // Check for milestone evaluations
  useEffect(() => {
    if (!viewStudent?.id || !viewStudent?.teacherId) return;

    const milestones = [];
    if (viewStudent.completedSessions === 1) milestones.push('lesson_1');
    if (viewStudent.completedSessions >= viewStudent.totalSessions / 2 && viewStudent.completedSessions < (viewStudent.totalSessions / 2) + 1) milestones.push('mid_course');

    for (const m of milestones) {
      const alreadyDone = privateEvaluations.some(e => e.studentId === viewStudent.id && e.milestone === m);
      if (!alreadyDone) {
        setTimeout(() => setActiveMilestone(m), 2000);
        break;
      }
    }
  }, [viewStudent?.completedSessions, viewStudent?.id, viewStudent?.totalSessions, viewStudent?.teacherId, privateEvaluations]);

  const myNotifs = getNotifications(STUDENT_ID, 'student').filter(n => !n.read).length;
  const myUnreadMsgs = (() => {
    try {
      const convs = typeof getConversations === 'function' ? getConversations(STUDENT_ID) : [];
      return (convs || []).reduce((sum, c) => sum + (c?.unread || 0), 0);
    } catch {
      return 0;
    }
  })();

  const handleFileUpload = (e) => {
    const f = e.target.files[0];
    if (f) { setUploadFile(f); setTimeout(() => setUploadDone(true), 1500); }
  };

  if (!studentData || !viewStudent) return <div className="p-20 text-center text-gray-500">Không tìm thấy học viên.</div>;

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-transparent font-sans h-full">
      {/* Popup thông báo — hiện 1 lần/ngày */}
      <PopupBanner role="student" />

      {/* Modal đóng học phí (tự động qua SePay) */}
      {noteModalSched && (
         <StudentNoteModal 
           schedule={noteModalSched} 
           onClose={() => setNoteModalSched(null)} 
           onSubmit={async (noteText) => {
             const targetId = noteModalSched._id || noteModalSched.id;
             
             // 1. Tắt Modal trước ngay lập tức để học viên không phải đợi (Optimistic)
             setNoteModalSched(null);
             
             // 2. Thử cập nhật giao diện ngầm nếu tồn tại hàm báo mảng
             try {
               if (typeof setSchedules === 'function') {
                 setSchedules(prev => prev.map(s => (s._id === targetId || s.id === targetId) ? { ...s, studentNote: noteText } : s));
               }
             } catch(err) { /* ignore */ }

             // 3. Gửi chạy ngầm tới máy chủ
             try {
               await api.schedules.update(targetId, { studentNote: noteText, hasUnreadStudentNote: true });
             } catch(e) {
               console.error('Lỗi khi gửi Note:', e);
             }
           }} 
         />
      )}

      {showTuitionModal && (
        <TuitionPaymentModal
          student={studentData}
          onClose={() => setShowTuitionModal(false)}
          onPaid={() => { setShowTuitionModal(false); window.location.reload(); }}
        />
      )}

      {/* Modal cập nhật hồ sơ cá nhân */}
      {showUpdateProfileModal && (
        <StudentProfileUpdateModal
          student={studentData}
          onClose={() => setShowUpdateProfileModal(false)}
        />
      )}

      {/* Modal Nộp bài tập */}
      {activeAssignment && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-slate-800 flex items-center gap-2 min-w-0">
                <FileUp size={20} className="text-blue-600" /> Nộp bài tập
              </h3>
              <button onClick={() => setActiveAssignment(null)} className="text-slate-400 hover:text-red-500 transition-colors p-1 bg-white hover:bg-red-50 rounded-xl">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-1">Tên bài tập</p>
                <p className="font-bold text-slate-800 text-lg">{activeAssignment.title}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Link bài làm hoặc Tải file lên</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input 
                      type="url"
                      placeholder="https://drive.google.com/... hoặc link file" 
                      className="flex-1 border-2 border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-300 font-medium"
                      value={submissionLink}
                      onChange={(e) => setSubmissionLink(e.target.value)}
                    />
                    <label className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-3 rounded-xl cursor-pointer transition flex items-center justify-center font-bold sm:w-auto w-full" title="Tải file trực tiếp (Tối đa 3MB)">
                      {isSubmitting ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <FileUp size={20} />}
                      <input type="file" className="hidden" onChange={handleStudentUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" disabled={isSubmitting} />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">* Tối đa 3MB (PDF, Word, Excel, ZIP, RAR). Nhớ mở quyền truy cập nếu là link Drive.</p>
                </div>
                <button
                  disabled={!submissionLink || isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    api.assignments.submit(activeAssignment._id, { studentId: STUDENT_ID, teacherId: viewStudent.teacherId, submittedFileUrl: submissionLink })
                      .then(res => {
                        setIsSubmitting(false);
                        if (res.success) {
                          setMyAssignments(prev => prev.map(a => a._id === activeAssignment._id ? { ...a, mySubmission: res.data } : a));
                          setActiveAssignment(null);
                          setSubmissionLink('');
                        }
                      }).catch(err => setIsSubmitting(false));
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-[0.98] mt-4"
                >
                  {isSubmitting ? 'Đang nộp...' : 'Xác nhận Nộp bài'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0">
        {/* ClassReminder */}
        <ClassReminder
          nextClassTime={viewStudent.nextClassTime}
          linkHoc={viewStudent.joinClassUrl}
          courseName={viewStudent.course}
          studentName={viewStudent.name}
        />


        {/* Topbar removed - using DashboardLayout header */}
        <div className="pt-4"></div> {/* Temporary empty div to keep spacing if needed, or better: remove and use margin */}
        
        {/* ═══ CONTENT — Switch based on hash ═══ */}
        {currentHash === 'schedule' ? (
          <StudentLazyScheduleTab
            enrollments={enrollments}
            activeCourseName={activeCourseName}
            setActiveCourseName={setActiveCourseName}
            viewStudent={viewStudent}
            mySchedules={mySchedules}
            setNoteModalSched={setNoteModalSched}
            displayGrades={displayGrades}
          />
        ) : currentHash === 'materials' ? (
          <StudentLazyMaterialsTab
            enrollments={enrollments}
            activeCourseName={activeCourseName}
            setActiveCourseName={setActiveCourseName}
            viewStudent={viewStudent}
            studentTrainingForLms={studentTrainingForLms}
            myAssignments={myAssignments}
            studentTrainingData={studentTrainingData}
          />
        ) : currentHash === 'evaluation' ? (
          <StudentLazyEvaluationTab
            studentData={{ ...viewStudent, courses: enrollments }}
            evaluatingCourseId={evaluatingCourseId}
            setEvaluatingCourseId={setEvaluatingCourseId}
            STUDENT_ID={STUDENT_ID}
            submitPrivateEvaluation={submitPrivateEvaluation}
            getTeacherRating={getTeacherRating}
            ratingSubmitted={ratingSubmitted}
            setRatingSubmitted={setRatingSubmitted}
            isEditingRating={isEditingRating}
            setIsEditingRating={setIsEditingRating}
            ratingCriteria={ratingCriteria}
            setRatingCriteria={setRatingCriteria}
            ratingComment={ratingComment}
            setRatingComment={setRatingComment}
            RATING_CRITERIA={RATING_CRITERIA}
            rateTeacher={rateTeacher}
            privateEvaluations={privateEvaluations}
            teacherRatingData={teacherRatingData}
            setTeacherRatingData={setTeacherRatingData}
            api={api}
          />
        ) : currentHash === 'profile' ? (
          <StudentLazyProfileTab
            studentData={studentData}
            progressPct={progressPct}
            setShowUpdateProfileModal={setShowUpdateProfileModal}
            setShowTuitionModal={setShowTuitionModal}
          />
        ) : (
          <StudentLazyOverviewTab
            studentData={studentData}
            enrollments={enrollments}
            activeCourseName={activeCourseName}
            setActiveCourseName={setActiveCourseName}
            viewStudent={viewStudent}
            progressPct={progressPct}
            teacherRatingData={teacherRatingData}
            isNew={isNew}
            myAssignments={myAssignments}
            upcomingScheduleCount={upcomingScheduleCount}
            myUnreadMsgs={myUnreadMsgs}
            studyLogs={studyLogs}
            materials={materials}
          />
        )}
      </div>

      {/* FAB tin nhắn nhanh: chỉ máy tính */}
      <button
        type="button"
        onClick={() => navigate('/student/inbox', { state: { selectUserId: studentData.teacherId } })}
        className="hidden md:inline-flex fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl z-50 active:scale-90 transition"
        aria-label="Mở hộp thư"
        title="Nhắn tin"
      >
        <MessageSquare size={24} aria-hidden="true" />
      </button>

      {activeMilestone && (
        <MilestoneEvaluationModal
          milestone={activeMilestone}
          studentId={STUDENT_ID}
          teacherId={studentData.teacherId}
          courseName={studentData.course}
          onClose={() => setActiveMilestone(null)}
          onSubmit={submitPrivateEvaluation}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
