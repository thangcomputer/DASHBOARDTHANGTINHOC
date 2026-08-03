import React, { useState, useMemo } from 'react';
import CmsSelect from './ui/CmsSelect';
import {
  Award, Bell, ChevronRight, Clock, FileText, Monitor,
  CheckCircle, XCircle, Lock, Trophy, User, LogOut,
  BarChart2, BookOpen, Play, Filter
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { getClientEnrollments } from '../utils/enrollments';
import {
  getSubjectIdsForStudent,
  getSubjectIdsForCourseFilter,
  resolveExamFilterStatus,
  buildExamSubjectsFromProgress,
  getExamSubjectMeta,
  getExamSubjectInitials,
  isExamUnlockedForSubject,
} from '../utils/examSubjects';
import { useIsDesktopExamDevice } from '../utils/examDevice';
import StudentQuizList from './student/StudentQuizList';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'chua_thi', label: 'Chưa thi' },
  { value: 'da_thi', label: 'Đã thi' },
  { value: 'rot', label: 'Rớt' },
];
function useCountdown(target) {
  const [remaining, setRemaining] = React.useState('');
  React.useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining('00:00:00'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${d} ngày ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  return remaining;
}

const SubjectCard = ({ subject, onStart, isGlobalApproved, examSubjectsCatalog, allowStartExam = true }) => {
  const meta = getExamSubjectMeta(subject.id, examSubjectsCatalog);
  const initials = getExamSubjectInitials(meta);
  const countdown = useCountdown(subject.lockUntil);

  const isApproved = isGlobalApproved || subject.meetsMilestone;
  const isLockedCountDown = subject.lockUntil && subject.lockUntil > Date.now();

  const tnScore = subject.tracNghiem?.score ?? null;
  const tnTotal = subject.tracNghiem?.total ?? 30;
  const tnPct = subject.tracNghiem && tnTotal > 0 ? Math.round((tnScore / tnTotal) * 100) : null;
  const tnFailed = tnPct !== null && tnPct < 50;

  const statusBadge = () => {
    if (isLockedCountDown || subject.status === 'khong_dat' || tnFailed) {
      return <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">RỚT</span>;
    }
    if (subject.thucHanh === 'da_nop' && (subject.essayScore === null || subject.essayScore === undefined)) {
      return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">CHỜ CHẤM</span>;
    }
    if (subject.status === 'dat' && (tnPct === null || tnPct >= 50) && (subject.essayScore == null || subject.essayScore >= 5)) {
      return <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">ĐẬU</span>;
    }
    if (subject.status === 'dang_thi') {
      return <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">ĐANG THI</span>;
    }
    if (subject.status === 'dang_khoa') {
      return <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">ĐANG KHÓA</span>;
    }
    return <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">CHƯA THI</span>;
  };

  const tracNghiemDisplay = () => {
    if (!subject.tracNghiem) return <span className="text-sm text-gray-400">Chưa làm</span>;
    const { score, total } = subject.tracNghiem;
    const pct = Math.round((score / total) * 100);
    return (
      <span className={`text-sm font-semibold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
        {score}/{total}
      </span>
    );
  };

  const thucHanhDisplay = () => {
    if (subject.thucHanh === 'da_nop') {
      if (subject.essayScore !== null && subject.essayScore !== undefined) {
        return (
          <span className={`text-sm font-semibold ${subject.essayScore >= 5 ? 'text-green-600' : 'text-red-500'}`}>
            {subject.essayScore}/10
          </span>
        );
      }
      return <span className="text-sm text-amber-600 font-semibold">Chờ chấm điểm</span>;
    }
    if (subject.thucHanh === 'chua_nop') return <span className="text-sm text-gray-400">Chưa nộp</span>;
    return <span className="text-sm text-red-500">Chưa nộp bài</span>;
  };

  const isLocked = subject.status === 'dang_khoa';
  const canStart  = allowStartExam && isApproved && !isLocked && !isLockedCountDown && (subject.status === 'chua_thi' || !subject.status);
  const isOngoing = allowStartExam && isApproved && !isLocked && !isLockedCountDown && subject.status === 'dang_thi';
  const canRetry  = allowStartExam && isApproved && !isLocked && !isLockedCountDown && subject.status === 'khong_dat';
  const isPassed  = subject.status === 'dat';
  const wouldBeAbleToStart =
    isApproved && !isLocked && !isLockedCountDown &&
    (subject.status === 'chua_thi' || !subject.status || subject.status === 'dang_thi' || subject.status === 'khong_dat');

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden ${
      !isApproved || isLocked || isLockedCountDown ? 'opacity-80 border-gray-200 bg-gray-50' : 'hover:shadow-md'
    }`}>
      {/* Card header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 shrink-0 ${(!isApproved || isLocked || isLockedCountDown) ? 'bg-gray-200' : meta.bg} rounded-xl flex items-center justify-center shadow-sm transition-colors`}>
              <span className={`font-black leading-none tracking-tight ${initials.length > 2 ? 'text-sm' : 'text-lg'} ${(!isApproved || isLocked || isLockedCountDown) ? 'text-gray-400' : 'text-white'}`}>
                {initials}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base leading-tight">{meta.label}</h3>
            </div>
          </div>
          {statusBadge()}
        </div>

        {/* Stats — luôn xem được trên mọi thiết bị */}
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileText size={14} />
              <span>Trắc nghiệm</span>
            </div>
            {tracNghiemDisplay()}
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Monitor size={14} />
              <span>Thực hành</span>
            </div>
            {thucHanhDisplay()}
          </div>
        </div>
      </div>

      {!isApproved && (
        <div className="mx-5 mb-3 flex items-center justify-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5">
          <Lock size={14} className="text-gray-500 flex-shrink-0" />
          <span className="text-xs text-gray-600 font-bold">Mở khóa sau {subject.requiredSessions || 0} buổi học</span>
        </div>
      )}

      <div className="px-5 pb-5 pt-2">
        {isLockedCountDown ? (
          <button
            type="button"
            disabled
            className="w-full py-2.5 bg-gray-100 border border-gray-200 text-gray-400 font-bold rounded-xl text-[13px] flex items-center justify-center gap-2 cursor-not-allowed uppercase tracking-wide"
          >
            <Clock size={15} /> Mở khóa sau: {countdown}
          </button>
        ) : !allowStartExam && wouldBeAbleToStart ? (
          <div className="w-full py-2.5 px-3 bg-amber-50 border border-amber-200 text-amber-800 font-semibold rounded-xl text-xs flex items-start justify-center gap-2 text-center leading-snug">
            <Monitor size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>Thi chỉ dành cho máy tính (laptop/desktop). Trên điện thoại/máy tính bảng bạn chỉ xem được điểm.</span>
          </div>
        ) : (
          <>
            {canStart && (
              <button
                type="button"
                onClick={() => onStart(subject.id)}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-red-100"
              >
                {(subject.attemptCount || 0) > 0 ? <><Play size={15} /> Thi lại</> : 'Vào thi ngay'}
              </button>
            )}
            {canRetry && (
               <button
                 type="button"
                 onClick={() => onStart(subject.id)}
                 className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-red-100"
               >
                 <Play size={15} /> Thi lại
               </button>
            )}
            {isOngoing && (
              <button
                type="button"
                onClick={() => onStart(subject.id)}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-orange-100"
              >
                <Play size={15} /> Tiếp tục thi
              </button>
            )}
            {isPassed && (
              <button
                type="button"
                disabled
                className="w-full py-2.5 bg-gray-50 border border-gray-100 text-gray-400 font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
              >
                <CheckCircle size={15} /> Đã hoàn thành
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Score Modal ──────────────────────────────────────────────────────────────
const ScoreModal = ({ subjects, onClose }) => {
  const [activeTab, setActiveTab] = React.useState('cert'); // 'cert' | 'quizzes'
  const [quizzes, setQuizzes] = React.useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = React.useState(false);

  React.useEffect(() => {
    if (activeTab === 'quizzes') {
      setLoadingQuizzes(true);
      api.quizzes.getStudentQuizzes()
        .then((res) => {
          if (res.success) setQuizzes(res.data || []);
        })
        .catch(() => {})
        .finally(() => setLoadingQuizzes(false));
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-white" />
            <h2 className="text-white font-black text-lg">NHẬT KÝ ĐIỂM SỐ CỦA TÔI</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-bold leading-none">×</button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('cert')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
              activeTab === 'cert' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Thi Chứng Nhận Môn
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quizzes')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
              activeTab === 'quizzes' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Trắc Nghệm Giảng Viên Giao
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          {activeTab === 'cert' ? (
            subjects.map(s => {
              const meta = getExamSubjectMeta(s.id);
              const tn = s.tracNghiem;
              const tnPct = tn ? Math.round((tn.score / tn.total) * 100) : null;
              const hasEssay = s.thucHanh === 'da_nop';
              const essayScore = s.essayScore;
              const attempt = s.attemptCount || 0;
              return (
                <div key={s.id} className="rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center`}>
                        <span className="text-white font-black text-sm">{meta.short}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 text-sm">{meta.label}</span>
                        {attempt > 0 && <span className="ml-2 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">Lần {attempt + 1}</span>}
                      </div>
                    </div>
                    {s.status === 'dat' && <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">ĐẠT</span>}
                    {s.status === 'khong_dat' && <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">CHƯA ĐẠT</span>}
                    {(!s.status || s.status === 'chua_thi') && <span className="text-[10px] font-bold text-gray-400">Chưa thi</span>}
                  </div>
                  {(tn || hasEssay) && (
                    <div className="flex border-t border-gray-100 divide-x divide-gray-100">
                      <div className="flex-1 px-4 py-3 text-center">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Trắc nghiệm</p>
                        {tn ? (
                          <>
                            <p className={`text-xl font-black ${tnPct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{tn.score}/{tn.total}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{tnPct}%</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-300 font-bold">--</p>
                        )}
                      </div>
                      <div className="flex-1 px-4 py-3 text-center">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Thực hành</p>
                        {essayScore !== null && essayScore !== undefined ? (
                          <>
                            <p className={`text-xl font-black ${essayScore >= 5 ? 'text-green-600' : 'text-red-500'}`}>{essayScore}/10</p>
                            <p className="text-[10px] text-gray-400 font-semibold">Đã chấm</p>
                          </>
                        ) : hasEssay ? (
                          <>
                            <p className="text-sm font-bold text-amber-500">⏳</p>
                            <p className="text-[10px] text-amber-500 font-semibold">Chờ chấm</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-300 font-bold">--</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            loadingQuizzes ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">Đang tải nhật ký điểm số...</div>
            ) : quizzes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">Chưa có nhật ký bài trắc nghiệm nào từ Giảng viên.</div>
            ) : (
              quizzes.map((q) => {
                const sub = q.mySubmission;
                const isPassed = sub?.status === 'passed' || (sub?.score != null && sub.score >= 70);
                return (
                  <div key={q._id} className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {q.courseName || 'Bài thi bài học'}
                      </span>
                      {sub ? (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Chưa làm</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{q.title}</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Giảng viên: {q.teacherName || 'GV'}</p>
                    </div>
                    {sub && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                        <span className="text-slate-500 font-medium">
                          Nộp lúc: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '---'}
                        </span>
                        <span className={`font-black text-sm ${isPassed ? 'text-emerald-600' : 'text-red-600'}`}>
                          {sub.correctCount ?? 0}/{sub.totalQuestions ?? 0} câu ({sub.score ?? 0}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const StudentExamRoom = ({ onNavigate, onStartExam }) => {
  const [roomTab, setRoomTab] = useState('quiz'); // 'quiz' | 'cert'
  const [showScores, setShowScores] = useState(false);
  const [notifications] = useState(0);
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const allowStartExam = useIsDesktopExamDevice();

  // Lấy thông tin HV và tiến độ thi từ DataContext
  const { students, updateStudent, examSubjectsCatalog } = useData();
  const session = (() => { try { return JSON.parse(localStorage.getItem('student_user') || '{}'); } catch { return {}; } })();
  const student = students.find(
    (s) => String(s.id) === String(session.id) || String(s._id) === String(session.id)
  );

  const enrollments = useMemo(() => getClientEnrollments(student), [student]);

  const courseOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'Tất cả khóa học' }];
    enrollments.forEach((e) => {
      const name = e.courseName || e.name;
      if (name && !opts.some((o) => o.value === name)) {
        opts.push({ value: name, label: name });
      }
    });
    if (opts.length === 1 && student?.course) {
      opts.push({ value: student.course, label: student.course });
    }
    return opts;
  }, [enrollments, student?.course]);

  // Tiến độ thi per-student: theo các khóa đang học
  const studentSubjectIds = useMemo(
    () => getSubjectIdsForStudent(enrollments, student?.course, examSubjectsCatalog),
    [enrollments, student?.course, examSubjectsCatalog]
  );

  const buildSubjects = React.useCallback(
    (ep) => buildExamSubjectsFromProgress(ep, studentSubjectIds),
    [studentSubjectIds]
  );

  const [subjects, setSubjects] = useState(() => buildSubjects(student?.examProgress));

  React.useEffect(() => {
    setSubjects(buildSubjects(student?.examProgress));
  }, [student?.examProgress, buildSubjects]);

  const progressScope = useMemo(() => {
    if (filterCourse === 'all') {
      return {
        completedSessions: student?.completedSessions || 0,
        totalSessions: student?.totalSessions || 12,
      };
    }
    const enr = enrollments.find((e) => (e.courseName || e.name) === filterCourse);
    return {
      completedSessions: enr?.completedSessions ?? student?.completedSessions ?? 0,
      totalSessions: enr?.totalSessions ?? student?.totalSessions ?? 12,
    };
  }, [filterCourse, enrollments, student?.completedSessions, student?.totalSessions]);

  // Luồng 2: Mở khóa dựa trên tỷ lệ "cuốn chiếu" Milestone
  const { completedSessions, totalSessions } = progressScope;

  const allowedSubjectIds = useMemo(
    () => getSubjectIdsForCourseFilter(enrollments, filterCourse, student?.course, examSubjectsCatalog),
    [filterCourse, enrollments, student?.course, examSubjectsCatalog]
  );

  // Luồng 1: Admin mở khóa theo từng khóa học (fallback root studentExamUnlocked)
  const isSubjectCourseUnlocked = useMemo(() => {
    const map = {};
    allowedSubjectIds.forEach((id) => {
      map[id] = isExamUnlockedForSubject(
        enrollments,
        id,
        examSubjectsCatalog,
        student?.studentExamUnlocked === true
      );
    });
    return map;
  }, [allowedSubjectIds, enrollments, examSubjectsCatalog, student?.studentExamUnlocked]);

  const subjectFilterOptions = useMemo(
    () => allowedSubjectIds.map((id) => ({ id, label: getExamSubjectMeta(id, examSubjectsCatalog).label })),
    [allowedSubjectIds, examSubjectsCatalog]
  );

  React.useEffect(() => {
    if (filterSubject !== 'all' && !allowedSubjectIds.includes(filterSubject)) {
      setFilterSubject('all');
    }
  }, [filterCourse, allowedSubjectIds, filterSubject]);

  const scopedSubjects = useMemo(
    () => subjects.filter((s) => allowedSubjectIds.includes(s.id)),
    [subjects, allowedSubjectIds]
  );

  const subjectsWithMilestones = useMemo(() => {
    const count = Math.max(1, scopedSubjects.length);
    const interval = Math.max(1, Math.floor(totalSessions / count));
    return scopedSubjects.map((subj, idx) => ({
      ...subj,
      requiredSessions: interval * (idx + 1),
      meetsMilestone: completedSessions >= interval * (idx + 1),
    }));
  }, [scopedSubjects, totalSessions, completedSessions]);

  const filteredSubjects = useMemo(() => {
    return subjectsWithMilestones.filter((subj) => {
      if (filterSubject !== 'all' && subj.id !== filterSubject) return false;
      if (filterStatus !== 'all' && resolveExamFilterStatus(subj) !== filterStatus) return false;
      return true;
    });
  }, [subjectsWithMilestones, filterSubject, filterStatus]);

  const statusCounts = useMemo(() => ({
    all: subjectsWithMilestones.length,
    chua_thi: subjectsWithMilestones.filter((s) => resolveExamFilterStatus(s) === 'chua_thi').length,
    da_thi: subjectsWithMilestones.filter((s) => resolveExamFilterStatus(s) === 'da_thi').length,
    rot: subjectsWithMilestones.filter((s) => resolveExamFilterStatus(s) === 'rot').length,
  }), [subjectsWithMilestones]);

  const handleStart = (subjectId) => {
    if (!allowStartExam) return;
    if (onStartExam) onStartExam(subjectId);
  };




  return (
    <div className="bg-transparent font-sans h-full">
      {/* Navbar removed - using DashboardLayout header */}
      <div className="pt-6"></div>

      {/* ── Main Content ── */}
      <div className="w-full px-2 sm:px-6 py-6 text-left">
        {/* TAB SWITCHER */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
          <button
            type="button"
            onClick={() => setRoomTab('quiz')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              roomTab === 'quiz'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Trophy size={16} /> Trắc nghiệm buổi học (Giảng viên)
          </button>
          <button
            type="button"
            onClick={() => setRoomTab('cert')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              roomTab === 'cert'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Monitor size={16} /> Thi chứng nhận môn học
          </button>
        </div>

        {roomTab === 'quiz' ? (
          <StudentQuizList />
        ) : (
          <>
            {/* Page Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-black text-gray-800">Danh sách môn thi chứng nhận</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {filterCourse === 'all'
                    ? `${allowedSubjectIds.length} môn thi từ ${Math.max(enrollments.length, 1)} khóa đã đăng ký`
                    : `${allowedSubjectIds.length} môn thi của khóa "${filterCourse}"`}
                  {' · '}Hệ thống sẽ tự động giám sát qua Camera.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScores(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-red-100 self-start sm:self-auto"
              >
                <Trophy size={16} /> XEM ĐIỂM CỦA TÔI
              </button>
            </div>

        {!allowStartExam && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-900">
            <Monitor size={18} className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Thi chỉ dành cho máy tính (laptop/desktop)</p>
              <p className="text-xs mt-1 leading-relaxed text-amber-800/90">
                Trên điện thoại và máy tính bảng bạn vẫn xem được điểm, trạng thái môn thi. Để làm bài thi, vui lòng dùng laptop hoặc máy tính để bàn.
              </p>
            </div>
          </div>
        )}

        {/* Bộ lọc */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-black text-gray-700 uppercase tracking-wide">
            <Filter size={16} className="text-blue-600" />
            Lọc danh sách
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Khóa học</label>
              <CmsSelect
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:border-blue-400 outline-none"
              >
                {courseOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </CmsSelect>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Môn thi</label>
              <CmsSelect
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:border-blue-400 outline-none"
              >
                <option value="all">Tất cả môn thi</option>
                {subjectFilterOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </CmsSelect>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Trạng thái</label>
              <CmsSelect
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:border-blue-400 outline-none"
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </CmsSelect>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {STATUS_FILTERS.filter((f) => f.value !== 'all').map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilterStatus(filterStatus === f.value ? 'all' : f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border transition-all ${
                  filterStatus === f.value
                    ? f.value === 'rot'
                      ? 'bg-red-600 text-white border-red-600'
                      : f.value === 'da_thi'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-red-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label} ({statusCounts[f.value] || 0})
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Hiển thị <span className="font-black text-gray-800">{filteredSubjects.length}</span>
            {' / '}
            <span className="font-black text-gray-800">{allowedSubjectIds.length}</span> môn thi
            {filterCourse !== 'all' ? ` · Khóa: ${filterCourse}` : ''}
          </p>
        </div>

        {/* Subject Cards Grid */}
        {filteredSubjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredSubjects.map(s => (
            <SubjectCard key={s.id} subject={s} onStart={handleStart} isGlobalApproved={!!isSubjectCourseUnlocked[s.id]} examSubjectsCatalog={examSubjectsCatalog} allowStartExam={allowStartExam} />
          ))}
        </div>
        ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-bold text-gray-600">Không có môn thi phù hợp bộ lọc</p>
          <p className="text-sm text-gray-400 mt-1">
            {filterCourse !== 'all' && allowedSubjectIds.length === 0
              ? 'Khóa học này chưa có bài thi trên hệ thống.'
              : 'Thử đổi khóa học, môn thi hoặc trạng thái lọc.'}
          </p>
          <button
            type="button"
            onClick={() => { setFilterCourse('all'); setFilterSubject('all'); setFilterStatus('all'); }}
            className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-blue-100"
          >
            Xóa bộ lọc
          </button>
        </div>
        )}

            {/* Info Banner */}
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
              <BarChart2 size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-700">Điều kiện đạt môn thi</p>
                <p className="text-xs text-blue-600 mt-1">Trắc nghiệm: đạt tối thiểu 50% số câu · Thực hành: nộp file đúng định dạng · Cả hai phần phải đạt mới tính qua môn.</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Score Modal ── */}
      {showScores && <ScoreModal subjects={subjects} onClose={() => setShowScores(false)} />}
    </div>
  );
};

export default StudentExamRoom;
