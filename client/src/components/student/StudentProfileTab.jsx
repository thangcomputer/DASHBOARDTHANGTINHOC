import React from 'react';
import {
  CheckCircle, User, Settings, BookOpen, TrendingUp,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';

export default function StudentProfileTab({
  studentData,
  progressPct,
  setShowUpdateProfileModal,
  setShowTuitionModal,
}) {
  return (
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
            {/* Header card */}
            <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full"></div>
              <div className="absolute -right-5 -bottom-5 w-24 h-24 bg-white/5 rounded-full"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-white/30 shadow-2xl bg-white">
                    <img
                      src={resolveAvatarUrl({ avatar: studentData.avatar, role: 'student' })}
                      alt={studentData.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-400 rounded-full border-3 border-white flex items-center justify-center">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">{studentData.name}</h2>
                  <p className="text-teal-200 text-sm mt-1">Học viên tại Thắng Tin Học</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    <span className="bg-white/20 text-xs font-bold px-3 py-1 rounded-full">{studentData.course}</span>
                  </div>
                </div>
                <div className="flex gap-4 md:gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-black">{progressPct}%</p>
                    <p className="text-xs text-teal-200">Tiến độ</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black">{studentData.avgGrade}</p>
                    <p className="text-xs text-teal-200">Điểm TB</p>
                  </div>
                </div>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Thông tin cá nhân */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white flex items-center justify-between">
                  <h3 className="font-bold text-teal-800 flex items-center gap-2">
                    <User size={18} className="text-teal-500" /> Thông tin cá nhân
                  </h3>
                  <button 
                    onClick={() => setShowUpdateProfileModal(true)}
                    className="text-xs font-black uppercase tracking-widest text-teal-700 bg-teal-100/50 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Settings size={12} /> Cập nhật
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { icon: '📧', label: 'Email', value: studentData.email || 'Chưa cập nhật' },
                    { icon: '📱', label: 'Số điện thoại', value: studentData.phone || studentData.zalo || 'Chưa cập nhật' },
                    { icon: '💬', label: 'Zalo', value: studentData.zalo || 'Chưa cập nhật' },
                    { icon: '📍', label: 'Địa chỉ', value: studentData.address || 'Chưa cập nhật' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 uppercase font-bold">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thông tin học tập tóm tắt */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                  <h3 className="font-bold text-blue-800 flex items-center gap-2">
                    <BookOpen size={18} className="text-blue-500" /> Tóm tắt học tập
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { icon: '👨‍🏫', label: 'Giáo viên', value: studentData.teacher },
                    { icon: '📊', label: 'Trạng thái', value: studentData.status },
                    { icon: '💰', label: 'Học phí', value: studentData.price?.toLocaleString('vi-VN') + 'đ' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 uppercase font-bold">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}

                  {/* Trạng thái thanh toán + nút đóng học phí */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{studentData.paid ? '✅' : '⏳'}</span>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Thanh toán</p>
                        <p className={`text-sm font-bold ${studentData.paid ? 'text-emerald-600' : 'text-red-500'}`}>
                          {studentData.paid ? 'Đã đóng học phí' : 'Chưa đóng'}
                        </p>
                      </div>
                    </div>
                    {!studentData.paid && (
                      <button
                        onClick={() => setShowTuitionModal(true)}
                        className="text-xs font-bold px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm shadow-blue-100 w-full sm:w-auto"
                      >
                        Đóng ngay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Lịch sử khóa học chi tiết */}
            {studentData.courses && studentData.courses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2 min-w-0">
                    <BookOpen size={18} className="text-blue-500" /> Danh sách khóa học
                  </h3>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-black">
                    {studentData.courses.length} KHÓA
                  </span>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  {studentData.courses.map(c => {
                    const isCompleted = c.status === 'completed';
                    const pct = Math.round((c.completedSessions / c.totalSessions) * 100);

                    return (
                      <div key={c.id} className={`border-2 rounded-2xl p-5 transition-all ${
                        isCompleted ? 'border-green-100 bg-green-50/20' : 'border-blue-100 bg-blue-50/10'
                      }`}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-4 min-w-0">
                          <div className="min-w-0">
                            <h4 className="font-black text-slate-800 uppercase tracking-tight break-words">{c.name}</h4>
                            <p className="text-xs text-slate-400 font-bold break-words">GV: {c.teacherName} • {new Date(c.registeredAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                          <span className={`text-xs cms-min-text-xs font-black px-2 py-1 rounded-lg uppercase ${
                            isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isCompleted ? 'Đã xong' : 'Đang học'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="flex-1">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                              <p className="text-xs cms-min-text-xs font-bold text-slate-400">{c.completedSessions}/{c.totalSessions} buổi</p>
                              <p className="text-xs cms-min-text-xs font-bold text-slate-400">{pct}%</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                             <p className="text-lg font-black text-slate-800">{c.avgGrade}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase">Điểm TB</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tiến trình tổng thể */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-500" /> Tiến trình tổng thể
                  </h3>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <span className="text-xs font-black text-slate-600 uppercase">Hoàn thành chương trình</span>
                      <span className="text-sm font-black text-emerald-600">{progressPct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
                        style={{ width: `${progressPct}%` }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Buổi đã học', value: studentData.completedSessions, color: 'text-blue-600 bg-blue-50' },
                      { label: 'Buổi còn lại', value: studentData.remainingSessions, color: 'text-purple-600 bg-purple-50' },
                      { label: 'Điểm trung bình', value: studentData.avgGrade, color: 'text-orange-600 bg-orange-50' },
                      { label: 'Số bài đã nộp', value: '4/4', color: 'text-teal-600 bg-teal-50' },
                    ].map((s, idx) => (
                      <div key={idx} className={`${s.color} rounded-2xl p-4 text-center border border-white/50 shadow-sm`}>
                        <p className="text-xl font-black">{s.value}</p>
                        <p className="text-xs cms-min-text-xs font-black uppercase mt-1 opacity-70 leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
            </div>

          </div>
  );
}
