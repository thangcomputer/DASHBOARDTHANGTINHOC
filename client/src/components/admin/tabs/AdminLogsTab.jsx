import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import { Lock, RefreshCw, User } from 'lucide-react';
import api from '../../../services/api';

export default function AdminLogsTab() {
  const {
    isLoadingLogs, setIsLoadingLogs, dbLogs, setDbLogs,
  } = useAdminTab();

  return (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Lock size={20} className="text-slate-600" />
                    Nhật Ký Hoạt Động Hệ Thống
                  </h2>
                  <button onClick={() => {
                      setIsLoadingLogs(true);
                      api.systemLogs.getAll(1, 100)
                        .then(res => setDbLogs(res.data))
                        .finally(() => setIsLoadingLogs(false));
                    }} className="text-xs font-bold text-blue-600 flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4">
                    <RefreshCw size={14} className={isLoadingLogs ? "animate-spin" : ""} /> Làm mới
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {isLoadingLogs ? (
                    <div className="p-12 text-center text-gray-400">
                      <RefreshCw size={40} className="mx-auto mb-3 text-gray-300 animate-spin" />
                      <p className="text-sm">Đang tải nhật ký...</p>
                    </div>
                  ) : dbLogs && dbLogs.length > 0 ? dbLogs.map(log => {
                    // Action icon + color
                    const actionStyles = {
                      'ĐĂNG NHẬP':     { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '🔑' },
                      'ĐĂNG XUẤT':     { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: '🚪' },
                      'THÊM HỌC VIÊN': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '👤' },
                      'THÊM GIẢNG VIÊN': { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', icon: '🎓' },
                      'THÊM NHÂN VIÊN': { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: '👥' },
                      'THÊM MỚI':     { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '➕' },
                      'CẬP NHẬT':     { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '✏️' },
                      'CẬP NHẬT HV':  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '✏️' },
                      'CẬP NHẬT GV':  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '✏️' },
                      'SỬA HỌC PHÍ':  { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: '💰' },
                      'XÓA':          { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '🗑️' },
                      'XÓA HỌC VIÊN': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '🗑️' },
                      'XÓA GIẢNG VIÊN': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '🗑️' },
                      'XÓA NHÂN VIÊN': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '🗑️' },
                      'DUYỆT GV':     { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', icon: '✅' },
                      'TỪ CHỐI GV':   { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-200', icon: '❌' },
                      'PHÂN QUYỀN':   { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', icon: '🛡️' },
                      'TẠO LỊCH HỌC': { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', icon: '📅' },
                      'CẬP NHẬT LỊCH': { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', icon: '📅' },
                      'XÁC NHẬN LƯƠNG': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '💵' },
                      'TẠO GIAO DỊCH': { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', icon: '💳' },
                      'THANH TOÁN':   { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '✅' },
                      'CÀI ĐẶT':     { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: '⚙️' },
                      'ĐỔI MẬT KHẨU': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: '🔐' },
                    };
                    const style = actionStyles[log.action] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: '📋' };
                    const roleName = log.role === 'admin' ? (log.adminRole === 'SUPER_ADMIN' ? 'SUPER ADMIN' : log.adminRole === 'STAFF' ? 'NHÂN VIÊN' : 'ADMIN') : log.role?.toUpperCase() || 'HỆ THỐNG';
                    const isLogin = log.action === 'ĐĂNG NHẬP';

                    return (
                      <div key={log._id || log.id} className={`px-6 py-4 hover:bg-slate-50/50 transition-colors ${isLogin ? 'border-l-4 border-l-emerald-400' : ''}`}>
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${style.bg} border ${style.border} shadow-sm`}>
                            <span className="text-lg">{style.icon}</span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Action + message */}
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${style.bg} ${style.text} border ${style.border}`}>{log.action}</span>
                              <span className="text-sm text-gray-700 font-medium">{log.message || log.target}</span>
                            </div>

                            {/* User info line */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-slate-500 flex items-center gap-1">
                                <User size={10} /> {log.name}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded font-bold ${log.role === 'admin' ? 'bg-red-50 text-red-600' : log.role === 'staff' ? 'bg-purple-50 text-purple-600' : log.role === 'teacher' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                                {roleName}
                              </span>
                              {log.branchCode && (
                                <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-bold border border-teal-200">🏢 {log.branchCode}</span>
                              )}
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400">{new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                            </div>

                            {/* Device + IP line (prominent for login events) */}
                            {(log.device || log.ip) && (
                              <div className={`flex items-center gap-2 flex-wrap mt-1.5 text-xs ${isLogin ? 'bg-emerald-50/50 rounded-lg px-2.5 py-1.5 border border-emerald-100' : ''}`}>
                                {log.device && (
                                  <span className={`flex items-center gap-1 ${isLogin ? 'font-bold text-emerald-700' : 'text-slate-400'}`}>
                                    💻 {log.device}
                                  </span>
                                )}
                                {log.ip && log.ip !== 'unknown' && (
                                  <>
                                    <span className="text-slate-200">|</span>
                                    <span className={`flex items-center gap-1 font-mono ${isLogin ? 'font-bold text-emerald-600' : 'text-slate-400'}`}>
                                      🌐 IP: {log.ip}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-12 text-center text-gray-400">
                      <Lock size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Chưa có hoạt động nào được ghi nhận</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
  );
}
