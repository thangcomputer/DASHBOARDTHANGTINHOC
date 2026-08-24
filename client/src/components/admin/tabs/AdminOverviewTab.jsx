import React from 'react';
import { Users, GraduationCap, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../shared/StatCard';
import Avatar from '../shared/Avatar';
import { getClientEnrollments } from '../../../utils/enrollments';
import { useAdminTab } from '../AdminTabContext';
import useSWR from 'swr';
import api from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { sumClientPaidTuition } from '../../../utils/enrollments';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';

export default function AdminOverviewTab({ session }) {
  const { filteredStudents = [], safeTeachers = [] } = useAdminTab() || {};
  const { selectedBranchId } = useBranch();
  
  const statsFetcher = async ([, branch_id]) => {
    const params = branch_id ? { branch_id } : {};
    const res = await api.students.getStats(params);
    return res?.success ? res.data : null;
  };
  
  const { data: branchStats } = useSWR(
    ['admin_stats', selectedBranchId],
    statsFetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false, dedupingInterval: 15_000 }
  );
  
  const statTotalStudents = branchStats?.total ?? filteredStudents.length;
  const statPaidStudents = branchStats?.paid ?? filteredStudents.filter((s) => s.paid).length;
  const statActiveTeachers = branchStats?.activeTeachers ?? safeTeachers.filter((t) => t.status === 'Active' || t.status === 'active').length;
  const statTotalTeachers = branchStats?.totalTeachers ?? safeTeachers.length;
  const statTotalRevenue = branchStats?.totalRevenue ?? filteredStudents.reduce((sum, s) => sum + sumClientPaidTuition(s), 0);
  const statPendingTeachers = branchStats?.pendingTeachers ?? safeTeachers.filter((t) => t.status === 'Pending').length;

  const navigate = useNavigate();

  const quickLinks = [
    { label: 'Học viên', hash: 'students', icon: Users, tone: 'primary', desc: 'Quản lý danh sách', permission: PERMISSIONS.MANAGE_STUDENTS },
    { label: 'Giảng viên', hash: 'teachers', icon: GraduationCap, tone: 'neutral', desc: 'Duyệt hồ sơ mới', permission: PERMISSIONS.VIEW_TEACHERS },
    { label: 'Tài chính', hash: 'finance', icon: DollarSign, tone: 'primary', desc: 'Thu chi & báo cáo', permission: PERMISSIONS.MANAGE_FINANCE },
    {
      label: 'Doanh thu',
      hash: 'analytics',
      icon: TrendingUp,
      tone: 'info',
      desc: 'Phân tích tăng trưởng',
      anyOf: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE],
    },
  ].filter((q) => {
    if (q.anyOf) return q.anyOf.some((p) => hasPermission(session, p));
    if (q.permission) return hasPermission(session, q.permission);
    return true;
  });

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
        {(hasPermission(session, PERMISSIONS.MANAGE_FINANCE) || hasPermission(session, PERMISSIONS.VIEW_BRANCH_REVENUE)) && (
          <StatCard
            icon={DollarSign}
            label="Doanh thu"
            value={`${(statTotalRevenue / 1000000).toFixed(1)}M`}
            sub="VNĐ doanh thu thực tế"
            color="bg-red-500"
          />
        )}
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
                  {/*
                    Backend set `paid=false` khi khóa bị cancel/refund.
                    Vì vậy dùng `refundedAmount` để phân biệt "Đã hoàn" với "Chờ thu".
                  */}
                  {(() => {
                    const enr = getClientEnrollments(s);
                    const refunded = enr.some((e) => Number(e?.refundedAmount) > 0);
                    const isPaid = !!s?.paid;
                    const badgeText = isPaid ? 'Đã thu' : refunded ? 'Đã hoàn' : 'Chờ thu';
                    const badgeClass = isPaid
                      ? 'cms-dash-badge-success'
                      : refunded
                        ? 'cms-dash-badge-primary'
                        : 'cms-dash-badge-warning';
                    const color = isPaid ? 'bg-red-600' : refunded ? 'bg-red-500' : 'bg-slate-400';
                    return (
                      <>
                  <Avatar
                    size="card"
                    initials={(s.name || '?').charAt(0).toUpperCase()}
                    name={s.name}
                    role="student"
                    src={s.avatar}
                    gender={s.gender}
                    color={color}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-[15px] font-bold text-slate-900 truncate leading-snug">{s.name}</p>
                    <p className="text-xs sm:text-[13px] text-slate-500 font-medium truncate mt-0.5">{s.course || 'Chưa chọn khóa'}</p>
                  </div>
                  <span className={`cms-dash-badge flex-shrink-0 ${badgeClass}`}>
                    {badgeText}
                  </span>
                      </>
                    );
                  })()}
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
                      gender={t.gender}
                      color={active ? 'bg-red-600' : 'bg-amber-500'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-[15px] font-bold text-slate-900 truncate leading-snug">{t.name}</p>
                      <p className="text-xs sm:text-[13px] text-slate-500 font-medium truncate mt-0.5">
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
        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 px-0.5">
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
                  <span className="block text-sm sm:text-[15px] font-bold text-slate-900 leading-tight">{q.label}</span>
                  <span className="block text-xs sm:text-[13px] text-slate-500 font-medium mt-0.5 truncate">{q.desc}</span>
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
