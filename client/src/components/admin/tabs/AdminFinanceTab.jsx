import React, { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useAdminTab } from '../AdminTabContext';
import {
  DollarSign, Download, TrendingUp, RefreshCw, CreditCard, Users, BookOpen,
} from 'lucide-react';
import { exportToCSV } from '../../../utils/exportExcel';
import {
  expandFinanceEnrollmentRows,
  summarizeFinanceEnrollmentRows,
} from '../../../utils/enrollments';
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
    isSuperAdmin, toast, addSystemLog,
    financeStudents, isLoadingFinance, markStudentPaid, financialData,
  } = useAdminTab();
  const { selectedBranchId } = useBranch();
  const [ledgerType, setLedgerType] = useState('');

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
    ['finance_ledger', branchKey, ledgerType],
    () => api.finance.ledger({
      branchId: branchKey,
      type: ledgerType || undefined,
      limit: 40,
    }),
    { revalidateOnFocus: false, dedupingInterval: 15000 },
  );
  const ledgerLines = bookRes?.success ? (bookRes.data?.items || []) : [];

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

  const exportLedger = () => {
    const tid = toast.loading('Đang xuất sổ cái...');
    try {
      const exportData = ledgerLines.map((line) => ({
        'Ngày': line.postedAt ? new Date(line.postedAt).toLocaleString('vi-VN') : '',
        'Loại': TYPE_LABEL[line.type] || line.type,
        'Số tiền': Number(line.signedAmount != null ? line.signedAmount : line.amount) || 0,
        'Khóa/Nội dung': line.courseName || line.note || '',
        'Mã': String(line._id || '').slice(-8),
      }));
      if (!exportData.length) throw new Error('Chưa có dòng sổ cái');
      exportToCSV(exportData, `SoCai_${new Date().toISOString().split('T')[0]}.csv`);
      api.systemLogs.create({
        action: 'TẢI BÁO CÁO TÀI CHÍNH',
        category: 'finance',
        message: 'Tải file báo cáo tài chính (sổ cái)',
        target: 'finance-ledger-csv',
      }).catch(() => {});
      addSystemLog('Xuất sổ cái', 'Tài chính (Ledger)', 'Admin', 'bg-orange-500 text-white');
      toast.dismiss(tid);
      toast.success('Xuất sổ cái thành công');
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.message || 'Xuất thất bại');
    }
  };

  return (
    <div className="cms-viewport-fill">
      {/* P2 P&L strip */}
      {ledger && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
          {[
            { label: 'Doanh thu gộp', value: totalGross || 0, tone: 'text-slate-800' },
            { label: 'Hoàn tiền', value: totalRefunded, tone: 'text-red-600', neg: true },
            { label: 'Doanh thu thuần', value: totalNet, tone: 'text-emerald-700' },
            { label: 'Chi phí (Ledger)', value: totalCosts, tone: 'text-blue-700', neg: true },
            { label: 'Lợi nhuận', value: totalProfit, tone: totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
          ].map((m) => (
            <div key={m.label} className="cms-m-card !p-3 sm:!p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{m.label}</p>
              <p className={`text-base sm:text-lg font-extrabold break-words ${m.tone}`}>
                {m.neg && m.value > 0 ? '−' : ''}{(Number(m.value) || 0).toLocaleString('vi-VN')}đ
              </p>
            </div>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-3 sm:gap-4 lg:flex-[1.15] lg:min-h-0`}>
        <div className="cms-m-card flex flex-col min-h-0 overflow-hidden max-lg:max-h-[min(70vh,36rem)]">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0 shrink-0">
            <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
              <DollarSign size={18} className="text-sky-700 flex-shrink-0" /> Doanh Thu Học Phí
            </h3>
            <button
              type="button"
              onClick={() => {
                const tid = toast.loading('Đang xuất báo cáo doanh thu...');
                try {
                  const exportData = financeRows.map((r) => ({
                    'Mã HV': r.studentId || 'N/A',
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
                  }).catch(() => {});
                  addSystemLog('Xuất báo cáo', 'Tài chính (Doanh thu học phí)', 'Admin', 'bg-orange-500 text-white');
                  toast.dismiss(tid);
                  toast.success('Xuất báo cáo doanh thu thành công!');
                } catch (e) {
                  toast.dismiss(tid);
                  toast.error('Xuất thất bại: ' + (e.message || 'Lỗi'));
                }
              }}
              className="cms-m-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex-1 sm:flex-initial text-[13px]"
            >
              <Download size={14} className="flex-shrink-0" /> Xuất báo cáo doanh thu
            </button>
          </div>
          <div className="p-3 sm:p-4 shrink-0">
            <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-2xl p-3 sm:p-5 text-white shadow-[0_6px_20px_rgba(220,38,38,0.25)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <DollarSign size={80} />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div className="min-w-0">
                  <p className="text-red-100 text-[12px] font-semibold tracking-wide">
                    Doanh thu thuần {ledger ? '(Ledger)' : '(Đã thu − Hoàn)'}
                  </p>
                  <p className="text-[1.35rem] sm:text-3xl font-extrabold mt-1.5 break-words">
                    {totalNet.toLocaleString('vi-VN')}đ
                  </p>
                  {totalGross != null && (
                    <p className="text-[11px] text-red-100/80 mt-1">
                      Gross {totalGross.toLocaleString('vi-VN')}đ
                    </p>
                  )}
                </div>
                {ledger && (
                  <div className="bg-white/20 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 shrink-0 self-start min-h-11">
                    <TrendingUp size={14} className="text-emerald-300" />
                    <span className="text-[12px] font-bold">
                      LN {(totalProfit || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4 text-[12px] font-semibold text-red-100 border-t border-white/10 pt-3">
                <div className="flex-1 min-w-[100px] bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                  <p className="opacity-70 mb-0.5">Dự kiến (Tất cả)</p>
                  <p className="text-[14px] sm:text-[15px] font-bold text-white">{totalListed.toLocaleString('vi-VN')}đ</p>
                </div>
                <div className="flex-1 min-w-[100px] bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                  <p className="opacity-70 mb-0.5">Đã hoàn</p>
                  <p className="text-[14px] sm:text-[15px] font-bold text-red-200">
                    {totalRefunded > 0 ? `−${totalRefunded.toLocaleString('vi-VN')}đ` : '0đ'}
                  </p>
                </div>
                <div className="flex-1 min-w-[100px] bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                  <p className="opacity-70 mb-0.5">Công nợ (Chưa thu)</p>
                  <p className="text-[14px] sm:text-[15px] font-bold text-red-200">{totalDebt.toLocaleString('vi-VN')}đ</p>
                </div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-50 border-t border-slate-50 flex-1 min-h-0 overflow-y-auto overscroll-contain relative">
            {isLoadingFinance && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"><RefreshCw className="animate-spin text-indigo-500" /></div>}
            {!isLoadingFinance && financeRows.length === 0 && (
              <div className="cms-m-empty min-h-[160px]">Chưa có giao dịch học phí.</div>
            )}
            {financeRows.map((r) => {
              const isRefund = r.kind === 'refund';
              return (
                <div key={r.key} className="cms-m-list-row hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                      isRefund ? 'bg-red-500' : (r.paid ? 'bg-emerald-500' : 'bg-amber-500')
                    }`}>
                      {(r.studentName || '?')[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="cms-m-list-title">{r.studentName}</p>
                      <p className="cms-m-caption line-clamp-2">{r.courseName}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="text-left sm:text-right min-w-0">
                      <p className={`text-[15px] font-extrabold break-words ${isRefund ? 'text-red-600' : 'text-slate-900'}`}>
                        {(Number(r.price) || 0).toLocaleString('vi-VN')}đ
                      </p>
                      <span className={`text-[13px] font-bold ${
                        isRefund ? 'text-red-600' : (r.paid ? 'text-sky-700' : 'text-red-500')
                      }`}>
                        {isRefund ? 'Hoàn' : (r.paid ? 'Đã nộp' : 'Chưa nộp')}
                      </span>
                    </div>
                    {!isRefund && !r.paid && (
                      <button
                        type="button"
                        onClick={() => handlePayRow(r)}
                        className="cms-m-btn bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 w-full sm:w-auto"
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

        {isSuperAdmin && (
          <div className="cms-m-card flex flex-col min-h-0 overflow-hidden max-lg:max-h-[min(70vh,36rem)]">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0 shrink-0">
              <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
                <CreditCard size={18} className="text-blue-600 flex-shrink-0" /> Thanh Toán Giảng Viên
              </h3>
              <button
                type="button"
                onClick={() => {
                  const tid = toast.loading('Đang xuất báo cáo hóa đơn...');
                  try {
                    const exportData = financialData.map((t) => ({
                      'Mã GD': t.id || t._id || 'N/A',
                      'Ngày': t.date || new Date(t.createdAt).toLocaleDateString('vi-VN'),
                      'Loại': t.description || 'Thù lao',
                      'Người nhận': t.teacherId?.name || t.teacherName || 'N/A',
                      'SĐT': t.teacherPhone || 'N/A',
                      'Số tiền (VNĐ)': t.amount,
                      'Trạng thái': t.status === 'confirmed' ? 'Đã thanh toán' : 'Chờ xử lý',
                    }));
                    if (exportData.length === 0) throw new Error('Không có dữ liệu giao dịch');
                    exportToCSV(exportData, `BaoCaoTaiChinh_${new Date().toISOString().split('T')[0]}.csv`);
                    api.systemLogs.create({
                      action: 'TẢI BÁO CÁO TÀI CHÍNH',
                      category: 'finance',
                      message: 'Tải file báo cáo tài chính (phiếu chi lương)',
                      target: 'finance-transactions-csv',
                    }).catch(() => {});
                    toast.dismiss(tid);
                    toast.success('Xuất báo cáo tài chính thành công!');
                  } catch (e) {
                    toast.dismiss(tid);
                    toast.error(e.message || 'Lỗi khi xuất file');
                  }
                }}
                className="cms-m-btn bg-slate-800 text-white hover:bg-slate-700 w-full sm:w-auto"
              >
                <Download size={16} /> Xuất Báo Cáo
              </button>
            </div>
            <div className="p-3 sm:p-4 shrink-0">
              <div className="bg-slate-800 rounded-2xl p-3 sm:p-5 text-white shadow-lg relative overflow-hidden">
                {isLoadingFinance ? <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center"><RefreshCw className="animate-spin text-white" size={24} /></div> : null}
                <p className="text-slate-400 text-[12px] font-semibold tracking-wide">
                  Chi phí {ledger && totalCosts > 0 ? '(Ledger salary+)' : '(phiếu chi)'}
                </p>
                <p className="text-[1.35rem] sm:text-3xl font-extrabold mt-1.5 break-words">
                  {teacherPaid.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-[12px] text-slate-500 mt-2 font-medium">
                  Lợi nhuận ước tính: {(totalProfit || 0).toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-50 border-t border-slate-50 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {financialData.map((t) => {
                const bankInfo = t.teacherId?.bankAccount || t.bankAccount;
                return (
                  <div key={t.id || t._id} className="px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors duration-200 min-w-0">
                    <div className="cms-m-list-row !p-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <Users size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="cms-m-list-title">{t.teacherId?.name || t.teacherName || 'Giảng viên'}</p>
                          <p className="cms-m-caption line-clamp-2">{t.description || t.note || 'Thù lao'}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-[15px] font-extrabold text-blue-600 break-words">-{t.amount ? t.amount.toLocaleString('vi-VN') : 0}đ</p>
                        <p className="cms-m-caption">{t.date || new Date(t.createdAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                    {bankInfo?.accountNumber && (
                      <div className="mt-2 ml-0 sm:ml-13 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-xl border border-emerald-100">
                          <CreditCard size={10} /> {bankInfo.bankName || 'N/A'}
                        </span>
                        <span className="text-[12px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100">
                          STK: {bankInfo.accountNumber}
                        </span>
                      </div>
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
      <div className="cms-m-card flex flex-col min-h-0 overflow-hidden lg:flex-1 max-lg:max-h-[min(55vh,28rem)]">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <h3 className="cms-m-heading flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-600" /> Sổ cái (Ledger)
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="cms-m-btn border border-slate-200 bg-white text-slate-700 text-[13px]"
              value={ledgerType}
              onChange={(e) => setLedgerType(e.target.value)}
            >
              <option value="">Tất cả loại</option>
              <option value="payment">Thanh toán</option>
              <option value="refund">Hoàn tiền</option>
              <option value="salary">Lương</option>
              <option value="expense,bonus">Chi phí khác</option>
              <option value="discount,coupon">Giảm giá</option>
              <option value="adjustment">Điều chỉnh</option>
            </select>
            <button type="button" onClick={exportLedger} className="cms-m-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[13px]">
              <Download size={14} /> Xuất sổ cái
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
            const signed = Number(line.signedAmount != null ? line.signedAmount : line.amount) || 0;
            const neg = signed < 0 || line.type === 'refund' || line.type === 'salary';
            return (
              <div key={line._id} className="cms-m-list-row hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="cms-m-list-title">
                    {TYPE_LABEL[line.type] || line.type}
                    {line.courseName ? ` · ${line.courseName}` : ''}
                  </p>
                  <p className="cms-m-caption">
                    {line.postedAt ? new Date(line.postedAt).toLocaleString('vi-VN') : '—'}
                    {line.note ? ` · ${line.note}` : ''}
                  </p>
                </div>
                <p className={`text-[15px] font-extrabold shrink-0 ${neg ? 'text-red-600' : 'text-emerald-700'}`}>
                  {neg ? '−' : ''}{Math.abs(signed).toLocaleString('vi-VN')}đ
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
