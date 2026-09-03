import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Loader2, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

function getToken() {
  for (const role of ['admin','staff']) {
    const directToken = localStorage.getItem(`${role}_access_token`);
    if (directToken) return directToken;
    const s = localStorage.getItem(`${role}_user`);
    if (s) { try { const u = JSON.parse(s); if (u?.token) return u.token; } catch {} }
  }
  return '';
}

export default function TeacherScheduleHistoryPanel({ teacherId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/api/schedules/history/${teacherId}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        const result = await res.json();
        if (!active) return;
        if (result.success) {
          // Backend returns: { success: true, data: [...], stats: {...} }
          setData({
            history: result.data || [],
            ...result.stats
          });
        } else {
          setError(result.message || 'Lỗi tải lịch sử');
        }
      } catch (err) {
        if (active) setError('Lỗi kết nối máy chủ');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (teacherId) {
      fetchHistory();
    }
    return () => { active = false; };
  }, [teacherId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
        <p className="text-sm font-medium">Đang tải lịch sử sắp lịch...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/50 border border-red-100 text-red-600 p-6 rounded-2xl text-center flex flex-col items-center justify-center py-8">
        <AlertCircle size={32} className="mb-2 text-red-400" />
        <p className="font-bold">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { total = 0, created = 0, cancelled = 0, updated = 0, cancelRate = 0, history = [] } = data;

  return (
    <div className="space-y-5">
      {/* Stat Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-sky-700">{created}</p>
          <p className="text-[10px] uppercase font-bold text-sky-500 mt-1 tracking-wider">Đã xếp</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-amber-600">{updated}</p>
          <p className="text-[10px] uppercase font-bold text-amber-500 mt-1 tracking-wider">Đổi ca</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-red-600">{cancelled}</p>
          <p className="text-[10px] uppercase font-bold text-red-500 mt-1 tracking-wider">Đã huỷ</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-slate-600">{cancelRate}%</p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-wider">Tỷ lệ hủy</p>
        </div>
      </div>

      {/* Danh sách */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" /> Bản ghi hoạt động
          </h4>
        </div>
        {history.length === 0 ? (
          <div className="cms-empty">
            <div className="cms-empty__icon">
              <Calendar size={26} />
            </div>
            <p className="cms-empty__title">Chưa có hoạt động xếp lịch nào</p>
            <p className="cms-empty__desc">Khi có lịch được xếp hoặc huỷ, bản ghi sẽ hiện tại đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-black border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-[130px]">Lúc</th>
                  <th className="px-4 py-3 w-[110px]">Hành động</th>
                  <th className="px-4 py-3 w-[160px]">Tên học viên</th>
                  <th className="px-4 py-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map(log => {
                  const studentName = log.studentName || log.newValue?.studentName || log.oldValue?.studentName || 'Chưa ghi nhận';
                  return (
                    <tr key={log._id} className="bg-white hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5">
                        {log.action === 'CREATED' ? (
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-100/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Đã xếp lịch
                          </span>
                        ) : log.action === 'UPDATED' ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-100/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Đổi ca
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-100/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Đã hủy lịch
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-900">
                        {studentName}
                      </td>
                      <td className="px-4 py-3.5">
                        {log.action === 'CREATED' ? (
                          <div className="text-xs text-slate-600">
                            Lớp ngày: <span className="font-bold text-slate-800">{new Date(log.newValue?.date || log.scheduledDate).toLocaleDateString('vi-VN')}</span>, 
                            Ca: <span className="font-bold text-slate-800">
                              {log.newValue?.startTime ? `${log.newValue?.startTime} - ${log.newValue?.endTime}` : 'Chưa ghi nhận giờ'}
                            </span>
                          </div>
                        ) : log.action === 'UPDATED' ? (
                          <div className="text-xs border-l-2 border-amber-200 pl-2">
                            <div className="text-slate-600">
                              {log.oldValue?.startTime && (
                                <span>Ca cũ: <span className="font-bold text-slate-800 line-through">{log.oldValue.startTime} - {log.oldValue.endTime}</span> → </span>
                              )}
                              Ca mới: <span className="font-bold text-amber-700">{log.newValue?.startTime} - {log.newValue?.endTime}</span>
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Ngày: <span className="font-bold text-slate-800">{new Date(log.newValue?.date || log.scheduledDate).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs border-l-2 border-red-200 pl-2">
                            <div className="text-slate-600 mb-1">
                              Lớp ngày: <span className="font-bold text-slate-800">{new Date(log.scheduledDate || log.newValue?.date).toLocaleDateString('vi-VN')}</span>, 
                              Ca: <span className="font-bold text-slate-800">
                                {(log.newValue?.startTime || log.oldValue?.startTime) ? 
                                  `${log.newValue?.startTime || log.oldValue?.startTime} - ${log.newValue?.endTime || log.oldValue?.endTime}`
                                  : 'Chưa ghi nhận giờ'
                                }
                              </span>
                            </div>
                            <div className="text-red-600 font-medium mt-1">
                              Lý do: <span className="font-bold">{log.reason || 'Không rõ'}</span>
                            </div>
                          </div>
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
  );
}
