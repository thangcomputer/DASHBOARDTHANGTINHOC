import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { FileUp, XCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ClassReminder from './ClassReminder';
import { useData } from '../context/DataContext';
import PopupBanner from './PopupBanner';
import TuitionPaymentModal from './TuitionPaymentModal';
import StudentProfileUpdateModal from './StudentProfileUpdateModal';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  getClientEnrollments, getActiveClientEnrollments, scopeStudentToEnrollment, filterSchedulesByCourse,
  filterStudentTrainingFiles,
  filterStudentTrainingVideos,
  enrichEnrollmentsWithTeachers,
  uniqueTeacherNames,
  formatTeacherDisplay,
} from '../utils/enrollments';
import { getSubjectIdsForCourseFilter, getSubjectIdsForStudent } from '../utils/examSubjects';
import { getScheduleDisplayKind } from '../utils/scheduleTime';
import { buildStudentActivityLogs } from '../utils/studentActivityLogs';
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
  let session = {};
  try {
    session = JSON.parse(localStorage.getItem('student_user') || '{}') || {};
  } catch {
    session = {};
  }
  const STUDENT_ID = session.id || session._id || null;
  const { students, teachers, materials, schedules, getNotifications, getConversations, getSchedulesByStudent, rateTeacher, getTeacherRating, RATING_CRITERIA, privateEvaluations, submitPrivateEvaluation, studentTrainingData, studentQuestions, examSubjectsCatalog } = useData();
  const student = students.find(s => String(s.id) === String(STUDENT_ID));
  const navigate = useNavigate();
  const location = useLocation();
  const { onDataRefresh, socket } = useSocket();

  const studentData = useMemo(() => {
    if (!student) return null;

    const courses = enrichEnrollmentsWithTeachers(getActiveClientEnrollments(student), teachers);

    const namesFromCourses = uniqueTeacherNames(courses);
    
    // Properly handle populated vs unpopulated `teacherId`
    // Backend có thể trả `teacherId` dạng mảng (nhiều môn / nhiều GV)
    const rawTeacherId = student.teacherId;
    const actualTeacherId = (typeof rawTeacherId === 'object' && rawTeacherId !== null)
      ? rawTeacherId._id || rawTeacherId.id
      : rawTeacherId;

    const teacherIdsFromCourses = courses.map((c) => String(c.teacherId || '')).filter(Boolean);
    const teacherIds = Array.isArray(student.teacherIds) && student.teacherIds.length
      ? student.teacherIds.map((id) => String(id))
      : (teacherIdsFromCourses.length
        ? [...new Set(teacherIdsFromCourses)]
        : (actualTeacherId ? [String(actualTeacherId)] : []));

    const teacherNamesFromApi = Array.isArray(student.teacherNames) && student.teacherNames.length
      ? student.teacherNames.map((n) => String(n)).filter(Boolean)
      : [];

    const teacherRecords = teacherIds
      .map((id) => teachers?.find((t) => String(t.id) === String(id) || String(t._id) === String(id)))
      .filter(Boolean);

    const teacherNames = namesFromCourses.length
      ? namesFromCourses
      : (teacherNamesFromApi.length
        ? teacherNamesFromApi
        : teacherRecords.map((t) => t.name).filter(Boolean));

    const extractedTeacherPhone = (typeof rawTeacherId === 'object' && rawTeacherId?.phone)
      ? rawTeacherId.phone
      : (teacherRecords[0]?.phone || student.zalo || '');

    const teacherDisplay = formatTeacherDisplay(teacherNames);

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

    const result = {
      ...student,
      // Đồng bộ avatar gender với session (sidebar) — tránh profile lệch nam/nữ
      gender: session?.gender || student.gender || '',
      avatar: session?.avatar || student.avatar || '',
      joinClassUrl,
      isLikelyLiveClass,
      teacher: teacherDisplay,
      teacherId: teacherIds[0] || actualTeacherId || '',
      teacherIds,
      teacherNames,
      teacherZalo: extractedTeacherPhone,
      attendanceHistory: student.grades || [],
      courses,
      completedSessions: Number(student.completedSessions) >= 0
        ? Number(student.completedSessions)
        : (student.sessionsCompleted
          || Math.max(0, (student.totalSessions || 12) - (Number(student.remainingSessions) || 0))
          || 0),
      remainingSessions: Number(student.remainingSessions) >= 0
        ? Number(student.remainingSessions)
        : Math.max(0, (student.totalSessions || 12) - (Number(student.completedSessions) || 0)),
      totalSessions: student.totalSessions || 12,
    };
    // Tính nhãn trạng thái dựa vào tiến độ thực tế
    const comp = Number(result.completedSessions) || 0;
    const total = Number(result.totalSessions) || 12;
    const rawStatus = String(student.status || '').toLowerCase();
    const isCompletedByStatus = rawStatus === 'completed' || rawStatus === 'hoàn thành' || rawStatus === 'hoan thanh';
    const isCompletedBySessions = total > 0 && comp >= total;
    result.status = (isCompletedByStatus || isCompletedBySessions) ? 'Đã hoàn thành' : 'Đang học';
    return result;
  }, [student, teachers, session?.gender, session?.avatar]);

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
      window.cmsAlert("File bài làm quá lớn. Xin vui lòng giới hạn dưới 3MB!", "error");
      e.target.value = '';
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.assignments.uploadFile(file);
      if (res.success) {
        setSubmissionLink(res.fileUrl);
      } else {
        window.cmsAlert(res.message || "Lỗi tải file", "error");
      }
    } catch(err) {
      window.cmsAlert("Lỗi mạng khi tải file", "error");
    }
    setIsSubmitting(false);
    e.target.value = '';
  };

  const fetchMyAssignments = useCallback(() => {
    if (!STUDENT_ID) return;
    const names = [...new Set(
      (enrollments || [])
        .map((e) => String(e.courseName || e.name || '').trim())
        .filter(Boolean)
    )];
    const fallback = String(viewStudent?.course || studentData?.course || '').trim();
    if (fallback && !names.includes(fallback)) names.push(fallback);
    if (names.length === 0) {
      setMyAssignments([]);
      return;
    }

    const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    Promise.all(
      names.map((name) => api.assignments.getByStudentAndCourse(STUDENT_ID, name).catch(() => null))
    )
      .then((results) => {
        const merged = [];
        const seen = new Set();
        results.forEach((res, idx) => {
          const want = norm(names[idx]);
          (res?.success ? res.data : []).forEach((a) => {
            if (want && norm(a.courseId) !== want) return;
            const id = String(a._id || a.id || '');
            if (!id || seen.has(id)) return;
            seen.add(id);
            merged.push(a);
          });
        });
        merged.sort((a, b) => new Date(b.deadline || b.createdAt || 0) - new Date(a.deadline || a.createdAt || 0));
        setMyAssignments(merged);
      })
      .catch(() => {});
  }, [enrollments, viewStudent?.course, studentData?.course, STUDENT_ID]);

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
  const currentHash = (location.hash?.replace('#', '') || '').split(/[?#]/)[0];

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
    // Tổng quan: đếm buổi còn sắp tới / đang diễn ra (không tính buổi đã qua giờ)
    return (mySchedulesAll || []).filter((s) => {
      const kind = getScheduleDisplayKind(s);
      return kind === 'upcoming' || kind === 'ongoing';
    }).length;
  }, [mySchedulesAll]);
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
  // ─── Quizzes State (Trắc nghiệm Giảng viên giao) ───
  const [myQuizzes, setMyQuizzes] = useState([]);

  const fetchMyQuizzes = useCallback(async () => {
    if (!STUDENT_ID) return;
    try {
      const res = await api.quizzes.getStudentQuizzes();
      if (res.success) setMyQuizzes(res.data || []);
    } catch { /* ignore */ }
  }, [STUDENT_ID]);

  useEffect(() => {
    fetchMyQuizzes();
  }, [fetchMyQuizzes]);

  const displayGrades = useMemo(() => {
    if (!viewStudent) return [];
    return buildStudentActivityLogs({
      student: viewStudent,
      assignments: myAssignments || [],
      quizzes: myQuizzes || [],
      evaluations: privateEvaluations || [],
      schedules: mySchedules || [],
    });
  }, [viewStudent, myAssignments, myQuizzes, privateEvaluations, mySchedules]);

  const displayGradesAll = useMemo(() => {
    if (!studentData) return [];
    return buildStudentActivityLogs({
      student: { ...studentData, course: null }, // bypass course filter to show all logs
      assignments: myAssignments || [],
      quizzes: myQuizzes || [],
      evaluations: privateEvaluations || [],
      schedules: mySchedulesAll || [],
    });
  }, [studentData, myAssignments, myQuizzes, privateEvaluations, mySchedulesAll]);

  const studyLogs = useMemo(() => {
    if (!viewStudent) return [];
    const pendingLogs = [];
    const seenKeys = new Set();

    const parseDateToMs = (dStr) => {
      if (!dStr) return 0;
      if (dStr instanceof Date) return dStr.getTime();
      if (typeof dStr === 'number') return dStr;
      const str = String(dStr).trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const dt = new Date(year, month, day);
          if (!Number.isNaN(dt.getTime())) return dt.getTime();
        }
      }
      const dt = new Date(str);
      return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
    };

    // Lịch GV xếp — nhãn theo thời gian thực (upcoming/pending)
    (mySchedules || []).forEach((s, sIdx) => {
       const dateStr = s.date ? new Date(s.date).toLocaleDateString('vi-VN') : '';
       const ts = parseDateToMs(s.date) || Date.now();
       const kind = getScheduleDisplayKind(s);

       if (kind === 'upcoming' || kind === 'ongoing') {
         const key = `sched_${dateStr}_${s.startTime || sIdx}`;
         if (!seenKeys.has(key)) {
           seenKeys.add(key);
           pendingLogs.push({
              type: 'scheduled',
              displayKind: kind,
              date: dateStr,
              time: s.startTime ? `${s.startTime}${s.endTime ? ` - ${s.endTime}` : ''}` : (s.time || ''),
              note: s.title || s.subject || `Lịch học giảng viên xếp (${s.teacherName || viewStudent.teacher || 'Giảng viên'})`,
              grade: null,
              index: null,
              timestamp: ts
           });
         }
       } else if (kind === 'past_pending' || kind === 'pending_attendance' || kind === 'overdue_attendance') {
         const key = `past_${dateStr}_${s.startTime || sIdx}`;
         if (!seenKeys.has(key)) {
           seenKeys.add(key);
           const pendingNote = kind === 'overdue_attendance'
             ? `Quá hạn điểm danh — chờ quản trị viên điểm danh bù (${s.teacherName || viewStudent.teacher || 'Giảng viên'})`
             : `Chưa điểm danh — buổi đã kết thúc (${s.teacherName || viewStudent.teacher || 'Giảng viên'})`;
           pendingLogs.push({
              type: kind === 'overdue_attendance' ? 'overdue_attendance' : 'pending_attendance',
              displayKind: kind,
              date: dateStr,
              time: s.startTime ? `${s.startTime}${s.endTime ? ` - ${s.endTime}` : ''}` : (s.time || ''),
              note: s.title || s.subject || pendingNote,
              grade: null,
              index: null,
              timestamp: ts
           });
         }
       }
       // completed: đã hiện qua attendanceHistory/grades ở bước 1 — không nhân đôi
    });

    return [...pendingLogs, ...displayGrades].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [viewStudent, mySchedules, displayGrades]);


  const isNew = viewStudent?.completedSessions === 0;

  const [activeMilestone, setActiveMilestone] = useState(null);
  const [serverMilestoneEvals, setServerMilestoneEvals] = useState([]);
  const [milestoneEvalsReady, setMilestoneEvalsReady] = useState(false);

  useEffect(() => {
    if (!STUDENT_ID) {
      setMilestoneEvalsReady(true);
      return undefined;
    }
    let cancelled = false;
    api.evaluations.getMine().then((res) => {
      if (cancelled) return;
      if (res?.success && Array.isArray(res.data)) {
        setServerMilestoneEvals(res.data);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setMilestoneEvalsReady(true);
    });
    return () => { cancelled = true; };
  }, [STUDENT_ID]);

  // Popup đánh giá mốc: buổi 1 (GV) | hết khóa (trung tâm → GV trong MỘT modal)
  useEffect(() => {
    if (!milestoneEvalsReady) return undefined;
    if (!viewStudent?.id || !viewStudent?.teacherId) return undefined;
    // Đang mở modal — không schedule mở thêm (tránh popup GV trùng sau khi gửi bước trung tâm)
    if (activeMilestone) return undefined;

    const studentId = String(viewStudent.id);
    const courseName = String(viewStudent.course || '').trim();
    const idSet = new Set(
      [viewStudent.id, viewStudent._id, STUDENT_ID].filter(Boolean).map((v) => String(v)),
    );
    const matchesStudent = (e) => idSet.has(String(e?.studentId || ''));
    const matchesCourse = (e) => {
      const saved = String(e?.courseName || '').trim();
      if (!courseName || !saved) return true;
      return saved === courseName;
    };
    const pool = [...(privateEvaluations || []), ...serverMilestoneEvals];
    const done = (m) => pool.some(
      (e) => matchesStudent(e) && e.milestone === m && matchesCourse(e),
    );
    let next = null;
    if (Number(viewStudent.completedSessions) === 1 && !done('lesson_1')) {
      next = 'lesson_1';
    } else {
      const total = Number(viewStudent.totalSessions) || 12;
      const completed = Number(viewStudent.completedSessions) || 0;
      if (completed > 0 && completed >= total) {
        const centerDone = done('course_end_center');
        const teacherDone = done('course_end_teacher');
        if (!centerDone || !teacherDone) {
          next = 'course_end';
        }
      }
    }

    if (!next) return undefined;
    const timer = setTimeout(() => setActiveMilestone(next), 2000);
    return () => clearTimeout(timer);
  }, [
    activeMilestone,
    milestoneEvalsReady,
    viewStudent?.completedSessions,
    viewStudent?.id,
    viewStudent?._id,
    viewStudent?.totalSessions,
    viewStudent?.teacherId,
    viewStudent?.course,
    privateEvaluations,
    serverMilestoneEvals,
    STUDENT_ID,
  ]);

  const existingPublicRating = (teacherRatingData?.ratings || []).find(
    (r) => String(r.studentId) === String(STUDENT_ID) && (r.criteria?.stars || r.criteria?.teaching),
  ) || null;
  const courseEndStartStep = (() => {
    if (activeMilestone !== 'course_end' || !viewStudent?.id) return 'center';
    const sid = String(viewStudent.id);
    const idSet = new Set(
      [viewStudent.id, viewStudent._id, STUDENT_ID].filter(Boolean).map((v) => String(v)),
    );
    const courseName = String(viewStudent.course || '').trim();
    const pool = [...(privateEvaluations || []), ...serverMilestoneEvals];
    const hasMilestone = (m) => pool.some((e) => {
      if (!idSet.has(String(e?.studentId || '')) && String(e?.studentId || '') !== sid) return false;
      if (e.milestone !== m) return false;
      const saved = String(e?.courseName || '').trim();
      if (!courseName || !saved) return true;
      return saved === courseName;
    });
    const centerDone = hasMilestone('course_end_center');
    const teacherDone = hasMilestone('course_end_teacher');
    if (centerDone && !teacherDone) return 'teacher';
    return 'center';
  })();
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
                        } else {
                          window.alert?.(res.message || 'Nộp bài thất bại');
                        }
                      }).catch(() => {
                        setIsSubmitting(false);
                        window.alert?.('Lỗi kết nối khi nộp bài. Vui lòng thử lại.');
                      });
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
            viewStudent={viewStudent}
            mySchedules={mySchedulesAll}
            setNoteModalSched={setNoteModalSched}
            displayGrades={displayGradesAll}
          />
        ) : currentHash === 'materials' ? (
          <StudentLazyMaterialsTab
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
            milestoneEvals={serverMilestoneEvals}
            teacherRatingData={teacherRatingData}
            setTeacherRatingData={setTeacherRatingData}
            api={api}
          />
        ) : currentHash === 'profile' ? (
          <StudentLazyProfileTab
            studentData={studentData}
            sessionGender={session?.gender || ''}
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
            mySchedules={mySchedules}
            upcomingScheduleCount={upcomingScheduleCount}
            myUnreadMsgs={myUnreadMsgs}
            studyLogs={studyLogs}
            materials={materials}
          />
        )}
                  </div>

      {activeMilestone && (
        <MilestoneEvaluationModal
          key={activeMilestone}
          milestone={activeMilestone}
          startStep={activeMilestone === 'course_end' ? courseEndStartStep : undefined}
          studentId={STUDENT_ID}
          teacherId={studentData.teacherId}
          teacherName={studentData.teacher}
          courseName={studentData.course}
          onClose={() => setActiveMilestone(null)}
          onSubmit={async (payload) => {
            await submitPrivateEvaluation(payload);
            setServerMilestoneEvals((prev) => {
              const rest = (prev || []).filter((e) => !(
                String(e.studentId) === String(payload.studentId)
                && e.milestone === payload.milestone
                && String(e.courseName || '') === String(payload.courseName || '')
              ));
              return [...rest, {
                ...payload,
                studentId: String(payload.studentId),
                comment: payload.comment || '',
              }];
            });
          }}
          rateTeacher={rateTeacher}
          RATING_CRITERIA={RATING_CRITERIA}
          existingPublicRating={existingPublicRating}
          onPublicRated={(criteria, comment) => {
            setRatingSubmitted(true);
            setIsEditingRating(false);
            setRatingCriteria((prev) => ({ ...prev, ...criteria }));
            setRatingComment(comment || '');
            const targetTeacherId = studentData.teacherId;
            if (!targetTeacherId || !api?.evaluations?.getByTeacher) return;
            api.evaluations.getByTeacher(targetTeacherId).then((res) => {
              if (res.success && res.data) {
                const validRatings = res.data.filter((r) => r.criteria && r.criteria.stars);
                const count = validRatings.length;
                const avg = count > 0
                  ? (Math.round((validRatings.reduce((s, r) => s + r.criteria.stars, 0) / count) * 10) / 10)
                  : 0;
                setTeacherRatingData({ avg, count, ratings: res.data });
              }
            }).catch(() => {});
          }}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
