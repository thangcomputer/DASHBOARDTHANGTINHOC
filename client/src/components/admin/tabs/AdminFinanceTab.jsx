import React, { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useAdminTab } from '../AdminTabContext';
import { useAdminFinance } from '../hooks/AdminFinanceContext';
import {
  DollarSign, Download, TrendingUp, RefreshCw, CreditCard, Users, BookOpen,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  exportToCSV,
  exportTransactionsExcel,
  exportLedgerExcel,
} from '../../../utils/exportExcel';
import {
  expandFinanceEnrollmentRows,
  summarizeFinanceEnrollmentRows,
} from '../../../utils/enrollments';
import PayoutSessionDetailPanel from '../shared/PayoutSessionDetailPanel';
import api from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';

const TYPE_LABEL = {
  payment: 'Thanh toán',
  refund: 'Hoàn tiền',
  salary: 'Lương GV',
  bonus: 'Thưởng',
  expense: 'Chi phí',
  discount: 'Giảm giá',
  coupon: 'Coupon',
  adjustment: 'Điều chỉnh',
};

export default function AdminFinanceTab() {
  const {
    isSuperAdmin, isHighAdmin, toast, addSystemLog,
    markStudentPaid,
  } = useAdminTab();
  const { selectedBranchId } = useBranch();
  const { financialData, financeStudents, isLoadingFinance } = useAdminFinance();
  const [ledgerType, setLedgerType] = useState('');
  const [ledgerLimit, setLedgerLimit] = useState(40);
  const [expandedTxIds, setExpandedTxIds] = useState(() => new Set());
  const [expandedLedgerIds, setExpandedLedgerIds] = useState(() => new Set());
  const canManageTeacherPayoutUi = !!(isSuperAdmin || isHighAdmin);

  const toggleExpandedId = (setter, rawId) => {
    const id = String(rawId || '');
    if (!id) return;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const financeRows = useMemo(
    () => expandFinanceEnrollmentRows(financeStudents),
    [financeStudents],
  );
  const financeSummary = useMemo(
    () => summarizeFinanceEnrollmentRows(financeRows),
    [financeRows],
  );

  const branchKey = selectedBranchId || 'all';

  const { data: ledgerRes } = useSWR(
    ['finance_summary', branchKey],
    () => api.finance.summary({ branchId: branchKey }),
    { revalidateOnFocus: false, dedupingInterval: 15000 },
  );
  const ledger = ledgerRes?.success ? ledgerRes.data : null;

  const { data: bookRes, isLoading: loadingBook } = useSWR(
    ['finance_ledger', branchKey, ledgerType, ledgerLimit],
    () => api.finance.ledger({
      branchId: branchKey,
      type: ledgerType || undefined,
      limit: ledgerLimit,
    }),
    { revalidateOnFocus: false, dedupingInterval: 15000 },
  );
  const ledgerLines = bookRes?.success ? (bookRes.data?.items || []) : [];
  const ledgerTotal = bookRes?.success ? (Number(bookRes.data?.total) || ledgerLines.length) : ledgerLines.length;

  const totalNet = ledger ? Number(ledger.net) || 0 : financeSummary.net;
  const totalListed = financeSummary.listed;
  const totalDebt = financeSummary.debt;
  const totalRefunded = ledger ? Number(ledger.refunds) || 0 : financeSummary.refunded;
  const totalGross = ledger ? Number(ledger.payments) || 0 : null;
  const totalCosts = ledger ? Number(ledger.costs) || 0 : 0;
  const totalProfit = ledger ? Number(ledger.profit) || 0 : totalNet - totalCosts;
  const teacherPaidFallback = (financialData || []).reduce((s, p) => s + (p.amount || 0), 0);
  const teacherPaid = totalCosts > 0 ? totalCosts : teacherPaidFallback;

  const handlePayRow = async (row) => {
    if (row.kind === 'refund') return;
    const tid = toast.loading('Đang xác nhận thanh toán...');
    try {
      if (row.enrollmentId) {
        const res = await api.students.payEnrollment(row.studentId, row.enrollmentId, {
          paymentMethod: 'cash',
        });
        if (!res?.success) throw new Error(res?.message || 'Thanh toán thất bại');
      } else {
        await markStudentPaid(row.studentId);
      }
      toast.dismiss(tid);
      toast.success('Đã xác nhận thu học phí');
      mutate((key) => Array.isArray(key) && key[0] === 'admin_finance_v2');
      mutate((key) => Array.isArray(key) && (key[0] === 'finance_summary' || key[0] === 'finance_ledger'));
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.message || 'Lỗi thanh toán');
    }
  };

  const exportLedger = async () => {
    const tid = toast.loading('Đang xuất sổ cái chi tiết (Excel)...');
    try {
      await exportLedgerExcel({
        branchId: branchKey,
        type: ledgerType || undefined,
      });
      api.systemLogs.create({
        action: 'TẢI BÁO CÁO TÀI CHÍNH',
        category: 'finance',
        message: 'Tải file báo cáo tài chính chi tiết (sổ cái Excel)',
        target: 'finance-ledger-xlsx',
      }).catch(() => { });
      addSystemLog('Xuất sổ cái', 'Tài chính (Ledger)', 'Admin', 'bg-orange-500 text-white');
      toast.dismiss(tid);
      toast.success('Xuất sổ cái chi tiết thành công');
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.message || 'Xuất thất bại');
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
      {/* P2 P&L strip - 5 ô đều: mobile 2+2+full, md+ 5 cột */}
      {ledger && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Doanh thu gộp', value: totalGross || 0, tone: 'text-slate-800' },
            { label: 'Hoàn tiền', value: totalRefunded, tone: 'text-red-600', neg: true },
            { label: 'Doanh thu thuần', value: totalNet, tone: 'text-emerald-700' },
            { label: 'Chi phí (Ledger)', value: totalCosts, tone: 'text-blue-700', neg: true },
            { label: 'Lợi nhuận', value: totalProfit, tone: totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
          ].map((m, idx, arr) => (
            <div
              key={m.label}
              className={`cms-m-card p-3 sm:p-4 min-w-0 ${idx === arr.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}
            >
              <p className="text-[10px] font-black text-slate-400  tracking-wider mb-1">{m.label}</p>
              <p className={`text-base sm:text-lg font-extrabold break-words tabular-nums ${m.tone}`}>
                {m.neg && m.value > 0 ? '−' : ''}{(Number(m.value) || 0).toLocaleString('vi-VN')}đ
              </p>
            </div>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 ${canManageTeacherPayoutUi ? 'lg:grid-cols-2 lg:items-stretch' : ''} gap-4 sm:gap-6`}>
        <div className="cms-m-card flex flex-col overflow-hidden shadow-sm min-h-0 max-lg:h-auto lg:min-h-[28rem] lg:h-[min(32rem,calc(100dvh-14rem))]">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0 shrink-0">
            <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
              <DollarSign size={18} className="text-sky-700 flex-shrink-0" /> Doanh Thu Học Phí
            </h3>
            <button
              type="button"
              onClick={() => {
                const tid = toast.loading('Đang xuất báo cáo doanh thu...');
                try {
                  const exportData = financeRows.map((r) => ({
                    'Mã HV': r.studentCode || 'N/A',
                    'Học viên': r.studentName || 'N/A',
                    'Khóa học': r.courseName || 'N/A',
                    'Số tiền (VNĐ)': r.price || 0,
                    'Trạng thái': r.kind === 'refund' ? 'Hoàn' : (r.paid ? 'Đã nộp' : 'Chưa nộp'),
                  }));
                  if (exportData.length === 0) throw new Error('Không có dữ liệu học phí');
                  exportToCSV(exportData, `BaoCaoDoanhThu_${new Date().toISOString().split('T')[0]}.csv`);
                  api.systemLogs.create({
                    action: 'TẢI BÁO CÁO DOANH THU',
                    category: 'finance',
                    message: 'Tải file báo cáo doanh thu học phí',
                    target: 'finance-revenue-csv',
                  }).catch(() => { });
                  addSystemLog('Xuất báo cáo', 'Tài chính (Doanh thu học phí)', 'Admin', 'bg-orange-500 text-white');
                  toast.dismiss(tid);
                  toast.success('Xuất báo cáo doanh thu thành công!');
                } catch (e) {
                  toast.dismiss(tid);
                  toast.error('Xuất thất bại: ' + (e.message || 'Lỗi'));
                }
              }}
              className="cms-m-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 w-full sm:w-auto shrink-0 text-[13px]"
            >
              <Download size={14} className="shrink-0" />
              <span className="sm:hidden">Xuất CSV</span>
              <span className="hidden sm:inline">Xuất báo cáo doanh thu</span>
            </button>
          </div>
          <div className="p-3 sm:p-4 shrink-0">
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-950 rounded-2xl p-3.5 sm:p-5 text-white shadow-[0_6px_20px_rgba(5,150,105,0.25)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <DollarSign size={80} />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div className="min-w-0">
                  <p className="text-emerald-100 text-xs font-semibold tracking-wide">
                    Doanh thu thuần {ledger ? '(Ledger)' : '(Đã thu − Hoàn)'}
                  </p>
                  <p className="text-[1.35rem] sm:text-3xl font-extrabold mt-1.5 break-words">
                    {totalNet.toLocaleString('vi-VN')}đ
                  </p>
                  {totalGross != null && (
                    <p className="text-[11px] text-emerald-100/80 mt-1">
                      Gross {totalGross.toLocaleString('vi-VN')}đ
                    </p>
                  )}
                </div>
                {ledger && (
                  <div className="bg-white/20 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 max-w-full min-w-0 self-start min-h-11">
                    <TrendingUp size={14} className="text-emerald-300 shrink-0" />
                    <span className="text-xs font-bold tabular-nums truncate min-w-0">
                      LN {(totalProfit || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4 text-xs font-semibold text-emerald-100 border-t border-white/10 pt-3">
                <div className="min-w-0 bg-white/5 px-2.5 sm:px-3 py-2 rounded-xl border border-white/5">
                  <p className="opacity-70 mb-0.5 truncate">Dự kiến</p>
                  <p className="text-sm sm:text-[15px] font-bold text-white break-words tabular-nums">{totalListed.toLocaleString('vi-VN')}đ</p>
                </div>
                <div className="min-w-0 bg-white/5 px-2.5 sm:px-3 py-2 rounded-xl border border-white/5">
                  <p className="opacity-70 mb-0.5 truncate">Đã hoàn</p>
                  <p className="text-sm sm:text-[15px] font-bold text-red-200 break-words tabular-nums">
                    {totalRefunded > 0 ? `−${totalRefunded.toLocaleString('vi-VN')}đ` : '0đ'}
                  </p>
                </div>
                <div className="min-w-0 bg-white/5 px-2.5 sm:px-3 py-2 rounded-xl border border-white/5">
                  <p className="opacity-70 mb-0.5 truncate">Công nợ</p>
                  <p className="text-sm sm:text-[15px] font-bold text-red-200 break-words tabular-nums">{totalDebt.toLocaleString('vi-VN')}đ</p>
                </div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-50 border-t border-slate-50 flex-1 min-h-[220px] overflow-y-auto overscroll-contain relative">
            {isLoadingFinance && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"><RefreshCw className="animate-spin text-indigo-500" /></div>}
            {!isLoadingFinance && financeRows.length === 0 && (
              <div className="cms-m-empty min-h-[160px]">Chưa có giao dịch học phí.</div>
            )}
            {financeRows.map((r) => {
              const isRefund = r.kind === 'refund';
              return (
                <div key={r.key} className="cms-m-list-row hover:bg-slate-50 flex-col lg:flex-row lg:items-center">
                  <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-[1.5]">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${isRefund ? 'bg-red-500' : (r.paid ? 'bg-emerald-500' : 'bg-amber-500')
                      }`}>
                      {(r.studentName || '?')[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="cms-m-list-title">{r.studentName}</p>
                      <p className="cms-m-caption lg:hidden line-clamp-1">
                        {r.studentCode ? `${r.studentCode} · ` : ''}{r.courseName}
                      </p>
                      <p className="cms-m-caption hidden lg:block">
                        {r.studentCode || ''}
                      </p>
                    </div>
                  </div>
                  <div className="hidden lg:block min-w-0 flex-1">
                    <p className="text-[13px] text-slate-700 font-semibold truncate">{r.courseName}</p>
                    <p className="text-[11px] text-slate-400">Khóa học</p>
                  </div>
                  <div className="hidden lg:block min-w-0 flex-1">
                    <p className="text-[13px] text-slate-700 font-semibold truncate">{r.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</p>
                    <p className="text-[11px] text-slate-400">Hình thức</p>
                  </div>
                  <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:flex-wrap min-[640px]:items-center min-[640px]:justify-end min-w-0 w-full min-[640px]:w-auto lg:flex-1">
                    <div className="text-left min-[640px]:text-right min-w-0">
                      <p className={`text-[15px] font-extrabold break-words tabular-nums ${isRefund ? 'text-red-600' : 'text-slate-900'}`}>
                        {(Number(r.price) || 0).toLocaleString('vi-VN')}đ
                      </p>
                      <div className="flex items-center gap-1.5 min-[640px]:justify-end">
                        <span className={`text-[13px] font-bold ${isRefund ? 'text-red-600' : (r.paid ? 'text-sky-700' : 'text-red-500')
                          }`}>
                          {isRefund ? 'Hoàn' : (r.paid ? 'Đã nộp' : 'Chưa nộp')}
                        </span>
                        <span className="lg:hidden text-[11px] font-medium text-slate-400">· {r.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                      </div>
                    </div>
                    {!isRefund && !r.paid && (
                      <button
                        type="button"
                        onClick={() => handlePayRow(r)}
                        className="cms-m-btn bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 w-full min-[640px]:w-auto shrink-0"
                      >
                        Xác nhận thu
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {canManageTeacherPayoutUi && (
          <div className="cms-m-card flex flex-col overflow-hidden shadow-sm min-h-0 max-lg:h-auto lg:min-h-[28rem] lg:h-[min(32rem,calc(100dvh-14rem))]">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0 shrink-0">
              <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
                <CreditCard size={18} className="text-blue-600 flex-shrink-0" /> Thanh Toán Giảng Viên
              </h3>
              <button
                type="button"
                onClick={async () => {
                  const tid = toast.loading('Đang xuất báo cáo lương GV (Excel)...');
                  try {
                    if (!financialData.length) throw new Error('Không có dữ liệu giao dịch');
                    await exportTransactionsExcel(branchKey !== 'all' ? { branchId: branchKey } : {});
                    api.systemLogs.create({
                      action: 'TẢI BÁO CÁO TÀI CHÍNH',
                      category: 'finance',
                      message: 'Tải file báo cáo chi tiết lương giảng viên (Excel)',
                      target: 'finance-transactions-xlsx',
                    }).catch(() => { });
                    addSystemLog('Xuất báo cáo', 'Tài chính (Lương GV chi tiết)', 'Admin', 'bg-orange-500 text-white');
                    toast.dismiss(tid);
                    toast.success('Xuất báo cáo chi tiết thành công!');
                  } catch (e) {
                    toast.dismiss(tid);
                    toast.error(e.message || 'Lỗi khi xuất file');
                  }
                }}
                className="cms-m-btn bg-slate-800 text-white hover:bg-slate-700 w-full sm:w-auto shrink-0 text-[13px]"
              >
                <Download size={14} className="shrink-0" />
                <span className="sm:hidden">Xuất Excel</span>
                <span className="hidden sm:inline">Xuất Báo Cáo</span>
              </button>
            </div>
            <div className="p-3 sm:p-4 shrink-0">
              <div className="bg-slate-800 rounded-2xl p-3.5 sm:p-5 text-white shadow-lg relative overflow-hidden">
                {isLoadingFinance ? <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center"><RefreshCw className="animate-spin text-white" size={24} /></div> : null}
                <p className="text-slate-400 text-xs font-semibold tracking-wide">
                  Chi phí {ledger && totalCosts > 0 ? '(Ledger salary+)' : '(phiếu chi)'}
                </p>
                <p className="text-[1.35rem] sm:text-3xl font-extrabold mt-1.5 break-words">
                  {teacherPaid.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Lợi nhuận ước tính: {(totalProfit || 0).toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-50 border-t border-slate-50 flex-1 min-h-[220px] overflow-y-auto overscroll-contain">
              {financialData.map((t) => {
                const txKey = String(t.id || t._id || '');
                const isExpanded = expandedTxIds.has(txKey);
                const bankInfo = t.teacherId?.bankAccount || t.bankAccount;
                const sessCount = Number(t.totalSessionsCount || t.sessionsCount || t.sessionDetails?.length || 0);
                const stuCount = Number(t.totalStudentsCount || t.studentSummary?.length || 0);
                const summaryLine = t.fullSessionsText || t.description || t.note || 'Thù lao';
                const canExpand = (t.sessionDetails?.length > 0) || Boolean(t.description || t.note);
                return (
                  <div key={txKey} className="min-w-0 border-b border-slate-50 last:border-b-0">
                    <div className="cms-m-list-row hover:bg-slate-50">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                          <Users size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="cms-m-list-title">{t.teacherId?.name || t.teacherName || 'Giảng viên'}</p>
                            {sessCount > 0 && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                                {sessCount} buổi{stuCount > 0 ? ` · ${stuCount} HV` : ''}
                              </span>
                            )}
                          </div>
                          <p className={`cms-m-caption mt-0.5 ${isExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
                            {summaryLine}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[15px] font-extrabold text-blue-600 break-words tabular-nums">-{t.amount ? t.amount.toLocaleString('vi-VN') : 0}đ</p>
                          <p className="cms-m-caption">{t.date || new Date(t.createdAt).toLocaleDateString('vi-VN')}</p>
                        </div>
                        {canExpand && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedId(setExpandedTxIds, txKey)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            <span>{isExpanded ? 'Thu gọn' : (stuCount > 0 ? `Chi tiết (${stuCount} HV)` : 'Chi tiết')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {bankInfo?.accountNumber && (
                      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap min-w-0">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-xl border border-emerald-100">
                          <CreditCard size={10} /> {bankInfo.bankName || 'N/A'}
                        </span>
                        <span className="text-[12px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100">
                          STK: {bankInfo.accountNumber}
                        </span>
                      </div>
                    )}
                    {isExpanded && (
                      <PayoutSessionDetailPanel
                        sessionDetails={t.sessionDetails}
                        studentSummary={t.studentSummary}
                        totalSessionsCount={sessCount}
                        totalStudentsCount={stuCount}
                        starBonusAmount={t.starBonusAmount}
                        confirmedBy={t.confirmedBy}
                        rawNote={t.description || t.note || ''}
                      />
                    )}
                  </div>
                );
              })}
              {financialData.length === 0 && !isLoadingFinance && (
                <div className="cms-m-empty min-h-[160px]">Chưa có giao dịch chi nào.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* P1: Sổ cái Ledger */}
      <div className="cms-m-card flex flex-col min-h-[16rem] overflow-hidden shadow-sm">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between shrink-0 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
              <BookOpen size={18} className="text-indigo-600 shrink-0" /> Sổ cái (Ledger)
            </h3>
            {ledgerTotal > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 tabular-nums">
                {ledgerLines.length}/{ledgerTotal} dòng
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap items-stretch sm:items-center w-full sm:w-auto min-w-0">
            <select
              className="cms-m-btn border border-slate-200 bg-white text-slate-700 text-[13px] w-full sm:w-auto min-w-0 max-w-full"
              value={ledgerType}
              onChange={(e) => {
                setLedgerType(e.target.value);
                setLedgerLimit(40);
              }}
            >
              <option value="">Tất cả loại</option>
              <option value="payment">Thanh toán</option>
              <option value="refund">Hoàn tiền</option>
              <option value="salary">Lương</option>
              <option value="expense,bonus">Chi phí khác</option>
              <option value="discount,coupon">Giảm giá</option>
              <option value="adjustment">Điều chỉnh</option>
            </select>
            <button type="button" onClick={exportLedger} className="cms-m-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[13px] w-full sm:w-auto shrink-0">
              <Download size={14} className="shrink-0" />
              <span className="sm:hidden">Xuất Excel</span>
              <span className="hidden sm:inline">Xuất sổ cái</span>
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-50 flex-1 min-h-0 overflow-y-auto overscroll-contain relative">
          {loadingBook && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
              <RefreshCw className="animate-spin text-indigo-500" />
            </div>
          )}
          {!loadingBook && ledgerLines.length === 0 && (
            <div className="cms-m-empty min-h-[120px]">Chưa có dòng sổ cái.</div>
          )}
          {ledgerLines.map((line) => {
            const lineKey = String(line._id || '');
            const isExpanded = expandedLedgerIds.has(lineKey);
            const signed = Number(line.signedAmount != null ? line.signedAmount : line.amount) || 0;
            const neg = signed < 0 || line.type === 'refund' || line.type === 'salary';
            const isSalary = line.type === 'salary';
            const sessCount = Number(line.totalSessionsCount || line.sessionDetails?.length || 0);
            const stuCount = Number(line.totalStudentsCount || line.studentSummary?.length || 0);
            const summaryDetail = isSalary
              ? (line.fullSessionsText || line.note || '')
              : (line.note || '');
            const canExpand = isSalary && ((line.sessionDetails?.length > 0) || Boolean(line.note));

            return (
              <div key={lineKey} className="min-w-0">
                <div className="cms-m-list-row hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="cms-m-list-title">
                        {TYPE_LABEL[line.type] || line.type}
                        {isSalary && line.teacherName ? ` · ${line.teacherName}` : ''}
                        {!isSalary && line.studentName ? ` · ${line.studentName}${line.studentCode ? ` (${line.studentCode})` : ''}` : ''}
                        {line.courseName ? ` · ${line.courseName}` : ''}
                      </p>
                      {isSalary && sessCount > 0 && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                          {sessCount} buổi{stuCount > 0 ? ` · ${stuCount} HV` : ''}
                        </span>
                      )}
                    </div>
                    <p className={`cms-m-caption mt-0.5 ${isExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
                      {line.postedAt ? new Date(line.postedAt).toLocaleString('vi-VN') : '-'}
                      {summaryDetail ? ` · ${summaryDetail}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className={`text-[15px] font-extrabold tabular-nums ${neg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {neg ? '−' : ''}{Math.abs(signed).toLocaleString('vi-VN')}đ
                    </p>
                    {canExpand && (
                      <button
                        type="button"
                        onClick={() => toggleExpandedId(setExpandedLedgerIds, lineKey)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition"
                      >
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        <span>{isExpanded ? 'Thu gọn' : (stuCount > 0 ? `Chi tiết (${stuCount} HV)` : 'Xem nội dung')}</span>
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <PayoutSessionDetailPanel
                    sessionDetails={line.sessionDetails}
                    studentSummary={line.studentSummary}
                    totalSessionsCount={sessCount}
                    totalStudentsCount={stuCount}
                    starBonusAmount={line.metadata?.starBonusAmount}
                    confirmedBy={line.postedBy}
                    rawNote={line.note || ''}
                  />
                )}
              </div>
            );
          })}
          {!loadingBook && ledgerLines.length < ledgerTotal && ledgerLimit < 200 && (
            <div className="p-3 text-center bg-slate-50/40">
              <button
                type="button"
                onClick={() => setLedgerLimit((prev) => Math.min(200, prev + 40))}
                className="cms-m-btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs"
              >
                Xem thêm bút toán ({ledgerLines.length}/{ledgerTotal})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
