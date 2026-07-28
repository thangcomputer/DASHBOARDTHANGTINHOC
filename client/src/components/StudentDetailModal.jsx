import React, { useState, useEffect } from 'react';
import CmsSelect from './ui/CmsSelect';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import {
  X, User, BookOpen, Clock, DollarSign, Trophy, 
  MapPin, Phone, MessageSquare, Calendar, ChevronRight,
  TrendingUp, CreditCard, ClipboardList, ShieldCheck, 
  Printer, Loader2, AlertCircle, CheckCircle2, Star,
  Smartphone, Hash, ArrowUpRight, Building2, Plus, Download, Trash2
} from 'lucide-react';
import api from '../services/api';
import { useModal } from '../utils/Modal.jsx';
import { useData } from '../context/DataContext';
import { getClientEnrollments } from '../utils/enrollments';
import { teacherMatchesCourse } from '../utils/examSubjects';
import AddEnrollmentModal from './admin/shared/AddEnrollmentModal';
import { useToast } from '../utils/toast';

const fmt = (n) => n ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
const fmtTuition = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 10_000_000) {
    const tr = (v / 1_000_000).toLocaleString('vi-VN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    return `${tr} tr`;
  }
  return v.toLocaleString('vi-VN') + 'đ';
};
const enrollmentRemaining = (enr) => {
  if (enr?.remainingSessions != null && enr.remainingSessions !== '') {
    return Math.max(0, Number(enr.remainingSessions) || 0);
  }
  const total = Number(enr?.totalSessions) || 12;
  const done = Number(enr?.completedSessions) || 0;
  return Math.max(0, total - done);
};
const summarizeEnrollments = (list) => {
  const items = Array.isArray(list) ? list : [];
  const isPaid = (e) =>
    e?.paid === true || e?.paid === 'Đã đóng phí' || e?.paid === 'true' || e?.paid === 1;
  const totalSessions = items.reduce((s, e) => s + (Number(e.totalSessions) || 12), 0);
  const completedSessions = items.reduce((s, e) => s + (Number(e.completedSessions) || 0), 0);
  const remainingSessions = items.reduce((s, e) => s + enrollmentRemaining(e), 0);
  const price = items.reduce((s, e) => s + (Number(e.price) || 0), 0);
  const paidPrice = items.filter(isPaid).reduce((s, e) => s + (Number(e.price) || 0), 0);
  const paidCount = items.filter(isPaid).length;
  const progressPercent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const grades = items.map((e) => Number(e.avgGrade)).filter((g) => Number.isFinite(g) && g > 0);
  const avgGrade = grades.length
    ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10
    : null;
  return {
    totalSessions,
    completedSessions,
    remainingSessions,
    price,
    paidPrice,
    paidCount,
    enrollmentCount: items.length,
    progressPercent,
    avgGrade,
  };
};
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
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'attendance' | 'finance' | 'academic'
  const [courseFilter, setCourseFilter] = useState('all'); // 'all' | enrollmentId

  const { updateStudent, assignTeacher, teachers } = useData() || {};
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);

  useEffect(() => {
    setCourseFilter('all');
    setActiveTab('summary');
  }, [studentId]);

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

  const handleAddEnrollmentSubmit = async (payload) => {
    const sid = data?.student?._id || data?.student?.id || studentId;
    if (!sid) return false;
    try {
      const res = await api.students.addEnrollment(sid, payload);
      if (res?.success) {
        toast.success(res.message || 'Đã thêm khóa học');
        reloadProfile();
        return true;
      }
      toast.error(res?.message || 'Không thể thêm khóa học');
      return false;
    } catch {
      toast.error('Lỗi kết nối API');
      return false;
    }
  };

  const handlePayEnrollment = (enr) => {
    const sid = data?.student?._id || data?.student?.id || studentId;
    const enrId = enr.enrollmentId || enr.id;
    if (!sid || !enrId || enrId === 'main') {
      toast.error('Không xác định được khóa học để thanh toán');
      return;
    }
    showModal({
      title: 'Xác nhận thanh toán',
      content: `Xác nhận đã thu học phí khóa "${enr.courseName || enr.name}" — ${fmt(enr.price)}?`,
      type: 'question',
      confirmText: 'Đã thu tiền',
      cancelText: 'Hủy',
      onConfirm: async () => {
        const tid = toast.loading('Đang xác nhận thanh toán...');
        try {
          const res = await api.students.payEnrollment(sid, enrId, { paymentMethod: 'cash' });
          toast.dismiss(tid);
          if (res?.success) {
            toast.success(res.message || 'Đã thanh toán');
            reloadProfile();
          } else {
            toast.error(res?.message || 'Thanh toán thất bại');
          }
        } catch {
          toast.dismiss(tid);
          toast.error('Lỗi kết nối API');
        }
      },
    });
  };

  const handleDeleteEnrollment = (enr) => {
    const sid = data?.student?._id || data?.student?.id || studentId;
    const enrId = enr.enrollmentId || enr.id;
    if (!sid || !enrId || enrId === 'main') {
      toast.error('Không xác định được khóa học để xóa');
      return;
    }
    showModal({
      title: 'Xóa khóa học',
      content: `Xóa khóa "${enr.courseName || enr.name}" khỏi học viên này? Không thể hoàn tác.`,
      type: 'warning',
      confirmText: 'Xóa khóa',
      cancelText: 'Hủy',
      onConfirm: async () => {
        const tid = toast.loading('Đang xóa khóa...');
        try {
          const res = await api.students.deleteEnrollment(sid, enrId);
          toast.dismiss(tid);
          if (res?.success) {
            toast.success(res.message || 'Đã xóa khóa');
            reloadProfile();
          } else {
            toast.error(res?.message || 'Không xóa được khóa');
          }
        } catch {
          toast.dismiss(tid);
          toast.error('Lỗi kết nối API');
        }
      },
    });
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

  const toggleEnrollmentSetting = async (enr, field) => {
    const sid = data?.student?._id || data?.student?.id || studentId;
    const enrId = enr?.enrollmentId || enr?.id;
    if (!sid || !enrId || enrId === 'main') {
      toast.error('Không xác định được khóa học. Thử tải lại trang.');
      return;
    }
    const curWebcam = enr.requireWebcam !== false;
    const curUnlock = enr.examUnlocked === true;
    const payload = field === 'requireWebcam'
      ? { requireWebcam: !curWebcam }
      : { examUnlocked: !curUnlock };
    try {
      const res = await api.students.updateEnrollmentSettings(sid, enrId, payload);
      if (res?.success && res.data) {
        // settings API trả student doc; full-detail bọc trong { student, ... }
        setData((prev) => ({ ...(prev || {}), student: res.data }));
        return;
      }
      toast.error(res?.message || 'Không cập nhật được quyền khóa');
    } catch {
      toast.error('Lỗi kết nối API');
    }
  };

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    api.students.getFullDetail(studentId)
      .then(res => {
        if (res.success) {
          setData(res.data);
        }
      })
      .catch(err => void 0)
      .finally(() => setLoading(false));
  }, [studentId]);

  const [assignments, setAssignments] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [showAddAssign, setShowAddAssign] = useState(false);
  const [newAssign, setNewAssign] = useState({ title: '', deadline: '', fileUrl: '', description: '' });
  const [assignTargetCourse, setAssignTargetCourse] = useState('');

  const liveEnrollments = data?.student ? getClientEnrollments(data.student) : [];
  const liveFilterValid = courseFilter === 'all'
    || liveEnrollments.some((e) => String(e.enrollmentId || e.id) === String(courseFilter));
  const liveCourseFilter = liveFilterValid ? courseFilter : 'all';
  const liveActiveEnrollment = liveCourseFilter !== 'all'
    ? liveEnrollments.find((e) => String(e.enrollmentId || e.id) === String(liveCourseFilter)) || null
    : null;
  const liveAssignCourseName = liveActiveEnrollment
    ? (liveActiveEnrollment.courseName || liveActiveEnrollment.name || '')
    : assignTargetCourse;

  useEffect(() => {
    if (liveActiveEnrollment) {
      setAssignTargetCourse(liveActiveEnrollment.courseName || liveActiveEnrollment.name || '');
      return;
    }
    if (!assignTargetCourse && liveEnrollments[0]) {
      setAssignTargetCourse(liveEnrollments[0].courseName || liveEnrollments[0].name || '');
    }
  }, [liveCourseFilter, liveActiveEnrollment?.enrollmentId, liveActiveEnrollment?.id, liveEnrollments.length]);

  const fetchAssignments = async (course) => {
    if (!studentId || !course) {
      setAssignments([]);
      return;
    }
    setLoadingAssign(true);
    try {
      const res = await api.assignments.getByStudentAndCourse(studentId, course);
      if (res.success) setAssignments(res.data || []);
      else setAssignments([]);
    } catch (err) { void 0; setAssignments([]); }
    finally { setLoadingAssign(false); }
  };

  const fetchAssignmentsForCourses = async (courseNames) => {
    const names = [...new Set((courseNames || []).map((n) => String(n || '').trim()).filter(Boolean))];
    if (!studentId || names.length === 0) {
      setAssignments([]);
      return;
    }
    setLoadingAssign(true);
    try {
      const results = await Promise.all(
        names.map((name) => api.assignments.getByStudentAndCourse(studentId, name).catch(() => null)),
      );
      const merged = [];
      const seen = new Set();
      results.forEach((res) => {
        (res?.success ? res.data : []).forEach((a) => {
          const id = String(a._id || a.id || '');
          if (!id || seen.has(id)) return;
          seen.add(id);
          merged.push(a);
        });
      });
      merged.sort((a, b) => new Date(b.deadline || b.createdAt || 0) - new Date(a.deadline || a.createdAt || 0));
      setAssignments(merged);
    } catch (err) { void 0; setAssignments([]); }
    finally { setLoadingAssign(false); }
  };

  useEffect(() => {
    if (activeTab !== 'assignments' || !studentId || !data?.student) return;
    if (liveCourseFilter === 'all') {
      fetchAssignmentsForCourses(liveEnrollments.map((e) => e.courseName || e.name));
    } else {
      fetchAssignments(liveActiveEnrollment?.courseName || liveActiveEnrollment?.name || '');
    }
  }, [activeTab, studentId, liveCourseFilter, liveActiveEnrollment?.enrollmentId, liveActiveEnrollment?.id, liveEnrollments.length, data?.student?._id]);

  const handleAddAssignment = async () => {
    const courseName = String(
      liveActiveEnrollment
        ? (liveActiveEnrollment.courseName || liveActiveEnrollment.name)
        : assignTargetCourse,
    ).trim();
    if (!courseName) {
      toast.error('Chọn khóa học để giao bài tập');
      return;
    }
    if (!newAssign.title || !newAssign.deadline) {
      toast.error('Nhập tiêu đề và hạn nộp');
      return;
    }
    const enr = liveEnrollments.find(
      (e) => String(e.courseName || e.name).trim() === courseName,
    );
    try {
      const res = await api.assignments.create({
        ...newAssign,
        courseId: courseName,
        teacherId: enr?.teacherId || data?.student?.teacherId?._id || data?.student?.teacherId || 'admin',
        studentId: data?.student?._id || data?.student?.id || studentId,
      });
      if (res.success) {
        setShowAddAssign(false);
        setNewAssign({ title: '', deadline: '', fileUrl: '', description: '' });
        toast.success('Đã giao bài tập');
        if (liveCourseFilter === 'all') {
          fetchAssignmentsForCourses(liveEnrollments.map((e) => e.courseName || e.name));
        } else {
          fetchAssignments(courseName);
        }
      } else {
        toast.error(res?.message || 'Không giao được bài tập');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi giao bài tập');
    }
  };

  if (!studentId) return null;

  const enrollments = data?.student ? getClientEnrollments(data.student) : [];
  const filterIsValid = courseFilter === 'all'
    || enrollments.some((e) => String(e.enrollmentId || e.id) === String(courseFilter));
  const effectiveCourseFilter = filterIsValid ? courseFilter : 'all';
  const scopedEnrollments = effectiveCourseFilter === 'all'
    ? enrollments
    : enrollments.filter((e) => String(e.enrollmentId || e.id) === String(effectiveCourseFilter));
  const summaryMetrics = summarizeEnrollments(scopedEnrollments);
  const activeEnrollment = effectiveCourseFilter !== 'all'
    ? enrollments.find((e) => String(e.enrollmentId || e.id) === String(effectiveCourseFilter)) || null
    : null;
  const enrollmentTeacherNames = [...new Set(
    enrollments.map((e) => String(e.teacherName || '').trim()).filter(Boolean),
  )];
  const statusTeacherName = activeEnrollment
    ? (activeEnrollment.teacherName || 'Chưa gán')
    : (enrollmentTeacherNames.length > 0
      ? enrollmentTeacherNames.join(', ')
      : (data?.student?.teacherId?.name
        || data?.student?.teacherName
        || 'Chưa gán'));
  const statusLabel = activeEnrollment
    ? (activeEnrollment.status === 'completed' || activeEnrollment.status === 'Hoàn thành'
      ? 'Hoàn thành'
      : (activeEnrollment.status === 'active' ? 'Đang học' : (activeEnrollment.status || data?.student?.status || '—')))
    : (data?.student?.status || '—');
  const avgGradeDisplay = summaryMetrics.avgGrade ?? data?.student?.avgGrade ?? '—';
  const financePaidTotal = summaryMetrics.paidPrice > 0
    ? summaryMetrics.paidPrice
    : (Number(data?.student?.paidAmount) > 0 && effectiveCourseFilter === 'all'
      ? Number(data.student.paidAmount)
      : 0);
  const financeListedTotal = summaryMetrics.price;
  const financeAllPaid = summaryMetrics.enrollmentCount > 0
    && summaryMetrics.paidCount >= summaryMetrics.enrollmentCount;
  const financePartialPaid = summaryMetrics.paidCount > 0 && !financeAllPaid;
  const financeStatusLabel = financeAllPaid
    ? 'ĐÃ HOÀN TẤT'
    : financePartialPaid
      ? 'THU MỘT PHẦN'
      : (data?.student?.paid ? 'ĐÃ HOÀN TẤT' : 'CÒN NỢ');

  const invoiceList = Array.isArray(data?.invoices) ? data.invoices : [];
  const paidScopedEnrollments = scopedEnrollments.filter(
    (e) => e.paid === true || e.paid === 'Đã đóng phí' || e.paid === 'true' || e.paid === 1,
  );
  const financeHistory = (() => {
    const rows = invoiceList.map((inv) => ({
      key: String(inv._id || inv.maHoaDon),
      maHoaDon: inv.maHoaDon || '—',
      createdAt: inv.createdAt || inv.ngayXuat,
      khoaHoc: inv.khoaHoc || '—',
      ghiChu: inv.ghiChu || 'Thu học phí',
      hocPhi: Number(inv.hocPhi) || 0,
      synthetic: false,
    }));
    paidScopedEnrollments.forEach((enr, idx) => {
      const courseName = enr.courseName || enr.name || '';
      const amount = Number(enr.price) || 0;
      const matched = rows.some((r) => {
        const sameCourse = String(r.khoaHoc || '').trim().toLowerCase() === String(courseName).trim().toLowerCase();
        const sameAmount = Math.abs(Number(r.hocPhi) - amount) < 1;
        return sameCourse && sameAmount;
      });
      if (matched) return;
      rows.push({
        key: `enr-${enr.enrollmentId || enr.id || idx}`,
        maHoaDon: '—',
        createdAt: enr.paidAt || enr.registeredAt || data?.student?.paidAt,
        khoaHoc: courseName || 'Khóa học',
        ghiChu: 'Thanh toán khóa học',
        hocPhi: amount,
        synthetic: true,
      });
    });
    rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return rows;
  })();

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
                <div className="w-8 h-8 bg-red-600 rounded-lg transform rotate-45 animate-pulse" />
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
            <div
              className="bg-white border-b border-slate-100 px-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5 relative shrink-0"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="absolute z-20 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors shadow-sm"
                style={{
                  top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
                  right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                }}
              >
                <X size={20} />
              </button>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5 pr-14">
                <div className="relative shrink-0 mt-1">
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
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words max-w-full">
                      {data.student.name}
                    </h2>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                      data.student.paid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {data.student.paid ? 'Đã thanh toán' : 'Chưa đóng phí'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-semibold border border-indigo-100 max-w-full whitespace-normal break-words text-left">
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

            {/* ── TABS + Course filter ─────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-100 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 sm:px-6 py-1.5 sm:py-0">
                <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto overscroll-x-contain hide-scrollbar scroll-smooth">
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
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-red-600 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
                {enrollments.length > 1 && (
                  <div className="w-full sm:w-64 shrink-0 pb-2 sm:pb-0">
                    <CmsSelect
                      value={effectiveCourseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      aria-label="Lọc theo khóa học"
                    >
                      <option value="all">Tất cả khóa học ({enrollments.length})</option>
                      {enrollments.map((enr) => {
                        const id = String(enr.enrollmentId || enr.id);
                        return (
                          <option key={id} value={id}>
                            {enr.courseName || enr.name}
                          </option>
                        );
                      })}
                    </CmsSelect>
                  </div>
                )}
              </div>
            </div>

            {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
            <div className={`flex-1 min-h-0 p-4 sm:p-6 md:p-8 ${activeTab === 'academic' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              
              {/* --- TAB 1: SUMMARY --- */}
              {activeTab === 'summary' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <StatBox 
                      label="Tiến độ học tập" 
                      value={`${summaryMetrics.progressPercent}%`} 
                      icon={TrendingUp} 
                      color="bg-red-600" 
                      sub={`${summaryMetrics.completedSessions}/${summaryMetrics.totalSessions || 0} buổi`}
                    />
                    <StatBox 
                      label="Số buổi còn lại" 
                      value={summaryMetrics.remainingSessions} 
                      icon={Clock} 
                      color="bg-amber-500" 
                    />
                    <StatBox 
                      label="Học phí gốc" 
                      value={fmtTuition(summaryMetrics.price)} 
                      icon={DollarSign} 
                      color="bg-emerald-600"
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                    <StatBox 
                      label="Điểm trung bình" 
                      value={avgGradeDisplay === 0 || avgGradeDisplay == null || avgGradeDisplay === '' ? '—' : avgGradeDisplay} 
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
                               <p className="text-xl font-black text-indigo-600">{summaryMetrics.progressPercent}%</p>
                             </div>
                             <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 ease-out shadow-lg" 
                                  style={{ width: `${summaryMetrics.progressPercent}%` }}
                                />
                             </div>
                             <p className="mt-2 text-[11px] font-semibold text-slate-400">
                               {summaryMetrics.completedSessions}/{summaryMetrics.totalSessions} buổi
                               {activeEnrollment
                                 ? ` · ${activeEnrollment.courseName || activeEnrollment.name}`
                                 : (enrollments.length > 1 ? ` · ${enrollments.length} khóa` : '')}
                             </p>
                          </div>
                           <div className="grid grid-cols-2 gap-4 pt-4">
                             <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                <p className="text-[10px] font-black text-indigo-900/40 uppercase mb-1">Giảng viên phụ trách</p>
                                <p className="text-sm font-black text-indigo-900">{statusTeacherName}</p>
                             </div>
                             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Trạng thái hiện tại</p>
                                <p className="text-sm font-black text-slate-700">{statusLabel}</p>
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
                            const canDelete = enrollments.length > 1;
                            return (
                              <div className="pt-6 mt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2">
                                    <BookOpen size={14} className="text-indigo-500" /> Các khóa học đang theo
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => setShowAddEnrollment(true)}
                                    className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <Plus size={12} /> Thêm khóa
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  {enrollments.map((enr) => {
                                    const enrId = enr.enrollmentId || enr.id;
                                    const progress = enr.totalSessions
                                      ? Math.round(((enr.completedSessions || 0) / enr.totalSessions) * 100)
                                      : 0;
                                    const isPaid = enr.paid === true || enr.paid === 'Đã đóng phí';
                                    return (
                                      <div key={enrId} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-900 truncate">
                                              {enr.courseName || enr.name}
                                              {enr.isPrimary && <span className="ml-2 text-[9px] text-indigo-500 font-black">CHÍNH</span>}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                              {enr.completedSessions || 0}/{enr.totalSessions || 12} buổi · {progress}% · {fmt(enr.price)}
                                            </p>
                                            <span className={`inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                                              isPaid
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}
                                            >
                                              {isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                            </span>
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
                                        <div className="flex flex-wrap gap-2">
                                          {!isPaid && enrId !== 'main' && (
                                            <button
                                              type="button"
                                              onClick={() => handlePayEnrollment(enr)}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700"
                                            >
                                              <DollarSign size={12} /> Thanh toán
                                            </button>
                                          )}
                                          {canDelete && enrId !== 'main' && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteEnrollment(enr)}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-wide hover:bg-red-50"
                                            >
                                              <Trash2 size={12} /> Xóa khóa
                                            </button>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                          {(() => {
                                            const webcamOn = enr.requireWebcam !== false;
                                            const unlocked = enr.examUnlocked === true;
                                            return (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => toggleEnrollmentSetting(enr, 'requireWebcam')}
                                                  className={`p-3 rounded-xl border text-left transition-all ${webcamOn ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
                                                >
                                                  <div className="flex items-center justify-between gap-2 mb-1">
                                                    <p className={`text-[10px] font-black uppercase tracking-tighter ${webcamOn ? 'text-emerald-700' : 'text-amber-700'}`}>Yêu cầu camera</p>
                                                    <div className={`w-8 h-4 rounded-full flex items-center p-0.5 shrink-0 ${webcamOn ? 'bg-emerald-500' : 'bg-amber-200'}`}>
                                                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${webcamOn ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </div>
                                                  </div>
                                                  <p className={`text-[9px] font-bold leading-snug ${webcamOn ? 'text-emerald-600/70' : 'text-amber-600/70'}`}>
                                                    {webcamOn ? 'Bắt buộc webcam khi thi khóa này.' : 'Không cần webcam khi thi khóa này.'}
                                                  </p>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => toggleEnrollmentSetting(enr, 'examUnlocked')}
                                                  className={`p-3 rounded-xl border text-left transition-all ${unlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
                                                >
                                                  <div className="flex items-center justify-between gap-2 mb-1">
                                                    <p className={`text-[10px] font-black uppercase tracking-tighter ${unlocked ? 'text-emerald-700' : 'text-slate-600'}`}>Mở khóa thi</p>
                                                    <div className={`w-8 h-4 rounded-full flex items-center p-0.5 shrink-0 ${unlocked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${unlocked ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </div>
                                                  </div>
                                                  <p className={`text-[9px] font-bold leading-snug ${unlocked ? 'text-emerald-600/70' : 'text-slate-500/70'}`}>
                                                    {unlocked ? 'Đã mở. Có thể làm mọi bài thi khóa này.' : 'Đang tắt. Theo lộ trình buổi học.'}
                                                  </p>
                                                </button>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

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
                  <div className="bg-white rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-100">
                    {data.schedules.length === 0 ? (
                      <p className="cms-empty-cell">Chưa có dữ liệu điểm danh</p>
                    ) : (
                      <div className="cms-modal-table-scroll">
                        <table className="w-full text-left min-w-[520px]">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="px-4 sm:px-6 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Ngày học</th>
                              {(getClientEnrollments(data.student).length > 1) && (
                                <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Khóa học</th>
                              )}
                              <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Giảng viên</th>
                              <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Nội dung</th>
                              <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase text-center">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {data.schedules.map(sch => (
                              <tr key={sch._id} className="hover:bg-slate-50/50 transition">
                                <td className="px-4 sm:px-6 py-3.5 text-xs font-bold text-slate-700 whitespace-nowrap">{fmtDate(sch.date)}</td>
                                {(getClientEnrollments(data.student).length > 1) && (
                                  <td className="px-3 sm:px-4 py-3.5 text-xs font-bold text-blue-600">{sch.course || '—'}</td>
                                )}
                                <td className="px-3 sm:px-4 py-3.5 text-xs font-semibold text-slate-600">{sch.teacherName || '—'}</td>
                                <td className="px-3 sm:px-4 py-3.5 text-xs text-slate-400 max-w-[160px] break-words">{sch.note || sch.subject || 'Dạy thực tế'}</td>
                                <td className="px-3 sm:px-4 py-3.5 text-center">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
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
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- TAB 3: FINANCE --- */}
              {activeTab === 'finance' && (
                <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                     <div className={`${financeAllPaid || (data.student.paid && !financePartialPaid) ? 'bg-emerald-600' : financePartialPaid ? 'bg-amber-600' : 'bg-red-600'} rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white relative overflow-hidden flex flex-col justify-between min-h-[9.5rem] sm:h-48`}>
                        <DollarSign className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10" />
                        <div>
                          <p className="text-[11px] font-black opacity-60 uppercase tracking-widest mb-1">Trạng thái đóng phí</p>
                          <h4 className="text-2xl sm:text-3xl font-black">{financeStatusLabel}</h4>
                          <p className="text-[12px] font-semibold opacity-80 mt-2">
                            {summaryMetrics.paidCount}/{summaryMetrics.enrollmentCount || 1} khóa đã thu
                            {activeEnrollment ? ` · ${activeEnrollment.courseName || activeEnrollment.name}` : ''}
                          </p>
                        </div>
                        <div className="flex justify-between items-end gap-3">
                          <div>
                            <p className="text-[10px] font-bold opacity-60">Đăng ký ngày</p>
                            <p className="text-sm font-black">{fmtDate(data.student.createdAt)}</p>
                          </div>
                          {financePaidTotal < financeListedTotal && (
                            <button type="button" onClick={() => showModal({ 
                                title: 'Hướng dẫn nghiệp vụ', 
                                content: 'Thu từng khóa tại danh sách "Các khóa học đang theo" (Tổng quan) hoặc tab Giao dịch để đồng bộ hóa đơn.', 
                                type: 'info' 
                            })} className="bg-white/95 text-slate-800 px-4 sm:px-6 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider hover:bg-white transition-all shrink-0">
                              Hướng dẫn thu
                            </button>
                          )}
                        </div>
                     </div>
                     <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-100 flex flex-col justify-between min-h-[9.5rem] sm:h-48 shadow-sm">
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền đã thanh toán</p>
                          <h4 className="text-2xl sm:text-3xl font-black text-slate-800 break-words">{fmt(financePaidTotal)}</h4>
                          <p className="text-[12px] font-semibold text-slate-400 mt-1.5">
                            Học phí gốc: {fmt(financeListedTotal)}
                            {financeListedTotal > financePaidTotal ? ` · Còn nợ ${fmt(financeListedTotal - financePaidTotal)}` : ''}
                          </p>
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

                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider pt-4">Lịch sử thanh toán / hóa đơn</h3>
                  <div className="bg-white rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                    {financeHistory.length === 0 ? (
                      <p className="cms-empty-cell">Chưa phát sinh thanh toán nào</p>
                    ) : (
                      <div className="cms-modal-table-scroll">
                        <table className="w-full text-left min-w-[520px]">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="px-4 sm:px-6 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Mã HĐ</th>
                              <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Ngày</th>
                              <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Nội dung</th>
                              <th className="px-3 sm:px-4 py-3 text-right text-[11px] font-black text-slate-400 tracking-widest uppercase">Số tiền</th>
                              <th className="px-4 sm:px-6 py-3 text-center text-[11px] font-black text-slate-400 tracking-widest uppercase">In</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {financeHistory.map((inv) => (
                              <tr key={inv.key} className="hover:bg-slate-50/50 transition">
                                <td className="px-4 sm:px-6 py-3.5">
                                  <span className={`text-xs font-black ${inv.synthetic ? 'text-slate-400' : 'text-indigo-600'}`}>
                                    {inv.maHoaDon}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-4 py-3.5 text-xs font-semibold text-slate-600 whitespace-nowrap">{fmtDate(inv.createdAt)}</td>
                                <td className="px-3 sm:px-4 py-3.5 text-xs text-slate-500 max-w-[180px] break-words">
                                  {inv.khoaHoc}{inv.ghiChu ? ` — ${inv.ghiChu}` : ''}
                                </td>
                                <td className="px-3 sm:px-4 py-3.5 text-right font-black text-slate-800 text-sm whitespace-nowrap">{fmt(inv.hocPhi)}</td>
                                <td className="px-4 sm:px-6 py-3.5 text-center">
                                  <button type="button" onClick={() => window.print()} className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 inline-flex items-center justify-center transition-all" aria-label="In">
                                    <Printer size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
                {/* --- TAB: ASSIGNMENTS --- */}
                {activeTab === 'assignments' && (
                  <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-right-10 duration-500">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 min-w-0">
                        <BookOpen size={16} className="text-blue-500 shrink-0" />
                        <span className="leading-snug">Danh sách bài tập được giao</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowAddAssign(!showAddAssign)}
                        className="w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white px-4 py-3 min-h-11 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all inline-flex items-center gap-1.5 shrink-0"
                      >
                        <Plus size={14} /> Giao bài tập mới
                      </button>
                    </div>

                    {showAddAssign && (
                      <div className="bg-white rounded-3xl p-6 border-2 border-indigo-100 shadow-xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-indigo-50 pb-3 gap-3">
                           <p className="text-xs font-black text-indigo-700 uppercase tracking-widest min-w-0">
                             Thiết lập bài tập
                             {liveAssignCourseName ? (
                               <span className="block sm:inline sm:ml-1 normal-case tracking-normal text-slate-500 font-bold">
                                 ({liveAssignCourseName})
                               </span>
                             ) : null}
                           </p>
                           <button type="button" onClick={() => setShowAddAssign(false)} className="text-slate-400 hover:text-red-500 shrink-0" aria-label="Đóng">
                             <X size={16} />
                           </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {liveCourseFilter === 'all' && liveEnrollments.length > 0 && (
                            <div className="md:col-span-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Khóa học giao bài</label>
                              <CmsSelect
                                value={assignTargetCourse}
                                onChange={(e) => setAssignTargetCourse(e.target.value)}
                                aria-label="Chọn khóa học giao bài"
                              >
                                {liveEnrollments.map((enr) => {
                                  const name = enr.courseName || enr.name;
                                  return (
                                    <option key={enr.enrollmentId || enr.id || name} value={name}>
                                      {name}
                                    </option>
                                  );
                                })}
                              </CmsSelect>
                            </div>
                          )}
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
                          type="button"
                          onClick={handleAddAssignment}
                          className="w-full py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-100"
                        >
                          XÁC NHẬN GIAO BÀI
                        </button>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl sm:rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
                      {loadingAssign ? (
                        <div className="py-16 flex justify-center">
                          <Loader2 className="animate-spin text-indigo-400" />
                        </div>
                      ) : assignments.length === 0 ? (
                        <p className="cms-empty-cell">Chưa có bài tập nào được giao</p>
                      ) : (
                      <div className="cms-modal-table-scroll">
                        <table className="w-full text-left min-w-[520px]">
                          <thead>
                            <tr className="bg-slate-50">
                            <th className="px-4 sm:px-6 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Bài tập</th>
                            <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase">Thời hạn</th>
                            <th className="px-3 sm:px-4 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase text-center">Tiến độ</th>
                            <th className="px-4 sm:px-6 py-3 text-[11px] font-black text-slate-400 tracking-widest uppercase text-center">Kết quả</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {assignments.map(a => {
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
                      )}
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
                    className="min-h-12 flex-1 sm:flex-none px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[13px] font-bold hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2"
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

      {showAddEnrollment && data?.student && (
        <AddEnrollmentModal
          student={data.student}
          teachers={teachers || []}
          onSubmit={handleAddEnrollmentSubmit}
          onClose={() => setShowAddEnrollment(false)}
        />
      )}
    </div>
  );
}

{/* Helper UI Components */}
function StatBox({ label, value, icon: Icon, color, sub, valueClassName }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm relative overflow-hidden min-w-0">
       <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
       <div className="flex items-start justify-between gap-3 pl-1 min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
             <p className="text-[11px] font-semibold text-slate-500">{label}</p>
             <h4 className={`text-xl font-bold text-slate-800 break-words leading-tight ${valueClassName || ''}`}>{value}</h4>
             {sub && <p className="text-[11px] text-slate-400 font-medium">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white shrink-0`}>
             <Icon size={18} />
          </div>
       </div>
    </div>
  );
}
