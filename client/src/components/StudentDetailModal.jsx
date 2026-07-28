import React, { useState, useEffect } from 'react';
import CmsSelect from './ui/CmsSelect';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import {
  X, User, BookOpen, Clock, DollarSign, Trophy, 
  MapPin, Phone, MessageSquare, Calendar, ChevronRight,
  TrendingUp, CreditCard, ClipboardList, ShieldCheck, 
  Printer, Loader2, AlertCircle, CheckCircle2, Star,
  Smartphone, Hash, ArrowUpRight, Building2, Plus, Download
} from 'lucide-react';
import api from '../services/api';
import { useModal } from '../utils/Modal.jsx';
import { useData } from '../context/DataContext';
import { getClientEnrollments } from '../utils/enrollments';
import { teacherMatchesCourse } from '../utils/examSubjects';

const fmt = (n) => n ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
const fmtDateTimeVN = (input) => {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function StudentDetailModal({ studentId, onClose }) {
  const [loading, setLoading]     = useState(true);
  const [data, setData]           = useState(null);
  const { showModal }             = useModal();
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'attendance' | 'finance' | 'academic'

  const { updateStudent, assignTeacher, teachers } = useData() || {};
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [newEnr, setNewEnr] = useState({ courseName: '', teacherId: '', price: 0, totalSessions: 12 });

  const reloadProfile = () => {
    if (!studentId) return;
    setLoading(true);
    api.students.getFullDetail(studentId)
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  };

  const handleAssignEnrollmentTeacher = async (enrollmentId, teacherId) => {
    const sid = data?.student?._id || data?.student?.id || studentId;
    const enrParam = enrollmentId && enrollmentId !== 'main' ? enrollmentId : undefined;
    try {
      await assignTeacher?.(sid, teacherId || null, enrParam);
      reloadProfile();
    } catch { /* ignore */ }
  };

  const handleAddEnrollment = async () => {
    const sid = data?.student?._id || data?.student?.id || studentId;
    if (!newEnr.courseName?.trim()) return;
    try {
      const res = await api.students.addEnrollment(sid, {
        courseName: newEnr.courseName.trim(),
        teacherId: newEnr.teacherId || undefined,
        price: Number(newEnr.price) || 0,
        totalSessions: Number(newEnr.totalSessions) || 12,
      });
      if (res?.success) {
        setShowAddEnrollment(false);
        setNewEnr({ courseName: '', teacherId: '', price: 0, totalSessions: 12 });
        reloadProfile();
      }
    } catch { /* ignore */ }
  };
  const handleUnlockExams = async () => {
    if (!data.student || !data.student.examProgress || !updateStudent) return;
    const newProgress = data.student.examProgress.map(s => {
      if (s.lockUntil) {
         return { ...s, lockUntil: null };
      }
      return s;
    });
    
    try {
      await updateStudent(data.student._id || data.student.id, { examProgress: newProgress });
      setData({ ...data, student: { ...data.student, examProgress: newProgress } });
      showModal({
        title: 'Thành công',
        content: 'Đã gỡ bỏ đếm ngược 7 ngày! Học viên có thể thi lại ngay.',
        type: 'success'
      });
    } catch (err) {}
  };

  const toggleWebcam = async () => {
    if (!updateStudent || !data?.student) return;
    const newVal = data.student.requireWebcam === false ? true : false;
    try {
      await updateStudent(data.student._id || data.student.id, { requireWebcam: newVal });
      setData({ ...data, student: { ...data.student, requireWebcam: newVal } });
    } catch (err) {}
  };

  const toggleExamUnlocked = async () => {
    if (!updateStudent || !data?.student) return;
    const newVal = !data.student.studentExamUnlocked;
    try {
      await updateStudent(data.student._id || data.student.id, { studentExamUnlocked: newVal });
      setData({ ...data, student: { ...data.student, studentExamUnlocked: newVal } });
    } catch (err) {}
  };

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    api.students.getFullDetail(studentId)
      .then(res => {
        if (res.success) {
          setData(res.data);
          // Auto fetch assignments for the course
          if (res.data.student?.course) {
            fetchAssignments(res.data.student.course);
          }
        }
      })
      .catch(err => void 0)
      .finally(() => setLoading(false));
  }, [studentId]);

  const [assignments, setAssignments] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [showAddAssign, setShowAddAssign] = useState(false);
  const [newAssign, setNewAssign] = useState({ title: '', deadline: '', fileUrl: '', description: '' });

  const fetchAssignments = async (course) => {
    setLoadingAssign(true);
    try {
      const res = await api.assignments.getByStudentAndCourse(studentId, course);
      if (res.success) setAssignments(res.data);
    } catch (err) { void 0 }
    finally { setLoadingAssign(false); }
  };

  const handleAddAssignment = async () => {
    if (!newAssign.title || !newAssign.deadline) return;
    try {
      const res = await api.assignments.create({
        ...newAssign,
        courseId: data.student.course,
        teacherId: data.student.teacherId?._id || 'admin', // default to admin or current teacher
        studentId: data.student._id || data.student.id || studentId,
      });
      if (res.success) {
        setShowAddAssign(false);
        setNewAssign({ title: '', deadline: '', fileUrl: '', description: '' });
        fetchAssignments(data.student.course);
      }
    } catch (err) { void 0 }
  };

  if (!studentId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hồ sơ học viên"
        className="bg-[#f8fafc] w-full sm:max-w-5xl h-[min(96dvh,920px)] sm:h-[90vh] rounded-t-2xl sm:rounded-[24px] shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 border border-white/20 pb-[env(safe-area-inset-bottom,0px)]"
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg transform rotate-45 animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-semibold text-indigo-900/50">Đang tải hồ sơ...</p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-2 p-6">
            <AlertCircle size={40} />
            <p className="font-bold text-center">Lỗi tải dữ liệu. Vui lòng thử lại sau.</p>
            <button type="button" onClick={onClose} className="mt-4 min-h-11 px-6 py-2 bg-slate-200 rounded-xl font-bold text-slate-700">Đóng</button>
          </div>
        ) : (
          <>
            {/* ── HEADER ────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-100 px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5 relative shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors shadow-sm"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5 pr-12">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border-2 border-white overflow-hidden">
                    <img
                      src={resolveAvatarUrl({ avatar: data.student?.avatar, role: 'student' })}
                      className="w-full h-full object-cover"
                      alt={data.student?.name || 'avatar'}
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-lg border-2 border-white shadow">
                    <ShieldCheck size={12} />
                  </div>
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left space-y-2.5 w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate max-w-full">
                      {data.student.name}
                    </h2>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                      data.student.paid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {data.student.paid ? 'Đã thanh toán' : 'Chưa đóng phí'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-semibold border border-indigo-100 max-w-full truncate">
                      {data.student.course}
                    </span>
                    {(data.student.courses?.length > 1 || data.student.enrollments?.length > 1) && (
                      <span className="px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg text-[11px] font-semibold border border-sky-100 shrink-0">
                        {(data.student.courses || data.student.enrollments).length} khóa học
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] text-slate-600 font-medium">
                    <div className="flex items-center gap-2 min-w-0 justify-center sm:justify-start">
                      <Smartphone size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate font-mono">{data.student.phone || data.student.zalo || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 justify-center sm:justify-start">
                      <Building2 size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">Chi nhánh: {data.student.branchCode || 'Hệ thống'}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 justify-center sm:justify-start">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">Đăng ký: {fmtDate(data.student.createdAt)}</span>
                    </div>
                    {data.student.createdByName && (
                      <div className="flex items-center gap-2 min-w-0 justify-center sm:justify-start">
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          Người tạo: <strong className="text-slate-700">{data.student.createdByName}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── TABS — scroll ngang trên mobile ───────────────────────── */}
            <div className="bg-white border-b border-slate-100 shrink-0">
              <div className="flex gap-1 px-3 sm:px-6 overflow-x-auto overscroll-x-contain hide-scrollbar scroll-smooth">
                {[
                  { id: 'summary', label: 'Tổng quan', icon: ClipboardList },
                  { id: 'attendance', label: 'Lịch học', icon: Clock },
                  { id: 'assignments', label: 'Bài tập', icon: BookOpen },
                  { id: 'finance', label: 'Tài chính', icon: CreditCard },
                  { id: 'academic', label: 'Điểm số', icon: Trophy },
                ].map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 shrink-0 min-h-12 px-3 sm:px-4 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'text-indigo-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <tab.icon size={15} className="shrink-0" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
            <div className={`flex-1 min-h-0 p-4 sm:p-6 md:p-8 ${activeTab === 'academic' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              
              {/* --- TAB 1: SUMMARY --- */}
              {activeTab === 'summary' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatBox 
                      label="Tiến độ học tập" 
                      value={`${data.student.progressPercent || 0}%`} 
                      icon={TrendingUp} 
                      color="bg-indigo-600" 
                      sub={`${data.student.completedSessions || 0}/${data.student.totalSessions || 12} buổi`}
                    />
                    <StatBox 
                      label="Số buổi còn lại" 
                      value={data.student.remainingSessions || 0} 
                      icon={Clock} 
                      color="bg-amber-500" 
                    />
                    <StatBox 
                      label="Học phí gốc" 
                      value={fmt(data.student.price)} 
                      icon={DollarSign} 
                      color="bg-emerald-600" 
                    />
                    <StatBox 
                      label="Điểm trung bình" 
                      value={data.student.avgGrade || '—'} 
                      icon={Star} 
                      color="bg-violet-500" 
                      sub="Tổng hợp bài tập"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* LEFT: Progress Breakdown */}
                    <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                       <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider mb-6 flex items-center justify-between">
                         Trạng thái đào tạo
                         <ChevronRight size={16} className="text-slate-300" />
                       </h3>
                       <div className="space-y-6">
                          <div>
                             <div className="flex justify-between items-end mb-2">
                               <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">Hoàn thành khóa học</p>
                               <p className="text-xl font-black text-indigo-600">{data.student.progressPercent || 0}%</p>
                             </div>
                             <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 ease-out shadow-lg" 
                                  style={{ width: `${data.student.progressPercent || 0}%` }}
                                />
                             </div>
                          </div>
                           <div className="grid grid-cols-2 gap-4 pt-4">
                             <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                <p className="text-[10px] font-black text-indigo-900/40 uppercase mb-1">Giảng viên phụ trách</p>
                                <p className="text-sm font-black text-indigo-900">{data.student.teacherId?.name || 'Chưa gán'}</p>
                             </div>
                             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Trạng thái hiện tại</p>
                                <p className="text-sm font-black text-slate-700">{data.student.status}</p>
                             </div>
                          </div>

                          {/* Danh sách khóa học (đa môn) */}
                          {(() => {
                            const enrollments = getClientEnrollments(data.student);
                            if (enrollments.length === 0) return null;
                            const activeTeachers = (teachers || []).filter((t) => String(t.status || '').toLowerCase() === 'active');
                            const splitTeachers = (courseOrEnr) => {
                              const matched = [];
                              const other = [];
                              for (const t of activeTeachers) {
                                if (teacherMatchesCourse(t, courseOrEnr)) matched.push(t);
                                else other.push(t);
                              }
                              return { matched, other };
                            };
                            return (
                              <div className="pt-6 mt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2">
                                    <BookOpen size={14} className="text-indigo-500" /> Các khóa học đang theo
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => setShowAddEnrollment((v) => !v)}
                                    className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <Plus size={12} /> Thêm khóa
                                  </button>
                                </div>
                                {showAddEnrollment && (
                                  <div className="mb-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                      placeholder="Tên khóa học"
                                      value={newEnr.courseName}
                                      onChange={(e) => setNewEnr((f) => ({ ...f, courseName: e.target.value }))}
                                      className="py-2 px-3 rounded-xl border border-blue-200 text-sm font-bold"
                                    />
                                    <CmsSelect
                                      value={newEnr.teacherId}
                                      onChange={(e) => setNewEnr((f) => ({ ...f, teacherId: e.target.value }))}
                                      className="py-2 px-3 rounded-xl border border-blue-200 text-sm font-bold"
                                    >
                                      <option value="">Giảng viên</option>
                                      {(() => {
                                        const { matched, other } = splitTeachers(newEnr.courseName);
                                        return (
                                          <>
                                            {matched.map((t) => (
                                              <option key={t.id || t._id} value={String(t.id || t._id)}>{t.name}</option>
                                            ))}
                                            {other.map((t) => (
                                              <option key={t.id || t._id} value={String(t.id || t._id)} disabled>{t.name} (khác môn)</option>
                                            ))}
                                          </>
                                        );
                                      })()}
                                    </CmsSelect>
                                    <input
                                      type="number"
                                      placeholder="Học phí"
                                      value={newEnr.price}
                                      onChange={(e) => setNewEnr((f) => ({ ...f, price: e.target.value }))}
                                      className="py-2 px-3 rounded-xl border border-blue-200 text-sm font-bold"
                                    />
                                    <input
                                      type="number"
                                      placeholder="Số buổi"
                                      value={newEnr.totalSessions}
                                      onChange={(e) => setNewEnr((f) => ({ ...f, totalSessions: e.target.value }))}
                                      className="py-2 px-3 rounded-xl border border-blue-200 text-sm font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleAddEnrollment}
                                      className="sm:col-span-2 py-2 rounded-xl bg-blue-600 text-white text-xs font-black"
                                    >
                                      Lưu khóa học mới
                                    </button>
                                  </div>
                                )}
                                <div className="space-y-3">
                                  {enrollments.map((enr) => {
                                    const enrId = enr.enrollmentId || enr.id;
                                    const progress = enr.totalSessions
                                      ? Math.round(((enr.completedSessions || 0) / enr.totalSessions) * 100)
                                      : 0;
                                    return (
                                      <div key={enrId} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-black text-slate-900 truncate">
                                            {enr.courseName || enr.name}
                                            {enr.isPrimary && <span className="ml-2 text-[9px] text-indigo-500 font-black">CHÍNH</span>}
                                          </p>
                                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                            {enr.completedSessions || 0}/{enr.totalSessions || 12} buổi · {progress}% · {fmt(enr.price)}
                                          </p>
                                        </div>
                                        <CmsSelect
                                          value={enr.teacherId || ''}
                                          onChange={(e) => handleAssignEnrollmentTeacher(enrId, e.target.value)}
                                          className="sm:w-44 py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                                        >
                                          <option value="">Chưa phân công GV</option>
                                          {(() => {
                                            const { matched, other } = splitTeachers(enr);
                                            return (
                                              <>
                                                {matched.map((t) => (
                                                  <option key={t.id || t._id} value={String(t.id || t._id)}>{t.name}</option>
                                                ))}
                                                {other.map((t) => (
                                                  <option key={t.id || t._id} value={String(t.id || t._id)} disabled>{t.name} (khác môn)</option>
                                                ))}
                                              </>
                                            );
                                          })()}
                                        </CmsSelect>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="pt-6 mt-4 border-t border-slate-100">
                             <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider mb-4 flex items-center gap-2">
                               <ShieldCheck size={14} className="text-indigo-500" /> QUYỀN HẠN HỌC VIÊN
                             </h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={toggleWebcam} className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-full ${data.student.requireWebcam === false ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                   <div className="flex items-center justify-between w-full mb-2">
                                      <p className={`text-xs font-black uppercase tracking-tighter ${data.student.requireWebcam === false ? 'text-amber-700' : 'text-emerald-700'}`}>YÊU CẦU CAMERA</p>
                                      <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${data.student.requireWebcam === false ? 'bg-amber-200' : 'bg-emerald-500'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${data.student.requireWebcam === false ? 'translate-x-0' : 'translate-x-4'}`} />
                                      </div>
                                   </div>
                                   <p className={`text-[10px] font-bold ${data.student.requireWebcam === false ? 'text-amber-600/70' : 'text-emerald-600/70'}`}>
                                      {data.student.requireWebcam === false ? 'Đã tắt. Học viên có thể thi mà không cần webcam.' : 'Đang bật. Yêu cầu bật webcam khi thi.'}
                                   </p>
                                </button>
                                
                                <button onClick={toggleExamUnlocked} className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-full ${data.student.studentExamUnlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                   <div className="flex items-center justify-between w-full mb-2">
                                      <p className={`text-xs font-black uppercase tracking-tighter ${data.student.studentExamUnlocked ? 'text-emerald-700' : 'text-slate-600'}`}>MỞ KHÓA THI TOÀN BỘ</p>
                                      <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${data.student.studentExamUnlocked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${!data.student.studentExamUnlocked ? 'translate-x-0' : 'translate-x-4'}`} />
                                      </div>
                                   </div>
                                   <p className={`text-[10px] font-bold ${data.student.studentExamUnlocked ? 'text-emerald-600/70' : 'text-slate-500/70'}`}>
                                      {data.student.studentExamUnlocked ? 'Đã mở khóa. Có thể làm mọi bài thi.' : 'Đang tắt. Phải tuân theo lộ trình.'}
                                   </p>
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* RIGHT: Quick Timeline */}
                    <div className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                       <h3 className="font-black text-white text-sm uppercase tracking-wider mb-6">Nhật ký mới nhất</h3>
                       <div className="space-y-4">
                          {data.schedules?.slice(0, 3).map((sch, i) => (
                            <div key={sch._id} className="flex gap-4 relative">
                              {i < 2 && <div className="absolute left-2.5 top-6 bottom-0 w-px bg-white/10" />}
                              <div className={`w-5 h-5 rounded-full flex-shrink-0 z-10 border-4 border-slate-900 ${
                                sch.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-700'
                              }`} />
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-emerald-400 uppercase leading-none mb-1">
                                  {fmtDate(sch.date)}
                                </p>
                                <p className="text-xs text-slate-300 font-medium truncate">
                                  {sch.title || sch.course}
                                </p>
                              </div>
                            </div>
                          ))}
                          {(!data.schedules || data.schedules.length === 0) && (
                            <p className="text-xs text-slate-500 italic">Chưa có hoạt động nào</p>
                          )}
                       </div>
                       <button 
                        onClick={() => setActiveTab('attendance')}
                        className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-white/10"
                       >
                         Xem toàn bộ lịch sử
                       </button>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 2: ATTENDANCE --- */}
              {activeTab === 'attendance' && (
                <div className="animate-in slide-in-from-right-10 duration-500">
                  <div className="bg-white rounded-3xl overflow-hidden border border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                        <tr className="bg-slate-50">
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Ngày học</th>
                          {(getClientEnrollments(data.student).length > 1) && (
                            <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Khóa học</th>
                          )}
                          <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Giảng viên</th>
                          <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Nội dung / Ghi chú</th>
                          <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.schedules.map(sch => (
                          <tr key={sch._id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 text-xs font-bold text-slate-700">{fmtDate(sch.date)}</td>
                            {(getClientEnrollments(data.student).length > 1) && (
                              <td className="px-4 py-4 text-xs font-bold text-blue-600">{sch.course || '—'}</td>
                            )}
                            <td className="px-4 py-4 text-xs font-semibold text-slate-600">{sch.teacherName || '—'}</td>
                            <td className="px-4 py-4 text-xs text-slate-400">{sch.note || sch.subject || 'Dạy thực tế'}</td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                sch.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : sch.status === 'cancelled'
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-amber-50 text-amber-600'
                              }`}>
                                {sch.status === 'completed' ? 'Đã học' : sch.status === 'cancelled' ? 'Đã hủy' : 'Sắp tới'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {data.schedules.length === 0 && (
                          <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic text-sm">Chưa có dữ liệu điểm danh</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 3: FINANCE --- */}
              {activeTab === 'finance' && (
                <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="bg-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between h-48">
                        <DollarSign className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10" />
                        <div>
                          <p className="text-[11px] font-black opacity-60 uppercase tracking-widest mb-1">Trạng thái đóng phí</p>
                          <h4 className="text-3xl font-black">{data.student.paid ? 'ĐÃ HOÀN TẤT' : 'CÒN NỢ'}</h4>
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] font-bold opacity-60">Đăng ký ngày</p>
                            <p className="text-sm font-black">{fmtDate(data.student.createdAt)}</p>
                          </div>
                          {!data.student.paid && (
                            <button onClick={() => showModal({ 
                                title: 'Hướng dẫn nghiệp vụ', 
                                content: 'Chức năng "Thu Học Phí" vui lòng thực hiện tại tab "Giao dịch" để đảm bảo tính đồng nhất của dữ liệu kế toán!', 
                                type: 'info' 
                            })} className="bg-white text-emerald-600 px-6 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider hover:bg-emerald-50 transition-all">
                              Thu học phí ngay
                            </button>
                          )}
                        </div>
                     </div>
                     <div className="bg-white rounded-3xl p-8 border border-slate-100 flex flex-col justify-between h-48 shadow-sm">
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền thanh toán</p>
                          <h4 className="text-3xl font-black text-slate-800">{fmt(data.student.price)}</h4>
                        </div>
                        <div className="flex gap-4">
                           <div className="flex-1 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Hình thức</p>
                              <p className="text-xs font-black text-slate-700 capitalize">
                                {data.student.paymentMethod === 'cash' ? 'Tiền mặt' : (data.student.paymentMethod === 'transfer' ? 'Chuyển khoản' : (data.student.paymentMethod || 'Chuyển khoản'))}
                              </p>
                           </div>
                           <div className="flex-1 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Cơ sở</p>
                              <p className="text-xs font-black text-slate-700">{data.student.branchCode || 'Hệ thống'}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider pt-4">Lịch sử hóa đơn</h3>
                  <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                        <tr className="bg-slate-50">
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Mã Hóa đơn</th>
                          <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Ngày tạo</th>
                          <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Nội dung</th>
                          <th className="px-4 py-4 text-right text-[11px] font-black text-slate-400 tracking-widest uppercase">Số tiền</th>
                          <th className="px-6 py-4 text-center text-[11px] font-black text-slate-400 tracking-widest uppercase">In</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.invoices.map(inv => (
                          <tr key={inv._id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4">
                              <span className="text-xs font-black text-indigo-600">{inv.maHoaDon}</span>
                            </td>
                            <td className="px-4 py-4 text-xs font-semibold text-slate-600">{fmtDate(inv.createdAt)}</td>
                            <td className="px-4 py-4 text-xs text-slate-400">{inv.khoaHoc} — {inv.ghiChu || 'Thu phí ghi danh'}</td>
                            <td className="px-4 py-4 text-right font-black text-slate-800 text-sm">{fmt(inv.hocPhi)}</td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => window.print()} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 inline-flex items-center justify-center transition-all">
                                <Printer size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {data.invoices.length === 0 && (
                          <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic text-sm">Chưa phát sinh hóa đơn nào</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}
                {/* --- TAB: ASSIGNMENTS --- */}
                {activeTab === 'assignments' && (
                  <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-500" /> Danh sách bài tập được giao
                      </h3>
                      <button 
                        onClick={() => setShowAddAssign(!showAddAssign)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Plus size={14} /> GIAO BÀI TẬP MỚI
                      </button>
                    </div>

                    {showAddAssign && (
                      <div className="bg-white rounded-3xl p-6 border-2 border-indigo-100 shadow-xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-indigo-50 pb-3">
                           <p className="text-xs font-black text-indigo-700 uppercase tracking-widest">Thiết lập bài tập ({data?.student?.course})</p>
                           <button onClick={() => setShowAddAssign(false)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tiêu đề bài tập</label>
                            <input 
                              type="text" value={newAssign.title} 
                              onChange={e => setNewAssign({...newAssign, title: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-indigo-500 outline-none"
                              placeholder="VD: Thực hành Excel Buổi 3"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Ngày quy định (Deadline)</label>
                            <input 
                              type="date" value={newAssign.deadline} 
                              onChange={e => setNewAssign({...newAssign, deadline: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-indigo-500 outline-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Link tài liệu / đề bài (File URL)</label>
                            <input 
                              type="text" value={newAssign.fileUrl} 
                              onChange={e => setNewAssign({...newAssign, fileUrl: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:border-indigo-500 outline-none font-mono"
                              placeholder="Dán link file đề bài (Google Drive, v.v...)"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Ghi chú hướng dẫn</label>
                            <textarea 
                              value={newAssign.description}
                              onChange={e => setNewAssign({...newAssign, description: e.target.value})}
                              rows={2}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-indigo-500 outline-none resize-none"
                              placeholder="Các yêu cầu cụ thể đối với bài tập này..."
                            />
                          </div>
                        </div>
                        <button 
                          onClick={handleAddAssignment}
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                        >
                          XÁC NHẬN GIAO BÀI
                        </button>
                      </div>
                    )}

                    <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                          <thead>
                            <tr className="bg-slate-50">
                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Bài tập</th>
                            <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase">Thời hạn</th>
                            <th className="px-4 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase text-center">Tiến độ</th>
                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 tracking-widest uppercase text-center">Kết quả</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {loadingAssign ? (
                            <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-400" /></td></tr>
                          ) : assignments.length === 0 ? (
                            <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic text-sm">Chưa có bài tập nào được giao</td></tr>
                          ) : assignments.map(a => {
                            const sub = a.mySubmission;
                            const isLate = new Date() > new Date(a.deadline) && !sub;
                            return (
                              <tr key={a._id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4">
                                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-0.5">{a.title}</p>
                                  <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{a.description || 'Không có mô tả'}</p>
                                  {(a.fileUrl || a.attachedFileUrl) && (
                                    <a href={(a.fileUrl || a.attachedFileUrl)} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 mt-1 hover:underline">
                                      <Download size={10} /> Tải đề bài
                                    </a>
                                  )}
                                  {(a.assignedByRole || a.assignedByName) && (
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                                      Giao bởi: <span className="text-slate-600">
                                        {a.assignedByName || (String(a.assignedByRole).toLowerCase() === 'teacher' ? 'Giảng viên' : 'Admin')}
                                      </span>
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <p className={`text-[11px] font-black ${isLate ? 'text-red-500' : 'text-slate-600'}`}>
                                    {new Date(a.deadline).toLocaleDateString('vi-VN')}
                                  </p>
                                  {isLate && <span className="text-[9px] font-black text-red-400 uppercase leading-none">Quá hạn</span>}
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm border ${
                                    sub 
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                      : isLate ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                  }`}>
                                    {sub ? '✅ ĐÃ NỘP' : isLate ? '❌ TRỄ HẠN' : '⏳ CHƯA DÀNH'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                   {sub?.status === 'graded' ? (
                                      <div className="flex flex-col items-center">
                                         <p className="text-xl font-black text-indigo-600 leading-none">{sub.grade}</p>
                                         <span className="text-[8px] font-black text-indigo-300 uppercase">Đã chấm</span>
                                      </div>
                                   ) : sub ? (
                                      <span className="text-[10px] font-black text-slate-400 uppercase italic">Chờ chấm</span>
                                   ) : (
                                      <span className="text-[10px] font-black text-slate-300 uppercase">—</span>
                                   )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                )}

              {/* --- TAB 4: ACADEMIC --- */}
              {activeTab === 'academic' && (
                <div className="h-full min-h-0 flex flex-col animate-in slide-in-from-right-10 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                    {/* Kết quả thi cử */}
                    <div className="flex flex-col min-h-0">
                       <div className="flex items-center justify-between shrink-0">
                         <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                           <Trophy size={16} className="text-amber-500" /> Kết quả thi tốt nghiệp
                         </h3>
                         {(data.student.examProgress || []).some(ep => ep.lockUntil && ep.lockUntil > Date.now()) && (
                           <button onClick={handleUnlockExams} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1">
                             <Clock size={12} /> MỞ KHÓA THI LẠI
                           </button>
                         )}
                       </div>
                       <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pt-2 pr-1 mt-2">
                          {(data.student.examProgress || []).filter(ep => ep.status && ep.status !== 'chua_thi').length === 0 ? (
                            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 border-dashed text-center">
                               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Học viên chưa tham gia kỳ thi nào</p>
                            </div>
                          ) : (() => {
                              const SL = { coban: 'Máy vi tính (Cơ bản)', word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint' };
                              return (data.student.examProgress || []).filter(ep => ep.status && ep.status !== 'chua_thi').map(ep => {
                                const tn = ep.tracNghiem || {};
                                const pct = tn.total > 0 ? Math.round(((tn.score || 0) / tn.total) * 100) : 0;
                                const isDat = ep.status === 'dat';
                                const isKhongDat = ep.status === 'khong_dat';
                                return (
                                  <div key={ep.id || ep._id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
                                     <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDat ? 'bg-emerald-50 text-emerald-500' : isKhongDat ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                                           <Trophy size={20} />
                                        </div>
                                        <div>
                                           <p className="text-sm font-black text-slate-800">{SL[ep.id] || ep.id}</p>
                                           <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDat ? 'bg-emerald-50 text-emerald-600' : isKhongDat ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                                             {isDat ? 'ĐẠT' : isKhongDat ? 'RỚT' : 'ĐANG THI'}
                                           </span>
                                        </div>
                                     </div>
                                     <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Trắc nghiệm</p>
                                           <p className={`text-xl font-black ${pct >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{tn.score || 0}/{tn.total || 15}</p>
                                           <p className="text-[9px] text-slate-400 font-bold">{pct}%</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tự luận</p>
                                           <p className="text-sm font-black text-slate-600">{ep.thucHanh === 'da_nop' ? 'Đã nộp' : 'Chưa nộp'}</p>
                                           {ep.essayScore != null && <p className={`text-lg font-black ${ep.essayScore >= 5 ? 'text-emerald-600' : 'text-red-500'}`}>{ep.essayScore}/10</p>}
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Khóa đến</p>
                                           {ep.lockUntil && ep.lockUntil > Date.now() ? (
                                             <p className="text-xs font-black text-red-500">{new Date(ep.lockUntil).toLocaleDateString('vi-VN')}</p>
                                           ) : (
                                             <p className="text-xs font-bold text-slate-300">—</p>
                                           )}
                                        </div>
                                     </div>
                                  </div>
                                );
                              });
                            })()}
                       </div>
                    </div>

                    {/* Đánh giá bài tập hàng ngày */}
                    <div className="flex flex-col min-h-0">
                       <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2 shrink-0">
                         <ClipboardList size={16} className="text-indigo-500" /> Tiến độ bài tập
                       </h3>
                       <div className="flex-1 min-h-0 max-h-[52vh] md:max-h-none overflow-y-auto overscroll-contain bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 mt-2">
                          {(!data.student.grades || data.student.grades.length === 0) ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">Chưa có đánh giá bài tập</p>
                          ) : (
                            data.student.grades.map((g, i) => (
                              <div key={i} className="flex gap-4">
                                 <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">
                                       {g.grade}
                                    </div>
                                    {i < data.student.grades.length - 1 && <div className="w-px h-full bg-slate-100 my-1" />}
                                 </div>
                                 <div className="flex-1 pb-4">
                                   <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                                     {g.date ? fmtDateTimeVN(g.date) : 'Giai đoạn học'}
                                   </p>
                                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">{g.note}</p>
                                 </div>
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* ── FOOTER ACTIONS ───────────────────────────────────────────── */}
            <div className="bg-white border-t border-slate-100 px-3 py-3 sm:px-6 sm:py-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-2 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => window.open(`http://zalo.me/${data.student.zalo || data.student.phone}`, '_blank')}
                    className="min-h-12 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <MessageSquare size={15} className="text-indigo-500 shrink-0" />
                    Nhắn tin
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-12 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Printer size={15} className="text-slate-400 shrink-0" />
                    In tất cả
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {!data.student.paid && (
                    <p className="text-[12px] font-semibold text-red-500 flex items-center gap-1 shrink-0">
                      <AlertCircle size={14} /> Còn nợ: {fmt(data.student.price)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-12 flex-1 sm:flex-none px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-600 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    Hoàn tất xem
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

{/* Helper UI Components */}
function StatBox({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm relative overflow-hidden">
       <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
       <div className="flex items-start justify-between gap-3 pl-1">
          <div className="space-y-1 min-w-0">
             <p className="text-[11px] font-semibold text-slate-500">{label}</p>
             <h4 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{value}</h4>
             {sub && <p className="text-[11px] text-slate-400 font-medium">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white shrink-0`}>
             <Icon size={18} />
          </div>
       </div>
    </div>
  );
}
