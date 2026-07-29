import React from 'react';
import { Users, GraduationCap, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';
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

  const quickLinks = [
    { label: 'Học viên', hash: 'students', icon: Users, tone: 'primary', desc: 'Quản lý danh sách' },
    { label: 'Giảng viên', hash: 'teachers', icon: GraduationCap, tone: 'neutral', desc: 'Duyệt hồ sơ mới' },
    { label: 'Tài chính', hash: 'finance', icon: DollarSign, tone: 'primary', desc: 'Thu chi & báo cáo' },
    { label: 'Doanh thu', hash: 'analytics', icon: TrendingUp, tone: 'info', desc: 'Phân tích tăng trưởng' },
  ];

  return (
    <div className="cms-dashboard cms-viewport-fill animate-in fade-in duration-200">
      <div className="cms-viewport-scroll space-y-4 sm:space-y-6">
      {/* KPI grid */}
      <div className="cms-kpi-grid">
        <StatCard
          icon={Users}
          label="Tổng học viên"
          value={statTotalStudents}
          sub={`${statPaidStudents} đã hoàn tất học phí`}
          color="bg-red-600"
        />
        <StatCard
          icon={GraduationCap}
          label="Giảng viên"
          value={statTotalTeachers}
          sub={`${statActiveTeachers} đang trực tiếp giảng dạy`}
          color="bg-slate-800"
        />
        <StatCard
          icon={DollarSign}
          label="Doanh thu"
          value={`${(statTotalRevenue / 1000000).toFixed(1)}M`}
          sub="VNĐ doanh thu thực tế"
          color="bg-red-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Hồ sơ mới"
          value={statPendingTeachers}
          sub="đang chờ xét duyệt hồ sơ"
          color="bg-amber-500"
        />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <section className="cms-dash-panel">
          <div className="cms-dash-panel-head">
            <h3 className="cms-dash-panel-title">
              <span className="cms-dash-panel-icon bg-red-50 text-red-600">
                <Users size={16} aria-hidden="true" />
              </span>
              Học viên vừa đăng ký
            </h3>
            <button
              type="button"
              onClick={() => navigate('/admin#students')}
              className="cms-dash-link"
            >
              Xem tất cả
            </button>
          </div>

          {filteredStudents.slice(0, 5).length > 0 ? (
            <ul className="cms-dash-list">
              {filteredStudents.slice(0, 5).map((s) => (
                <li key={s.id || s._id} className="cms-dash-row">
                  <Avatar
                    size="card"
                    initials={(s.name || '?').charAt(0).toUpperCase()}
                    name={s.name}
                    role="student"
                    src={s.avatar}
                    color={s.paid ? 'bg-red-600' : 'bg-slate-400'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-900 truncate leading-snug">{s.name}</p>
                    <p className="text-[13px] text-slate-500 truncate mt-0.5">{s.course || 'Chưa chọn khóa'}</p>
                  </div>
                  <span className={`cms-dash-badge flex-shrink-0 ${s.paid ? 'cms-dash-badge-success' : 'cms-dash-badge-primary'}`}>
                    {s.paid ? 'Đã thu' : 'Chờ thu'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cms-dash-empty">Chưa có dữ liệu học viên mới</p>
          )}
        </section>

        <section className="cms-dash-panel">
          <div className="cms-dash-panel-head">
            <h3 className="cms-dash-panel-title">
              <span className="cms-dash-panel-icon bg-slate-100 text-slate-700">
                <GraduationCap size={16} aria-hidden="true" />
              </span>
              Đội ngũ Giảng viên
            </h3>
            <button
              type="button"
              onClick={() => navigate('/admin#teachers')}
              className="cms-dash-link"
            >
              Quản lý GV
            </button>
          </div>

          {safeTeachers.slice(0, 5).length > 0 ? (
            <ul className="cms-dash-list">
              {safeTeachers.slice(0, 5).map((t) => {
                const active = ['Active', 'active'].includes(t.status);
                const pending = t.status === 'Pending';
                return (
                  <li key={t.id || t._id} className="cms-dash-row">
                    <Avatar
                      size="card"
                      initials={(t.name || '?').substring(0, 2).toUpperCase()}
                      name={t.name}
                      role="teacher"
                      src={t.avatar}
                      color={active ? 'bg-red-600' : 'bg-amber-500'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-slate-900 truncate leading-snug">{t.name}</p>
                      <p className="text-[13px] text-slate-500 truncate mt-0.5">
                        {t.phone}{t.branchCode ? ` · ${t.branchCode}` : ''}
                      </p>
                    </div>
                    <span
                      className={`cms-dash-badge flex-shrink-0 ${
                        active ? 'cms-dash-badge-success'
                          : pending ? 'cms-dash-badge-warning'
                            : 'cms-dash-badge-neutral'
                      }`}
                    >
                      {active ? 'Đang dạy' : pending ? 'Chờ duyệt' : t.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cms-dash-empty">Chưa có dữ liệu giảng viên</p>
          )}
        </section>
      </div>

      {/* Quick access */}
      <section>
        <h3 className="text-[13px] font-semibold text-slate-500 mb-3 px-0.5">
          Truy cập nhanh hệ thống
        </h3>
        <div className="cms-quick-grid">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.hash}
                type="button"
                onClick={() => navigate(`/admin#${q.hash}`)}
                className={`cms-quick-item cms-quick-${q.tone}`}
              >
                <span className="cms-quick-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[15px] font-semibold text-slate-900 leading-tight">{q.label}</span>
                  <span className="block text-[12px] sm:text-[13px] text-slate-500 mt-0.5 truncate">{q.desc}</span>
                </span>
                <ChevronRight size={18} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
      </div>
    </div>
  );
}
