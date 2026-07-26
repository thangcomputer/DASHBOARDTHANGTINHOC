import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  DollarSign, Download, TrendingUp, RefreshCw, CreditCard, Users,
} from 'lucide-react';
import { exportToCSV } from '../../../utils/exportExcel';

export default function AdminFinanceTab() {
  const {
    isSuperAdmin, transactions, toast, addSystemLog,
    financeStudents, isLoadingFinance, markStudentPaid, financialData,
  } = useAdminTab();

  return (
            <div className="space-y-6">
              <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-6`}>
                {/* Revenue Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 min-w-0">
                      <DollarSign size={18} className="text-green-600 flex-shrink-0" /> Doanh Thu Học Phí
                    </h3>
                    <div className="flex items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
                      <button
                        onClick={() => {
                          
                            const tid = toast.loading('Đang xuất báo cáo hóa đơn...');
                            try {
                              const financialData = transactions.map(t => ({
                                "Mã GD": t.id || "N/A",
                                "Ngày": t.date || "N/A",
                                "Mô tả": `Thanh toán lương: ${t.teacherName} (Khóa ${t.course})`,
                                "Số tiền": t.amount,
                                "Trạng thái": t.status === 'completed' ? 'Hoàn thành' : (t.status === 'pending' ? 'Đang xử lý' : t.status),
                              }));
                              if (financialData.length === 0) throw new Error('Không có dữ liệu giao dịch');
                              exportToCSV(financialData, `BaoCaoTaiChinh_${new Date().toISOString().split('T')[0]}.csv`);
                              addSystemLog('Xuất báo cáo', 'Tài chính (Chi lương)', 'Admin', 'bg-orange-500 text-white');
                              toast.dismiss(tid);
                              toast.success('Xuất báo cáo tài chính thành công!');
                            } catch (e) {
                              toast.dismiss(tid);
                              toast.error('Xuất thất bại: ' + (e.message || 'Lỗi'));
                            }
                        }}
                        className="text-xs font-black bg-white border border-gray-200 px-2 sm:px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1.5 flex-1 sm:flex-initial whitespace-normal text-center leading-tight">
                        <Download size={12} className="flex-shrink-0" /> XUẤT BÁO CÁO CHI PHÍ
                      </button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="bg-gradient-to-br from-indigo-700 to-blue-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={80} />
                      </div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                        <div className="min-w-0">
                          <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Tổng doanh thu thực tế (Đã thu)</p>
                          <p className="text-2xl sm:text-4xl font-black mt-2 whitespace-nowrap">{(financeStudents.filter(s => s.paid).reduce((sum, s) => sum + (s.price || 0), 0)).toLocaleString('vi-VN')}đ</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1.5 animate-pulse shrink-0 self-start">
                          <TrendingUp size={14} className="text-emerald-300" />
                          <span className="text-xs font-black whitespace-nowrap sm:whitespace-normal">+12.5% vs tháng trước</span>
                        </div>
                      </div>

                      {/* Mini Line Chart Mockup */}
                      <div className="mt-8 h-16 flex items-end gap-1.5 px-1">
                        {[30, 45, 35, 60, 50, 80, 75, 95].map((h, i) => (
                          <div key={i} className="flex-1 bg-white/20 rounded-t-sm hover:bg-white/40 transition-all cursor-pointer relative group" style={{ height: `${h}%` }}>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-blue-600 px-1.5 py-0.5 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity">
                              {h}M
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-4 mt-6 text-xs font-bold text-blue-100 border-t border-white/10 pt-4">
                        <div className="flex-1 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                          <p className="opacity-60 uppercase mb-0.5">Dự kiến (Tất cả)</p>
                          <p className="text-sm">{(financeStudents.reduce((sum, s) => sum + (s.price || 0), 0)).toLocaleString('vi-VN')}đ</p>
                        </div>
                        <div className="flex-1 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                          <p className="opacity-60 uppercase mb-0.5 tracking-tighter">Công nợ (Chưa thu)</p>
                          <p className="text-sm text-red-300">{(financeStudents.filter(s => !s.paid).reduce((sum, s) => sum + (s.price || 0), 0)).toLocaleString('vi-VN')}đ</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50 border-t border-gray-50 max-h-80 overflow-y-auto relative">
                    {isLoadingFinance && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"><RefreshCw className="animate-spin text-indigo-500" /></div>}
                    {financeStudents.map(s => (
                      <div key={s.id} className="px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between hover:bg-gray-50 transition-colors min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${s.paid ? 'bg-green-500' : 'bg-red-400'}`}>
                            {s.name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
                            <p className="text-xs text-gray-400 truncate">{s.course}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end sm:gap-4">
                          <div className="text-left sm:text-right min-w-[7rem]">
                            <p className="text-sm font-black text-gray-800 whitespace-nowrap">{(s.price || 0).toLocaleString('vi-VN')}đ</p>
                            <span className={`text-xs font-bold ${s.paid ? 'text-green-600' : 'text-red-500'}`}>
                              {s.paid ? 'Đã nộp' : 'Chưa nộp'}
                            </span>
                          </div>
                          {!s.paid && (
                            <button
                              onClick={() => markStudentPaid(s.id)}
                              className="sm:ml-auto px-3 py-1.5 bg-green-50 text-green-600 text-xs font-bold rounded-lg hover:bg-green-100 whitespace-nowrap w-full sm:w-auto"
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
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 min-w-0">
                      <CreditCard size={18} className="text-blue-600 flex-shrink-0" /> Thanh Toán Giảng Viên
                    </h3>
                    <button
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
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition shadow-sm font-semibold text-sm w-full sm:w-auto"
                    >
                      <Download size={16} /> Xuất Báo Cáo
                    </button>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="bg-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden">
                      {isLoadingFinance ? <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center"><RefreshCw className="animate-spin text-white" size={24}/></div> : null}
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tổng thù lao đã chi</p>
                      <p className="text-2xl sm:text-4xl font-black mt-2 whitespace-nowrap">{(financialData.reduce((s, p) => s + (p.amount || 0), 0)).toLocaleString('vi-VN')}đ</p>
                      <p className="text-xs text-slate-500 mt-2 font-bold uppercase italic tracking-widest">Giai đoạn: 01/01 - Hiện tại</p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50 border-t border-gray-50 max-h-80 overflow-y-auto">
                    {financialData.map(t => {
                      const bankInfo = t.teacherId?.bankAccount || t.bankAccount;
                      return (
                      <div key={t.id || t._id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors min-w-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                              <Users size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{t.teacherId?.name || t.teacherName || 'Giảng viên'}</p>
                              <p className="text-xs text-gray-400 truncate">{t.description || t.note || 'Thù lao'}</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <p className="text-sm font-black text-blue-600 whitespace-nowrap">-{t.amount ? t.amount.toLocaleString('vi-VN') : 0}đ</p>
                            <p className="text-xs text-gray-400 font-medium">{t.date || new Date(t.createdAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                        {/* Bank info row */}
                        {bankInfo?.accountNumber && (
                          <div className="mt-2 ml-0 pl-0 sm:ml-11 sm:pl-0 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                              <CreditCard size={10} /> {bankInfo.bankName || 'N/A'}
                            </span>
                            <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                              STK: {bankInfo.accountNumber}
                            </span>
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 uppercase">
                              {bankInfo.accountName}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${bankInfo.bankName} - ${bankInfo.accountNumber} - ${bankInfo.accountName}`);
                                toast.success('Đã copy thông tin ngân hàng!');
                              }}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                              title="Copy thông tin ngân hàng"
                            >
                              📋 Copy
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })}
                    {financialData.length === 0 && !isLoadingFinance && (
                      <div className="p-12 text-center text-gray-400">Chưa có giao dịch chi nào.</div>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>
  );
}
