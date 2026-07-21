import React from 'react';
import { Users, GraduationCap, DollarSign, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../shared/StatCard';
import Avatar from '../shared/Avatar';

export default function AdminOverviewTab({
  statTotalStudents,
  statPaidStudents,
  statTotalTeachers,
  statActiveTeachers,
  statTotalRevenue,
  statPendingTeachers,
  filteredStudents,
  safeTeachers,
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="cms-stat-grid">
        <StatCard
          icon={Users}
          label="Tổng học viên"
          value={statTotalStudents}
          sub={`${statPaidStudents} đã hoàn tất học phí`}
          color="bg-gradient-to-br from-red-600 to-red-800"
        />
        <StatCard
          icon={GraduationCap}
          label="Giảng viên"
          value={statTotalTeachers}
          sub={`${statActiveTeachers} đang trực tiếp giảng dạy`}
          color="bg-gradient-to-br from-slate-800 to-slate-950"
        />
        <StatCard
          icon={DollarSign}
          label="Doanh thu"
          value={`${(statTotalRevenue / 1000000).toFixed(1)}M`}
          sub="VNĐ doanh thu thực tế"
          color="bg-gradient-to-br from-red-500 to-rose-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Hồ sơ mới"
          value={statPendingTeachers}
          sub="đang chờ xét duyệt hồ sơ"
          color="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 p-4 sm:p-6 lg:p-8 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6 min-w-0">
            <h3 className="font-black text-gray-800 flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Users size={18} />
              </div>
              Học viên vừa đăng ký
            </h3>
            <button type="button" onClick={() => navigate('/admin#students')} className="text-xs font-black text-red-600 hover:underline uppercase tracking-widest shrink-0 self-start sm:self-auto">Xem tất cả</button>
          </div>
          {filteredStudents.slice(0, 5).length > 0 ? (
            <div className="space-y-4">
              {filteredStudents.slice(0, 5).map((s) => (
                <div key={s.id || s._id} className="group flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between p-4 rounded-2xl hover:bg-red-50/50 transition-all border border-transparent hover:border-red-100 min-w-0">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar initials={(s.name || '?').charAt(0).toUpperCase()} color={s.paid ? 'bg-red-600' : 'bg-slate-400'} />
                    <div>
                      <p className="text-sm font-black text-gray-800 group-hover:text-red-700 transition-colors uppercase tracking-tight">{s.name}</p>
                      <p className="text-xs text-gray-400 font-bold">{s.course || 'Chưa chọn khóa'}</p>
                    </div>
                  </div>
                  <span className={`text-xs cms-min-text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest ${s.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {s.paid ? 'Đã thu' : 'Chờ thu'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-gray-300 font-bold italic">Chưa có dữ liệu học viên mới</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 p-4 sm:p-6 lg:p-8 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6 min-w-0">
            <h3 className="font-black text-gray-800 flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} />
              </div>
              Đội ngũ Giảng viên
            </h3>
            <button type="button" onClick={() => navigate('/admin#teachers')} className="text-xs font-black text-red-600 hover:underline uppercase tracking-widest shrink-0 self-start sm:self-auto">Quản lý GV</button>
          </div>
          {safeTeachers.slice(0, 5).length > 0 ? (
            <div className="space-y-4">
              {safeTeachers.slice(0, 5).map((t) => (
                <div key={t.id || t._id} className="group flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 min-w-0">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar initials={(t.name || '?').substring(0, 2).toUpperCase()} color={['Active', 'active'].includes(t.status) ? 'bg-red-600' : 'bg-amber-500'} />
                    <div>
                      <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{t.name}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase">{t.phone} {t.branchCode ? `· ${t.branchCode}` : ''}</p>
                    </div>
                  </div>
                  <span className={`text-xs cms-min-text-xs px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                    ['Active', 'active'].includes(t.status) ? 'bg-emerald-100 text-emerald-700 font-black' :
                    t.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {['Active', 'active'].includes(t.status) ? 'Đang dạy' : t.status === 'Pending' ? 'Chờ duyệt' : t.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-gray-300 font-bold italic">Chưa có dữ liệu giảng viên</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 px-2">Truy cập nhanh hệ thống</h3>
        <div className="grid grid-cols-1 min-[576px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Học viên', hash: 'students', icon: Users, color: 'from-red-600 to-red-700', desc: 'Quản lý danh sách' },
            { label: 'Giảng viên', hash: 'teachers', icon: GraduationCap, color: 'from-slate-800 to-slate-900', desc: 'Duyệt hồ sơ mới' },
            { label: 'Tài chính', hash: 'finance', icon: DollarSign, color: 'from-red-700 to-rose-800', desc: 'Thu chi & báo cáo' },
            { label: 'Doanh thu', hash: 'analytics', icon: TrendingUp, color: 'from-slate-900 to-black', desc: 'Phân tích tăng trưởng' },
          ].map((q) => (
            <button
              key={q.hash}
              type="button"
              onClick={() => navigate(`/admin#${q.hash}`)}
              className={`group relative bg-gradient-to-br ${q.color} text-white rounded-xl sm:rounded-[24px] p-4 sm:p-6 text-left hover:shadow-2xl hover:shadow-red-900/20 transition-all duration-300 overflow-hidden min-w-0`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
              <q.icon size={28} className="mb-4 text-white/50 group-hover:text-white transition-colors" />
              <p className="text-base font-black uppercase tracking-tight">{q.label}</p>
              <p className="text-xs text-white/60 font-medium group-hover:text-white/100 transition-colors uppercase tracking-wider">{q.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
