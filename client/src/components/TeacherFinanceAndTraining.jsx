import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  DollarSign, PlayCircle, Download, Calendar as CalendarIcon,
  Clock, TrendingUp, CreditCard,
  CheckCircle2, FileText, Video,
  BookOpen, AlertCircle, BarChart, FileSpreadsheet, FileBox,
  ChevronDown, ChevronUp, Users
} from 'lucide-react';
import NavArrow from './ui/NavArrow';
import { useLocation } from 'react-router-dom';
import { useModal } from '../utils/Modal.jsx';
import api, { getRolePrefix } from '../services/api';
import {
  getSyntheticPendingCommissionAmount,
  sortFinanceMonths,
} from '../utils/teacherFinance';

const isPaidTxStatus = (status) => ['completed', 'paid', 'confirmed'].includes(String(status || ''));
const isCancelledTxStatus = (status) => String(status || '').toLowerCase() === 'cancelled';
const isPendingTxStatus = (status) => !isPaidTxStatus(status);

function paymentDateLabel(p) {
  if (p?.date) return String(p.date);
  if (p?.createdAt) return new Date(p.createdAt).toLocaleDateString('vi-VN');
  return '';
}

const CircularProgress = ({ progress }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  let strokeColor = 'text-gray-100';
  let pathColor = 'text-blue-500';
  if (progress === 0) pathColor = 'text-gray-300';
  else if (progress === 100) pathColor = 'text-green-500';

  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-28 h-28 transform -rotate-90 drop-shadow-sm">
        <circle cx="56" cy="56" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className={strokeColor} />
        <circle cx="56" cy="56" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${pathColor} transition-all duration-1000 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        {progress === 100 ? (
           <CheckCircle2 size={32} className="text-green-500 drop-shadow-sm" />
        ) : (
           <span className="text-xl font-black text-gray-800 tracking-tighter">{progress}%</span>
        )}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const TeacherFinanceAndTraining = () => {
  const { showModal } = useModal();
  const location = useLocation();
  const currentHash = location.hash?.replace('#', '') || '';
  const isTraining = currentHash === 'training';
  const prefix = getRolePrefix ? getRolePrefix() : (localStorage.getItem('teacher_user') ? 'teacher' : 'admin');
  const session = JSON.parse(localStorage.getItem(`${prefix}_user`) || '{}');
  const teacherId = session.id || session._id;
  const teacherName = session.name || 'Giảng viên';

  const [myPayments, setMyPayments] = useState([]);
  const [financeStats, setFinanceStats] = useState({
    totalSessions: 0, unpaidAmount: 0, paidAmount: 0, salaryPerSession: 0
  });
  const [financeLoadError, setFinanceLoadError] = useState('');
  const [financeReloadKey, setFinanceReloadKey] = useState(0);
  const [financeLoadedKey, setFinanceLoadedKey] = useState('');
  const financeRequestKey = `${teacherId || ''}:${financeReloadKey}`;
  const trainingRequestKey = `${teacherId || ''}:training`;
  const isLoadingFinance = !isTraining
    && Boolean(teacherId)
    && financeLoadedKey !== financeRequestKey;
  const isLoadingTraining = isTraining
    && Boolean(teacherId)
    && trainingLoadedKey !== trainingRequestKey;
  const financeErrorMessage = (isLoadingFinance ? '' : financeLoadError) || (!teacherId
    ? 'Không tìm thấy tài khoản giảng viên để tải thông tin tài chính.'
    : '');
  const [courses, setCourses] = useState([]);
  const [trainingLoadedKey, setTrainingLoadedKey] = useState('');
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [courseTab, setCourseTab] = useState('video');

  useEffect(() => {
    if (!isTraining) {
      if (!teacherId) return;
      let active = true;
      Promise.all([
        api.transactions.getByTeacher(teacherId),
        api.teachers.getFinance(teacherId),
      ]).then(([txRes, finRes]) => {
        if (!active) return;
        if (!txRes?.success || !finRes?.success) {
          throw new Error(txRes?.message || finRes?.message || 'Không thể tải dữ liệu tài chính.');
        }
        setMyPayments(Array.isArray(txRes.data) ? txRes.data : []);
        setFinanceStats(finRes.data || { totalSessions: 0, unpaidAmount: 0, paidAmount: 0, salaryPerSession: 0 });
        setFinanceLoadError('');
      }).catch((error) => {
        if (!active) return;
        setMyPayments([]);
        setFinanceStats({ totalSessions: 0, unpaidAmount: 0, paidAmount: 0, salaryPerSession: 0 });
        setFinanceLoadError(error?.message || 'Không thể tải dữ liệu tài chính.');
      }).finally(() => {
        if (active) setFinanceLoadedKey(financeRequestKey);
      });
      return () => { active = false; };
    }

    let active = true;
    api.trainingLms.getTeacherOverview()
      .then((res) => {
        if (active) {
          if (res?.success) setCourses(res.data?.courses || []);
          else setCourses([]);
        }
      })
      .catch(() => {
        if (active) setCourses([]);
      })
      .finally(() => {
        if (active) setTrainingLoadedKey(trainingRequestKey);
      });
    return () => { active = false; };
  }, [isTraining, teacherId, financeRequestKey, trainingRequestKey]);

  const totalEarned = teacherId ? financeStats.paidAmount || 0 : 0;
  const totalPending = teacherId ? financeStats.unpaidAmount || 0 : 0;
  const totalSessions = teacherId ? financeStats.totalSessions || 0 : 0;
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [exportingMonthlyExcel, setExportingMonthlyExcel] = useState(false);

  const handleExportMonthlyExcel = async () => {
    if (!teacherId || exportingMonthlyExcel) return;
    setExportingMonthlyExcel(true);
    try {
      const response = await api.schedules.getByTeacher(teacherId);
      if (!response?.success || !Array.isArray(response.data)) {
        throw new Error(response?.message || 'Không tải được lịch dạy để xuất bảng kê.');
      }

      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthTitle = `Tháng ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const completedSessions = response.data
        .filter((session) => session.status === 'completed')
        .sort((left, right) => (
          `${left.date || ''} ${left.startTime || ''}`.localeCompare(`${right.date || ''} ${right.startTime || ''}`)
        ));
      const sessionsThisMonth = completedSessions.filter((session) => String(session.date || '').slice(0, 7) === monthKey);
      const paidAmounts = new Map();
      (myPayments || []).forEach((payment) => {
        (payment.paymentSessionDetails || []).forEach((detail) => {
          if (detail.sessionId) paidAmounts.set(String(detail.sessionId), Number(detail.allocatedAmount) || 0);
        });
      });
      const sessionNumbers = new Map();
      const counters = new Map();
      completedSessions.forEach((session) => {
        const studentId = session.studentId?._id || session.studentId?.id || session.studentId;
        const studentName = session.studentName || session.studentId?.name || 'Học viên';
        const course = session.courseName || session.course || session.subject || '';
        const key = `${studentId || studentName}|${course}`;
        const nextNumber = (counters.get(key) || 0) + 1;
        counters.set(key, nextNumber);
        sessionNumbers.set(String(session._id || session.id), nextNumber);
      });

      const studentRows = new Map();
      sessionsThisMonth.forEach((session) => {
        const studentId = session.studentId?._id || session.studentId?.id || session.studentId;
        const studentName = session.studentName || session.studentId?.name || 'Học viên';
        const key = String(studentId || studentName);
        const student = studentRows.get(key) || { name: studentName, sessions: [], total: 0 };
        const scheduleId = String(session._id || session.id);
        const amount = paidAmounts.get(scheduleId) ?? (Number(financeStats.salaryPerSession) || 0);
        student.sessions.push({
          course: session.courseName || session.course || session.subject || '',
          date: session.date || '',
          number: sessionNumbers.get(scheduleId) || 0,
          amount,
        });
        student.total += amount;
        studentRows.set(key, student);
      });

      const rows = [
        [`BẢNG KÊ THU NHẬP ${monthTitle.toUpperCase()}`],
        [`Giảng viên: ${teacherName || '—'}`],
        [],
        ['Học viên', 'Khóa học', 'Ngày dạy', 'Buổi số', 'Tiền/buổi (VNĐ)'],
      ];
      let totalAmount = 0;
      studentRows.forEach((student) => {
        student.sessions.forEach((session) => {
          rows.push([
            student.name,
            session.course,
            session.date ? new Date(`${session.date.slice(0, 10)}T12:00:00`).toLocaleDateString('vi-VN') : '—',
            session.number || '—',
            session.amount,
          ]);
        });
        rows.push([student.name, '', '', `Tổng ${student.sessions.length} buổi`, student.total]);
        totalAmount += student.total;
      });
      if (!sessionsThisMonth.length) rows.push(['Không có buổi dạy hoàn thành trong tháng này']);
      rows.push([]);
      rows.push(['TỔNG TOÀN BỘ HỌC VIÊN', '', '', `${sessionsThisMonth.length} buổi`, totalAmount]);

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 28 },
        { wch: 36 },
        { wch: 18 },
        { wch: 14 },
        { wch: 22 },
      ];
      worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bảng kê thu nhập');
      const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([workbookBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `Bang_ke_thu_nhap_Thang_${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}.xlsx`;
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
    } catch (error) {
      showModal({
        title: 'Không thể xuất Excel',
        content: error?.message || 'Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setExportingMonthlyExcel(false);
    }
  };

  /** Gộp transaction thật + dòng hoa hồng chưa chi (tính từ buổi completed chưa thanh toán) */
  const displayPayments = useMemo(() => {
    if (!teacherId) return [];
    const list = (myPayments || []).map((p) => ({
      ...p,
      id: p.id || p._id,
    }));

    const unpaid = getSyntheticPendingCommissionAmount(financeStats.unpaidAmount, list);
    if (unpaid > 0) {
      const rate = Number(financeStats.salaryPerSession) || 0;
      const sessions = rate > 0 ? Math.round(unpaid / rate) : 0;
      list.unshift({
        id: 'synthetic-pending-commission',
        amount: unpaid,
        status: 'pending',
        sessions,
        month: 'Hiện tại',
        date: new Date().toLocaleDateString('vi-VN'),
        createdAt: new Date().toISOString(),
        note: sessions > 0
          ? `Hoa hồng ${sessions} buổi dạy đã hoàn thành — chờ Admin chuyển`
          : 'Hoa hồng buổi dạy đã hoàn thành — chờ Admin chuyển',
        _synthetic: true,
      });
    }
    return list;
  }, [teacherId, myPayments, financeStats.unpaidAmount, financeStats.salaryPerSession]);

  const filteredPayments = useMemo(() => {
    if (filterStatus === 'all') return displayPayments;
    if (filterStatus === 'paid') return displayPayments.filter((p) => isPaidTxStatus(p.status));
    return displayPayments.filter((p) => String(p.status || '').toLowerCase() === 'pending');
  }, [displayPayments, filterStatus]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const dataObj = {};
    myPayments.filter((p) => isPaidTxStatus(p.status)).forEach((p) => {
        const key = p.month || 'Không rõ';
        dataObj[key] = (dataObj[key] || 0) + (p.amount || 0);
    });
    const arr = Object.entries(dataObj).map(([month, amount]) => ({ month, amount }));
    return arr.sort((a, b) => sortFinanceMonths(a.month, b.month));
  }, [myPayments]);

  const maxAmount = Math.max(...chartData.map(d => d.amount), 1); // Avoid division by zero

  return (
    <div className="bg-transparent h-full">
      <div className="space-y-4 sm:space-y-5 md:space-y-6 w-full min-w-0 py-2">

        {!isTraining ? (
          /* ════════ TÀI CHÍNH ════════ */
          <div id="finance-report" className="space-y-3 sm:space-y-4">
            <div className="relative flex items-center justify-center border-b border-slate-200 pb-3">
              <h2 className="text-center text-base sm:text-lg font-extrabold text-slate-800">
                Tài chính & Hoa hồng
              </h2>
              <p className="absolute right-0 hidden text-xs text-gray-400 lg:block">GV: {teacherName}</p>
            </div>

            {financeErrorMessage ? (
              <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                <span>{financeErrorMessage}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFinanceLoadError('');
                    setFinanceReloadKey((key) => key + 1);
                  }}
                  className="min-h-10 shrink-0 rounded-xl border border-rose-200 bg-white px-4 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  Thử tải lại
                </button>
              </div>
            ) : isLoadingFinance ? (
              <p role="status" className="text-xs font-medium text-slate-400">Đang tải dữ liệu tài chính…</p>
            ) : null}

            {/* Stat Cards — Fintech soft cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="col-span-2 bg-white shadow-sm border border-emerald-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
                  <p className="text-slate-500 text-[10px]  tracking-wider font-semibold">Tổng đã nhận</p>
                </div>
                <p className="text-2xl sm:text-3xl font-black mt-1 text-emerald-600 tabular-nums">{totalEarned.toLocaleString('vi-VN')}đ</p>
                <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                  <TrendingUp size={12} aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs">Tổng các giao dịch đã xác nhận</span>
                </div>
              </div>
              <div className="bg-white shadow-sm border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
                  <p className="text-slate-500 text-[10px]  tracking-wider font-semibold">Chưa nhận</p>
                </div>
                <p className="text-xl sm:text-3xl font-black mt-1 text-amber-500 tabular-nums">{totalPending.toLocaleString('vi-VN')}đ</p>
                <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                  <AlertCircle size={12} aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs">Đang chờ Admin chuyển</span>
                </div>
              </div>
              <div className="bg-white shadow-sm border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex min-w-0 items-center gap-2">
                  <CalendarIcon size={16} className="text-rose-500 shrink-0" aria-hidden="true" />
                  <p className="text-slate-500 text-[10px] tracking-wider font-semibold">Tổng buổi đã dạy</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportMonthlyExcel}
                    disabled={exportingMonthlyExcel || isLoadingFinance || Boolean(financeErrorMessage)}
                    aria-label="Tải bảng kê Excel tháng này"
                    title="Tải bảng kê Excel tháng này"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {exportingMonthlyExcel
                      ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden="true" />
                      : <FileSpreadsheet size={16} aria-hidden="true" />}
                  </button>
                </div>
                <p className="text-xl sm:text-3xl font-black mt-1 text-rose-500 tabular-nums">{totalSessions}</p>
                <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                  <CalendarIcon size={12} aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs">{exportingMonthlyExcel ? 'Đang tạo file Excel…' : 'Tất cả các tháng · Excel tháng này'}</span>
                </div>
              </div>
            </div>

            {/* Báo cáo & Biểu đồ */}
            <div>
               <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                     <BarChart className="text-blue-600 shrink-0" size={18} aria-hidden="true" />
                     <h3 className="text-sm sm:text-base font-extrabold text-slate-800  tracking-tight">Biểu đồ thu nhập</h3>
                  </div>
                  <div className="min-h-[136px] h-[136px] w-full flex items-end justify-start gap-4 sm:gap-6 md:gap-8 mt-1 pb-7 border-b border-dashed border-slate-200 px-1 sm:px-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-200">
                     {chartData.length > 0 ? chartData.map((d, i) => (
                         <div key={i} className="w-14 sm:w-16 md:w-20 flex-shrink-0 flex flex-col items-center justify-end h-full gap-2 group relative">
                             <span className="max-w-full truncate text-[9px] sm:text-[10px] font-bold text-slate-500 tabular-nums">
                               {d.amount.toLocaleString('vi-VN')}đ
                             </span>
                             <div className="w-8 sm:w-9 bg-indigo-600 rounded-t-lg transition-all duration-700 ease-out group-hover:bg-indigo-500"
                                  style={{ height: `${(d.amount / maxAmount) * 75}%`, minHeight: '8%' }}
                                  title={`${d.month}: ${d.amount.toLocaleString('vi-VN')}đ`} />
                             <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 absolute -bottom-8 truncate w-full text-center tracking-tight">
                                {d.month.replace('Tháng ', 'T')}
                             </span>
                         </div>
                     )) : (
                         <div className="w-full min-h-[100px] h-full flex flex-col items-center justify-center text-sm text-slate-400 font-medium gap-1.5">
                           <BarChart size={22} className="text-slate-300" aria-hidden="true" />
                           Chưa có dữ liệu thống kê
                         </div>
                     )}
                  </div>
               </div>

            </div>

            {/* Payment History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-3 py-3 border-b border-slate-100 space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard size={16} className="text-emerald-600 shrink-0" aria-hidden="true" /> Lịch sử chuyển tiền hoa hồng
                </h3>
                <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 gap-0.5">
                  {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'paid', label: 'Đã nhận' },
                    { key: 'pending', label: 'Chưa nhận' },
                  ].map(f => (
                    <button key={f.key} type="button" onClick={() => setFilterStatus(f.key)}
                      className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        filterStatus === f.key
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-3 py-3 space-y-3">
                {filteredPayments.length === 0 && (
                  <div className="px-0 py-10 text-center text-slate-400">
                    <DollarSign size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">Không có giao dịch nào</p>
                  </div>
                )}

                {(() => {
                  const groups = new Map();
                  filteredPayments.forEach((payment) => {
                    const key = payment.month || 'Không rõ';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(payment);
                  });

                  return [...groups.entries()].map(([monthLabel, items]) => (
                    <div key={monthLabel} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                        <div className="inline-flex items-center gap-2 text-[11px] font-bold  tracking-[0.12em] text-slate-500">
                          <CalendarIcon size={12} className="text-slate-400" />
                          {monthLabel}
                        </div>
                        <span className="text-[11px] text-slate-400">{items.length} giao dịch</span>
                      </div>

                      <div className="space-y-2">
                        {items.map((p) => {
                          const paymentId = p.id || p._id;
                          const isExpanded = expandedPaymentId === paymentId;
                          const studentCount = new Set((p.paymentSessionDetails || []).map((s) => s.studentId || s.studentName || 'unknown')).size;

                          return (
                            <div
                              key={paymentId}
                              className={`rounded-2xl border transition-all ${
                                isCancelledTxStatus(p.status)
                                  ? 'border-slate-200 bg-slate-50'
                                  : isPendingTxStatus(p.status)
                                    ? 'border-amber-200 bg-amber-50/40'
                                    : 'border-emerald-200 bg-emerald-50'
                              }`}
                            >
                              <div className="px-2.5 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-black text-base text-slate-800 tabular-nums">{Number(p.amount || 0).toLocaleString('vi-VN')}đ</p>
                                      {p._synthetic ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                          <Clock size={11} /> Tạm tính
                                        </span>
                                      ) : isPaidTxStatus(p.status) ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                          <CheckCircle2 size={11} /> Đã nhận
                                        </span>
                                      ) : isCancelledTxStatus(p.status) ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                          <Clock size={11} /> Đã hủy
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                          <Clock size={11} /> Chưa nhận
                                        </span>
                                      )}
                                    </div>

                                    <p className="mt-1 text-[13px] text-slate-600 line-clamp-2">
                                      {p._synthetic ? 'Tạm tính · ' : ''}{p.note || p.description || 'Thanh toán hoa hồng'}
                                    </p>

                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                      <span className="inline-flex items-center gap-1">
                                        <CalendarIcon size={11} /> {paymentDateLabel(p)}
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <Users size={11} /> {p.sessions || p.paymentSessionDetails?.length || 0} buổi
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <CreditCard size={11} /> {p.confirmedBy || 'Admin'}
                                      </span>
                                    </div>
                                  </div>

                                  {!p._synthetic && p.paymentSessionDetails?.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedPaymentId((id) => (id === paymentId ? null : paymentId))}
                                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-800 hover:border-slate-300 transition"
                                    >
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      {isExpanded ? 'Thu gọn' : `Chi tiết (${studentCount})`}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {!p._synthetic && isExpanded && p.paymentSessionDetails?.length > 0 && (
                                <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-[10px]  tracking-[0.12em] font-bold text-slate-500">Phân bổ theo học viên</p>
                                    <span className="text-[10px] text-slate-400">{studentCount} học viên</span>
                                  </div>

                                  <div className="space-y-2">
                                    {Object.values(p.paymentSessionDetails.reduce((groups, session) => {
                                      const key = String(session.studentId || session.studentName || 'unknown');
                                      if (!groups[key]) groups[key] = {
                                        name: session.studentName || 'Học viên',
                                        count: 0,
                                        amount: 0,
                                        dates: [],
                                      };
                                      groups[key].count += 1;
                                      groups[key].amount += Number(session.allocatedAmount) || 0;
                                      if (session.date) groups[key].dates.push(new Date(session.date).toLocaleDateString('vi-VN'));
                                      return groups;
                                    }, {})).map((student) => (
                                      <div
                                        key={student.name}
                                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-700 truncate">{student.name}</div>
                                          <div className="mt-1 text-[10px] text-slate-500">
                                            {student.dates.length ? student.dates.join(', ') : 'Không có ngày'}
                                          </div>
                                        </div>
                                        <div className="shrink-0 text-right text-slate-600">
                                          <div className="font-bold text-slate-700">{student.count} buổi</div>
                                          <div className="text-[10px] text-slate-500">{student.amount.toLocaleString('vi-VN')}đ</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                                    <span>Người chuyển: {p.confirmedBy || 'Admin'}</span>
                                    {Number(p.starBonusAmount) > 0 && (
                                      <span className="ml-3 text-amber-700">⭐ Thưởng sao: {Number(p.starBonusAmount).toLocaleString('vi-VN')}đ</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="px-3 py-3 border-t border-dashed border-slate-200">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-xs sm:text-sm text-slate-500">Tổng đã nhận:</span>
                  <span className="text-base sm:text-lg font-black text-emerald-700 tabular-nums">{totalEarned.toLocaleString('vi-VN')}đ</span>
                </div>
                {totalPending > 0 && (
                  <div className="flex justify-between items-center mt-1.5 gap-3">
                    <span className="text-xs sm:text-sm text-slate-500">Chờ nhận:</span>
                    <span className="text-base sm:text-lg font-black text-amber-600 tabular-nums">{totalPending.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        ) : activeCourse ? (
          /* ════════ CHI TIẾT KHÓA HỌC (TABS) ════════ */
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
             {/* Header */}
             <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                   <button onClick={() => setActiveCourse(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold flex items-center gap-1 mb-2 transition-colors">
                     <NavArrow size={16} direction="back" className="text-slate-400" />
                     Quay lại danh sách
                   </button>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tight">{activeCourse.title}</h2>
                </div>
                <CircularProgress progress={activeCourse.progress} />
             </div>

             {/* TabsMenu */}
             <div className="flex px-8 border-b border-slate-100 bg-white">
                <button onClick={() => setCourseTab('video')} className={`px-6 py-4 text-xs font-black  tracking-widest border-b-2 transition-all ${courseTab === 'video' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                  <Video size={14} className="inline mr-2" />  Bài giảng video
                </button>
                <button onClick={() => setCourseTab('data')} className={`px-6 py-4 text-xs font-black  tracking-widest border-b-2 transition-all ${courseTab === 'data' ? 'text-green-600 border-green-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                  <FileBox size={14} className="inline mr-2" />  Tài liệu của khóa
                </button>
                <button onClick={() => setCourseTab('notice')} className={`px-6 py-4 text-xs font-black  tracking-widest border-b-2 transition-all ${courseTab === 'notice' ? 'text-orange-600 border-orange-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                  <AlertCircle size={14} className="inline mr-2" />  Thông báo từ qu?N tr? Vi?N
                </button>
             </div>

             {/* Tab Content */}
             <div className="p-8 flex-1 bg-slate-50/50">
               {courseTab === 'video' && (
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                       <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200">
                          {(activeCourse.videos[activeVideoIndex] || activeCourse.videos[0])?.url ? (
                            <iframe
                              src={(activeCourse.videos[activeVideoIndex] || activeCourse.videos[0]).url}
                              className="w-full h-full"
                              allowFullScreen
                              title={(activeCourse.videos[activeVideoIndex] || activeCourse.videos[0]).title}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">Chưa có video bài giảng nào</div>
                          )}
                       </div>
                       <div>
                         <h3 className="text-xl font-bold text-slate-800">
                           {(activeCourse.videos[activeVideoIndex] || activeCourse.videos[0])?.title || 'Bài giảng đang được cập nhật'}
                         </h3>
                       </div>
                    </div>
                    <div className="lg:col-span-1 border border-slate-100 bg-white rounded-2xl overflow-hidden self-start">
                       <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                         <h4 className="font-bold text-slate-700 text-sm">Danh sách bài học</h4>
                       </div>
                       <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                         {(activeCourse.videos || []).map((vid, idx) => (
                           <button
                             key={idx}
                             type="button"
                             onClick={() => setActiveVideoIndex(idx)}
                             className={`w-full text-left px-5 py-4 hover:bg-blue-50 transition-colors group flex gap-3 ${activeVideoIndex === idx ? 'bg-blue-50' : ''}`}
                           >
                              <div className="text-slate-300 font-black mt-0.5 group-hover:text-blue-400">{String(idx + 1).padStart(2, '0')}</div>
                              <div>
                                <p className="font-semibold text-slate-700 text-sm group-hover:text-blue-700 line-clamp-2 leading-snug">{vid.title}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center gap-1"><Clock size={10} /> {vid.duration}</p>
                              </div>
                           </button>
                         ))}
                       </div>
                    </div>
                 </div>
               )}

               {courseTab === 'data' && (
                 <div className="max-w-4xl mx-auto space-y-4">
                    {(activeCourse.files || []).length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-200">Khóa học này chưa có tài liệu đính kèm.</div>
                    ) : (
                      activeCourse.files.map((file, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:border-green-200 transition-colors">
                           <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-black text-white shadow-sm ${file.type === 'PDF' ? 'bg-red-500' : file.type === 'DOCX' ? 'bg-red-500' : 'bg-green-500'}`}>{file.type}</div>
                              <div>
                                <h4 className="font-bold text-slate-700">{file.title}</h4>
                                <p className="text-xs text-slate-400 mt-1 font-semibold">{file.size}</p>
                              </div>
                           </div>
                           {file.url ? (
                             <a href={file.url} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors">
                               <Download size={14} /> Tải file
                             </a>
                           ) : (
                             <span className="px-5 py-2.5 text-xs text-slate-400 font-bold">Chưa có link</span>
                           )}
                        </div>
                      ))
                    )}
                 </div>
               )}

               {courseTab === 'notice' && (
                 <div className="max-w-4xl mx-auto space-y-4">
                    {(activeCourse.notices || []).length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-200">Chưa có thông báo nào.</div>
                    ) : (
                      activeCourse.notices.map((n, idx) => (
                        <div key={idx} className="bg-orange-50 border-l-4 border-orange-400 p-5 rounded-r-2xl">
                          <p className="text-sm font-semibold text-orange-900 leading-relaxed">{n}</p>
                        </div>
                      ))
                    )}
                 </div>
               )}
             </div>
          </div>
        ) : (
          /* ════════ ĐÀO TẠO TỔNG QUAN (GRID) ════════ */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                <BookOpen size={28} className="text-purple-600" /> Các khóa đào tạo
              </h2>
              <p className="text-sm font-bold text-gray-400 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                {isLoadingTraining ? 'Đang tải...' : `Hiển thị ${courses.length} khóa học`}
              </p>
            </div>

            {isLoadingTraining ? (
              <div className="py-20 text-center text-slate-400 font-bold">Đang tải khóa đào tạo...</div>
            ) : courses.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <BookOpen size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Chưa có khóa đào tạo</p>
                <p className="text-xs text-slate-400 mt-1">Admin cần thêm nội dung ở tab Đào tạo GV</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {courses.map(course => (
                 <div
                   onClick={() => { setActiveCourse(course); setActiveVideoIndex(0); setCourseTab('video'); }}
                   key={course.id}
                   className="bg-white rounded-[2rem] p-8 pb-6 border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col relative overflow-hidden"
                 >
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-slate-50 rounded-full group-hover:bg-blue-50 transition-colors pointer-events-none" />
                    
                    <div className="flex-1 flex justify-center py-4 relative z-10">
                      <CircularProgress progress={course.progress || 0} />
                    </div>
                    
                    <div className="mt-4 text-center pb-2 border-b border-dashed border-slate-100 z-10">
                      <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">{course.title}</h3>
                    </div>

                    <div className="flex justify-between items-center mt-4 text-slate-400 text-[10px] font-black  tracking-widest z-10">
                       <span className="flex items-center gap-1"><Video size={14} className="text-blue-400" /> {(course.videos || []).length}  Video</span>
                       <span className="flex items-center gap-1"><FileBox size={14} className="text-green-400" /> {(course.files || []).length}  Tài liệu</span>
                    </div>
                 </div>
               ))}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherFinanceAndTraining;
