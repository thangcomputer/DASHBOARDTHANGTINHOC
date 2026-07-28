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
    <div className="cms-sd cms-sd-page cms-sd-stack max-w-4xl">
      {/* Hero profile */}
      <section className="bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 rounded-[16px] p-4 md:p-6 text-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/5 rounded-full pointer-events-none" aria-hidden="true" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            <div className="w-[88px] h-[88px] md:w-24 md:h-24 rounded-[16px] overflow-hidden border-[3px] border-white/30 shadow-lg bg-white">
              <img
                src={resolveAvatarUrl({ avatar: studentData.avatar, role: 'student' })}
                alt={studentData.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
              <CheckCircle size={12} className="text-white" aria-hidden="true" />
            </div>
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight truncate">{studentData.name}</h2>
            <p className="cms-sd-caption text-teal-100 mt-1">Học viên tại Thắng Tin Học</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2.5">
              <span className="bg-white/20 cms-sd-caption font-bold px-2.5 py-1 rounded-full line-clamp-1 max-w-full">
                {studentData.course}
              </span>
            </div>
          </div>

          <div className="flex w-full sm:w-auto gap-3 sm:gap-4 justify-center">
            <div className="flex-1 sm:flex-none text-center rounded-[12px] bg-white/10 px-4 py-2.5 min-w-[5.5rem]">
              <p className="text-[15px] font-extrabold tabular-nums">{progressPct}%</p>
              <p className="cms-sd-caption text-teal-100 mt-0.5">Tiến độ</p>
            </div>
            <div className="flex-1 sm:flex-none text-center rounded-[12px] bg-white/10 px-4 py-2.5 min-w-[5.5rem]">
              <p className="text-[15px] font-extrabold tabular-nums">{studentData.avgGrade}</p>
              <p className="cms-sd-caption text-teal-100 mt-0.5">Điểm TB</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <section className="cms-sd-card !p-0 overflow-hidden group">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white flex items-center justify-between gap-2">
            <h3 className="cms-sd-section-title flex items-center gap-2 text-teal-800">
              <User size={20} className="text-teal-500" aria-hidden="true" /> Thông tin cá nhân
            </h3>
            <button
              type="button"
              onClick={() => setShowUpdateProfileModal(true)}
              className="cms-sd-caption font-extrabold uppercase tracking-wide text-teal-700 bg-teal-100/60 hover:bg-teal-200 px-3 min-h-11 rounded-[12px] transition-colors flex items-center gap-1"
            >
              <Settings size={14} aria-hidden="true" /> Cập nhật
            </button>
          </div>
          <div className="p-4 space-y-4">
            {[
              { icon: '📧', label: 'Email', value: studentData.email || 'Chưa cập nhật' },
              { icon: '📱', label: 'Số điện thoại', value: studentData.phone || studentData.zalo || 'Chưa cập nhật' },
              { icon: '💬', label: 'Zalo', value: studentData.zalo || 'Chưa cập nhật' },
              { icon: '📍', label: 'Địa chỉ', value: studentData.address || 'Chưa cập nhật' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0" aria-hidden="true">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="cms-sd-caption font-bold uppercase text-slate-400">{item.label}</p>
                  <p className="cms-sd-body font-semibold text-slate-800 truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cms-sd-card !p-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
            <h3 className="cms-sd-section-title flex items-center gap-2 text-blue-800">
              <BookOpen size={20} className="text-blue-500" aria-hidden="true" /> Tóm tắt học tập
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {[
              { icon: '👨‍🏫', label: 'Giáo viên', value: studentData.teacher },
              { icon: '📊', label: 'Trạng thái', value: studentData.status },
              { icon: '💰', label: 'Học phí', value: studentData.price?.toLocaleString('vi-VN') + 'đ' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0" aria-hidden="true">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="cms-sd-caption font-bold uppercase text-slate-400">{item.label}</p>
                  <p className="cms-sd-body font-semibold text-slate-800 truncate">{item.value}</p>
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg" aria-hidden="true">{studentData.paid ? '✅' : '⏳'}</span>
                <div>
                  <p className="cms-sd-caption font-bold uppercase text-slate-400">Thanh toán</p>
                  <p className={`cms-sd-body font-bold ${studentData.paid ? 'text-emerald-600' : 'text-red-500'}`}>
                    {studentData.paid ? 'Đã đóng học phí' : 'Chưa đóng'}
                  </p>
                </div>
              </div>
              {!studentData.paid && (
                <button
                  type="button"
                  onClick={() => setShowTuitionModal(true)}
                  className="cms-sd-btn bg-red-600 text-white hover:bg-red-700 w-full sm:w-auto"
                >
                  Đóng ngay
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {studentData.courses && studentData.courses.length > 0 && (
        <section className="cms-sd-card !p-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 min-w-0">
            <h3 className="cms-sd-section-title flex items-center gap-2 min-w-0">
              <BookOpen size={20} className="text-blue-500 shrink-0" aria-hidden="true" /> Danh sách khóa học
            </h3>
            <span className="cms-sd-caption font-extrabold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
              {studentData.courses.length} khóa
            </span>
          </div>
          <div className="p-4 space-y-4">
            {studentData.courses.map((c) => {
              const isCompleted = c.status === 'completed';
              const pct = Math.round((c.completedSessions / c.totalSessions) * 100) || 0;
              return (
                <article
                  key={c.id}
                  className={`border rounded-[16px] p-4 transition-all duration-200 ${
                    isCompleted ? 'border-emerald-100 bg-emerald-50/20' : 'border-blue-100 bg-blue-50/10'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start min-w-0 mb-3">
                    <div className="min-w-0">
                      <h4 className="cms-sd-card-title uppercase tracking-tight line-clamp-2">{c.name}</h4>
                      <p className="cms-sd-caption font-semibold mt-1 truncate">
                        GV: {c.teacherName} • {new Date(c.registeredAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <span
                      className={`cms-sd-caption font-extrabold px-2 py-1 rounded-[12px] uppercase shrink-0 ${
                        isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isCompleted ? 'Đã xong' : 'Đang học'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <p className="cms-sd-caption font-semibold tabular-nums">
                          {c.completedSessions}/{c.totalSessions} buổi
                        </p>
                        <p className="cms-sd-caption font-bold tabular-nums">{pct}%</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-extrabold text-slate-800 tabular-nums">{c.avgGrade}</p>
                      <p className="cms-sd-caption font-bold uppercase">Điểm TB</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="cms-sd-card !p-0 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100">
          <h3 className="cms-sd-section-title flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-500" aria-hidden="true" /> Tiến trình tổng thể
          </h3>
        </div>
        <div className="p-4">
          <div className="mb-5">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <span className="cms-sd-caption font-extrabold text-slate-600 uppercase">Hoàn thành chương trình</span>
              <span className="cms-sd-body font-extrabold text-emerald-600 tabular-nums">{progressPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="cms-sd-stat-grid">
            {[
              { label: 'Buổi đã học', value: studentData.completedSessions, color: 'text-blue-600 bg-blue-50' },
              { label: 'Buổi còn lại', value: studentData.remainingSessions, color: 'text-purple-600 bg-purple-50' },
              { label: 'Điểm trung bình', value: studentData.avgGrade, color: 'text-orange-600 bg-orange-50' },
              { label: 'Số bài đã nộp', value: '4/4', color: 'text-teal-600 bg-teal-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.color} rounded-[16px] p-4 text-center border border-white/50 shadow-[0_6px_20px_rgba(0,0,0,0.06)]`}>
                <p className="text-[15px] font-extrabold tabular-nums">{s.value}</p>
                <p className="cms-sd-caption font-bold uppercase mt-1.5 opacity-80 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
