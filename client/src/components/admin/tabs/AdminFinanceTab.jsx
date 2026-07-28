import React, { useMemo } from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  DollarSign, Download, TrendingUp, RefreshCw, CreditCard, Users,
} from 'lucide-react';
import { exportToCSV } from '../../../utils/exportExcel';
import {
  expandFinanceEnrollmentRows,
} from '../../../utils/enrollments';
import api from '../../../services/api';
import { mutate } from 'swr';

export default function AdminFinanceTab() {
  const {
    isSuperAdmin, toast, addSystemLog,
    financeStudents, isLoadingFinance, markStudentPaid, financialData,
  } = useAdminTab();

  const financeRows = useMemo(
    () => expandFinanceEnrollmentRows(financeStudents),
    [financeStudents],
  );
  const totalCollected = financeRows.filter((r) => r.paid).reduce((s, r) => s + r.price, 0);
  const totalListed = financeRows.reduce((s, r) => s + r.price, 0);
  const totalDebt = Math.max(0, totalListed - totalCollected);

  const handlePayRow = async (row) => {
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
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.message || 'Lỗi thanh toán');
    }
  };

  return (
            <div className="space-y-4 sm:space-y-6">
              <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-4 sm:gap-6`}>
                {/* Revenue Card */}
                <div className="cms-m-card">
                  <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
                    <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
                      <DollarSign size={18} className="text-sky-700 flex-shrink-0" /> Doanh Thu Học Phí
                    </h3>
                    <div className="flex items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                            const tid = toast.loading('Đang xuất báo cáo doanh thu...');
                            try {
                              const exportData = financeRows.map((r) => ({
                                "Mã HV": r.studentId || "N/A",
                                "Học viên": r.studentName || "N/A",
                                "Khóa học": r.courseName || "N/A",
                                "Số tiền (VNĐ)": r.price || 0,
                                "Trạng thái": r.paid ? "Đã nộp" : "Chưa nộp",
                              }));
                              if (exportData.length === 0) throw new Error('Không có dữ liệu học phí');
                              exportToCSV(exportData, `BaoCaoDoanhThu_${new Date().toISOString().split('T')[0]}.csv`);
                              addSystemLog('Xuất báo cáo', 'Tài chính (Doanh thu học phí)', 'Admin', 'bg-orange-500 text-white');
                              toast.dismiss(tid);
                              toast.success('Xuất báo cáo doanh thu thành công!');
                            } catch (e) {
                              toast.dismiss(tid);
                              toast.error('Xuất thất bại: ' + (e.message || 'Lỗi'));
                            }
                        }}
                        className="cms-m-btn border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex-1 sm:flex-initial text-[13px]">
                        <Download size={14} className="flex-shrink-0" /> Xuất báo cáo doanh thu
                      </button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-2xl p-4 sm:p-6 text-white shadow-[0_6px_20px_rgba(220,38,38,0.25)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={80} />
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                        <div className="min-w-0">
                          <p className="text-red-100 text-[12px] font-semibold tracking-wide">Tổng doanh thu thực tế (Đã thu)</p>
                          <p className="text-[1.5rem] sm:text-4xl font-extrabold mt-2 break-words">
                            {totalCollected.toLocaleString('vi-VN')}đ
                          </p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 shrink-0 self-start min-h-11">
                          <TrendingUp size={14} className="text-emerald-300" />
                          <span className="text-[12px] font-bold">+12.5% vs tháng trước</span>
                        </div>
                      </div>

                      <div className="mt-6 h-16 flex items-end gap-1.5 px-1" aria-hidden="true">
                        {[30, 45, 35, 60, 50, 80, 75, 95].map((h, i) => (
                          <div key={i} className="flex-1 bg-white/20 rounded-t-sm hover:bg-white/40 transition-all duration-200 cursor-pointer relative group" style={{ height: `${h}%` }}>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-red-600 px-1.5 py-0.5 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity">
                              {h}M
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3 mt-5 text-[12px] font-semibold text-red-100 border-t border-white/10 pt-4">
                        <div className="flex-1 min-w-[140px] bg-white/5 px-3 py-2.5 rounded-xl border border-white/5">
                          <p className="opacity-70 mb-0.5">Dự kiến (Tất cả)</p>
                          <p className="text-[15px] font-bold text-white">{totalListed.toLocaleString('vi-VN')}đ</p>
                        </div>
                        <div className="flex-1 min-w-[140px] bg-white/5 px-3 py-2.5 rounded-xl border border-white/5">
                          <p className="opacity-70 mb-0.5">Công nợ (Chưa thu)</p>
                          <p className="text-[15px] font-bold text-red-200">{totalDebt.toLocaleString('vi-VN')}đ</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 border-t border-slate-50 max-h-80 overflow-y-auto relative">
                    {isLoadingFinance && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"><RefreshCw className="animate-spin text-indigo-500" /></div>}
                    {!isLoadingFinance && financeRows.length === 0 && (
                      <div className="cms-m-empty min-h-[160px]">Chưa có giao dịch học phí.</div>
                    )}
                    {financeRows.map((r) => (
                      <div key={r.key} className="cms-m-list-row hover:bg-slate-50">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${r.paid ? 'bg-emerald-500' : 'bg-red-500'}`}>
                            {(r.studentName || '?')[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="cms-m-list-title">{r.studentName}</p>
                            <p className="cms-m-caption line-clamp-2">{r.courseName}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <div className="text-left sm:text-right min-w-0">
                            <p className="text-[15px] font-extrabold text-slate-900 break-words">{(r.price || 0).toLocaleString('vi-VN')}đ</p>
                            <span className={`text-[13px] font-bold ${r.paid ? 'text-sky-700' : 'text-red-500'}`}>
                              {r.paid ? 'Đã nộp' : 'Chưa nộp'}
                            </span>
                          </div>
                          {!r.paid && (
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
                    ))}
                  </div>
                </div>

                {/* Expense Card (Teacher Payouts) — CHỈ Super Admin */}
                {isSuperAdmin && (
                <div className="cms-m-card">
                  <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                    <h3 className="cms-m-heading flex items-center gap-2 min-w-0">
                      <CreditCard size={18} className="text-blue-600 flex-shrink-0" /> Thanh Toán Giảng Viên
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                          const tid = toast.loading('Đang xuất báo cáo hóa đơn...');
                          try {
                            const exportData = financialData.map(t => ({
                              "Mã GD": t.id || t._id || "N/A",
                              "Ngày": t.date || new Date(t.createdAt).toLocaleDateString('vi-VN'),
                              "Loại": t.description || 'Thù lao',
                              "Người nhận": t.teacherId?.name || t.teacherName || "N/A",
                              "SĐT": t.teacherPhone || "N/A",
                              "Số tiền (VNĐ)": t.amount,
                              "Trạng thái": t.status === 'confirmed' ? "Đã thanh toán" : "Chờ xử lý"
                            }));
                            if (exportData.length === 0) throw new Error('Không có dữ liệu giao dịch');
                            exportToCSV(exportData, `BaoCaoTaiChinh_${new Date().toISOString().split('T')[0]}.csv`);
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
                  <div className="p-4 sm:p-6">
                    <div className="bg-slate-800 rounded-2xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden">
                      {isLoadingFinance ? <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center"><RefreshCw className="animate-spin text-white" size={24}/></div> : null}
                      <p className="text-slate-400 text-[12px] font-semibold tracking-wide">Tổng thù lao đã chi</p>
                      <p className="text-[1.5rem] sm:text-4xl font-extrabold mt-2 break-words">{(financialData.reduce((s, p) => s + (p.amount || 0), 0)).toLocaleString('vi-VN')}đ</p>
                      <p className="text-[12px] text-slate-500 mt-2 font-medium">Giai đoạn: 01/01 - Hiện tại</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 border-t border-slate-50 max-h-80 overflow-y-auto">
                    {financialData.map(t => {
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
            </div>
  );
}
