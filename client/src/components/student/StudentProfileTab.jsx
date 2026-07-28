import React, { useState } from 'react';
import {
  CheckCircle, User, Settings, BookOpen, TrendingUp,
  Mail, Phone, MessageCircle, MapPin, Lock, ChevronRight, ChevronDown,
  GraduationCap, BadgeDollarSign, Wallet,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';

function openChangePassword() {
  window.dispatchEvent(new CustomEvent('open-change-password-modal'));
}

export default function StudentProfileTab({
  studentData,
  progressPct,
  setShowUpdateProfileModal,
  setShowTuitionModal,
}) {
  const [openSections, setOpenSections] = useState({
    personal: false,
    summary: false,
    courses: true,
    progress: false,
  });
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const teacherValue = Array.isArray(studentData?.teacher)
    ? studentData.teacher.filter(Boolean).join(', ')
    : (studentData?.teacher || 'Chưa phân công');

  return (
    <div className="cms-sd cms-sd-page cms-sd-stack cms-sd-profile">
      {/* Hero */}
      <section className="rounded-[16px] bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-4 text-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/5 rounded-full pointer-events-none" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-[14px] overflow-hidden border-2 border-white/30 bg-white shadow-md">
              <img
                src={resolveAvatarUrl({ avatar: studentData.avatar, role: 'student' })}
                alt={studentData.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
              <CheckCircle size={10} className="text-white" aria-hidden="true" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight truncate">{studentData.name}</h2>
            <p className="text-[11px] font-semibold text-teal-100/90 mt-0.5 truncate">
              {studentData.course || 'Học viên Thắng Tin Học'}
            </p>
            <div className="mt-2 flex gap-2">
              <div className="rounded-lg bg-white/12 px-2.5 py-1 min-w-0">
                <p className="text-sm font-extrabold tabular-nums leading-none">{progressPct}%</p>
                <p className="text-[10px] text-teal-100 mt-0.5">Tiến độ</p>
              </div>
              <div className="rounded-lg bg-white/12 px-2.5 py-1 min-w-0">
                <p className="text-sm font-extrabold tabular-nums leading-none">{studentData.avgGrade}</p>
                <p className="text-[10px] text-teal-100 mt-0.5">Điểm TB</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bảo mật */}
      <section className="cms-sd-card !p-0 overflow-hidden">
        <button
          type="button"
          onClick={openChangePassword}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Lock size={18} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-slate-800">Đổi mật khẩu</span>
            <span className="block text-xs text-slate-500 mt-0.5">Bảo mật tài khoản đăng nhập</span>
          </span>
          <ChevronRight size={18} className="text-slate-300 shrink-0" aria-hidden="true" />
        </button>
      </section>

      {/* Thông tin + học tập */}
      <div className="grid grid-cols-1 gap-3">
        <section className="cms-sd-card !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <button type="button" onClick={() => toggleSection('personal')} className="flex items-center gap-2 text-sm font-extrabold text-slate-800 min-w-0">
              <User size={16} className="text-teal-600" aria-hidden="true" /> Thông tin cá nhân
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowUpdateProfileModal(true)}
                className="text-[11px] font-extrabold uppercase tracking-wide text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 min-h-9 rounded-lg transition-colors flex items-center gap-1"
              >
                <Settings size={13} aria-hidden="true" /> Cập nhật
              </button>
              <button type="button" onClick={() => toggleSection('personal')} className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center">
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${openSections.personal ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {openSections.personal && <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {[
              { icon: Mail, label: 'Email', value: studentData.email || 'Chưa cập nhật' },
              { icon: Phone, label: 'Số điện thoại', value: studentData.phone || studentData.zalo || 'Chưa cập nhật' },
              { icon: MessageCircle, label: 'Zalo', value: studentData.zalo || 'Chưa cập nhật' },
              { icon: MapPin, label: 'Địa chỉ', value: studentData.address || 'Chưa cập nhật' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-3 px-4 py-3 min-w-0">
                <item.icon size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.value}</p>
                </div>
              </li>
            ))}
          </ul>}
        </section>

        <section className="cms-sd-card !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <button type="button" onClick={() => toggleSection('summary')} className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" aria-hidden="true" /> Tóm tắt học tập
            </button>
            <button type="button" onClick={() => toggleSection('summary')} className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center">
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${openSections.summary ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {openSections.summary && <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {[
              { icon: GraduationCap, label: 'Giáo viên', value: teacherValue },
              { icon: BadgeDollarSign, label: 'Trạng thái', value: studentData.status },
              { icon: Wallet, label: 'Học phí', value: studentData.price?.toLocaleString('vi-VN') + 'đ' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-3 px-4 py-3 min-w-0">
                <item.icon size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.value}</p>
                </div>
              </li>
            ))}
            <li className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-4 py-3 md:col-span-2">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle
                  size={16}
                  className={studentData.paid ? 'text-emerald-500' : 'text-amber-500'}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Thanh toán</p>
                  <p className={`text-sm font-bold ${studentData.paid ? 'text-emerald-600' : 'text-red-500'}`}>
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
            </li>
          </ul>}
        </section>
      </div>

      {studentData.courses && studentData.courses.length > 0 && (
        <section className="cms-sd-card !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 min-w-0">
            <button type="button" onClick={() => toggleSection('courses')} className="text-sm font-extrabold text-slate-800 flex items-center gap-2 min-w-0">
              <BookOpen size={16} className="text-blue-600 shrink-0" aria-hidden="true" /> Khóa học
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {studentData.courses.length}
              </span>
              <button type="button" onClick={() => toggleSection('courses')} className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center">
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${openSections.courses ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {openSections.courses && <div className="p-3 space-y-2.5">
            {studentData.courses.map((c) => {
              const isCompleted = c.status === 'completed';
              const pct = Math.round((c.completedSessions / c.totalSessions) * 100) || 0;
              return (
                <article
                  key={c.id}
                  className={`rounded-[14px] border p-3 ${
                    isCompleted ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0 mb-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight line-clamp-2">{c.name}</h4>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                        GV: {c.teacherName} · {new Date(c.registeredAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase shrink-0 ${
                        isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isCompleted ? 'Xong' : 'Học'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 bg-white rounded-full overflow-hidden border border-slate-100">
                        <div
                          className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
                          {c.completedSessions}/{c.totalSessions} buổi
                        </p>
                        <p className="text-[11px] font-bold text-slate-600 tabular-nums">{pct}%</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-slate-800 tabular-nums">{c.avgGrade}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">TB</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>}
        </section>
      )}

      <section className="cms-sd-card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <button type="button" onClick={() => toggleSection('progress')} className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" aria-hidden="true" /> Tiến trình
          </button>
          <button type="button" onClick={() => toggleSection('progress')} className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center">
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${openSections.progress ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {openSections.progress && <div className="p-4">
          <div className="mb-4">
            <div className="flex justify-between items-center gap-2 mb-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Hoàn thành</span>
              <span className="text-sm font-extrabold text-emerald-600 tabular-nums">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Đã học', value: studentData.completedSessions, color: 'text-blue-600 bg-blue-50' },
              { label: 'Còn lại', value: studentData.remainingSessions, color: 'text-violet-600 bg-violet-50' },
              { label: 'Điểm TB', value: studentData.avgGrade, color: 'text-orange-600 bg-orange-50' },
              { label: 'Bài nộp', value: '4/4', color: 'text-teal-600 bg-teal-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.color} rounded-[12px] p-3 text-center`}>
                <p className="text-base font-extrabold tabular-nums">{s.value}</p>
                <p className="text-[10px] font-bold uppercase mt-1 opacity-80">{s.label}</p>
              </div>
            ))}
          </div>
        </div>}
      </section>
    </div>
  );
}
