import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Award, Bell, Check, Copy, ChevronRight,
  DollarSign, GraduationCap, Laptop, ShieldCheck, TrendingUp, Users,
} from 'lucide-react';
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
import { summarizeExamProgress } from '../../../utils/examProgressStats';
import { computeAtRiskStudents } from '../../../utils/atRiskStudents';

function vnDayKeyFrom(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

function readBrowserSummary() {
  if (typeof navigator === 'undefined') return 'Trình duyệt Web';
  const ua = navigator.userAgent || '';
  const browser = /Edg\//.test(ua) ? 'Microsoft Edge'
    : /Chrome\//.test(ua) ? 'Google Chrome'
      : /Firefox\//.test(ua) ? 'Mozilla Firefox'
        : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android'
        : /iPhone|iPad/.test(ua) ? 'iOS'
          : /Linux/.test(ua) ? 'Linux' : 'Desktop';
  return `${browser} · ${os}`;
}

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
  const certificationStats = summarizeExamProgress(filteredStudents);
  const atRiskStudents = useMemo(() => computeAtRiskStudents(filteredStudents), [filteredStudents]);
  const [snapshotMs, setSnapshotMs] = useState(() => Date.now());
  const [copiedAutoId, setCopiedAutoId] = useState('');
  const [securityVerifiedAt, setSecurityVerifiedAt] = useState('');

  const realtime = useMemo(() => {
    const todayKey = vnDayKeyFrom(snapshotMs);
    const thisMonth = todayKey.slice(5, 7);
    const onlineStudents = (filteredStudents || []).filter((s) => {
      const t = s?.lastAccessAt ? new Date(s.lastAccessAt).getTime() : NaN;
      return Number.isFinite(t) && snapshotMs - t <= 15 * 60_000;
    }).length;
    const onlineTeachers = (safeTeachers || []).filter((t) => {
      const ts = t?.lastAccessAt ? new Date(t.lastAccessAt).getTime() : NaN;
      return Number.isFinite(ts) && snapshotMs - ts <= 15 * 60_000;
    }).length;
    const activeToday = (filteredStudents || []).filter(
      (s) => vnDayKeyFrom(s?.lastAccessAt) === todayKey,
    ).length;
    const todayRevenue = (filteredStudents || [])
      .filter((s) => s?.paid && (vnDayKeyFrom(s?.createdAt) === todayKey || vnDayKeyFrom(s?.updatedAt) === todayKey))
      .reduce((sum, s) => sum + sumClientPaidTuition(s), 0);

    const registeredCount = filteredStudents.length;
    const engagedCount = (filteredStudents || []).filter(
      (s) => Boolean(s?.lastAccessAt) || (Number(s?.completedSessions) || 0) > 0 || s?.freePortal,
    ).length;
    const paidCount = (filteredStudents || []).filter(
      (s) => s?.paid || sumClientPaidTuition(s) > 0,
    ).length;
    const funnel = [
      { key: 'reg', label: '1. Đăng ký tài khoản', count: registeredCount, pct: registeredCount ? 100 : 0, bar: 'bg-sky-500' },
      { key: 'use', label: '2. Dùng thử / Tham gia học', count: engagedCount, pct: registeredCount ? Math.round((engagedCount / registeredCount) * 100) : 0, bar: 'bg-amber-500' },
      { key: 'pay', label: '3. Hoàn tất học phí / Mua gói', count: paidCount, pct: registeredCount ? Math.round((paidCount / registeredCount) * 100) : 0, bar: 'bg-emerald-500' },
    ];

    const automations = [];
    for (const s of filteredStudents || []) {
      const sid = String(s?._id || s?.id || '');
      const dobRaw = s?.dob || s?.birthDate || s?.dateOfBirth || '';
      const dobKey = vnDayKeyFrom(dobRaw);
      if (dobKey && dobKey.slice(5, 7) === thisMonth) {
        automations.push({
          id: `bday-${sid}`,
          kind: 'birthday',
          badge: dobKey.slice(5) === todayKey.slice(5) ? '🎂 Sinh nhật hôm nay' : '🎂 Sinh nhật tháng này',
          tone: 'bg-pink-50 text-pink-700 border-pink-200/70',
          studentName: s.name || 'Học viên',
          message: `Chúc mừng sinh nhật bạn ${s.name || ''}! Trung tâm Thắng Tin Học gửi tặng bạn +50 XP & chúc bạn học tập thật vui!`,
        });
      }
      const rem = Number(s?.remainingSessions) || 0;
      if (rem > 0 && rem <= 2) {
        automations.push({
          id: `renew-${sid}`,
          kind: 'renewal',
          badge: `⏰ Còn ${rem} buổi`,
          tone: 'bg-amber-50 text-amber-800 border-amber-200/70',
          studentName: s.name || 'Học viên',
          message: `Chào ${s.name || 'bạn'}, khóa ${s.course || 'Tin học'} của bạn chỉ còn ${rem} buổi. Hãy gia hạn sớm để giữ lịch học cố định nhé!`,
        });
      }
    }
    for (const r of atRiskStudents) {
      if (r.daysInactive >= 5) {
        automations.push({
          id: `nudge-${r.id}`,
          kind: 'nudge',
          badge: `📩 Vắng ${r.daysInactive} ngày`,
          tone: 'bg-sky-50 text-sky-700 border-sky-200/70',
          studentName: r.name,
          message: `Chào ${r.name}, đã ${r.daysInactive} ngày chưa thấy bạn vào luyện DewSkill! Hôm nay dành 10 phút hoàn thành mục tiêu nhé!`,
        });
      }
    }

    return {
      onlineTotal: Math.max(1, onlineStudents + onlineTeachers),
      activeToday,
      todayRevenue,
      funnel,
      automations: automations.slice(0, 8),
    };
  }, [filteredStudents, safeTeachers, atRiskStudents, snapshotMs]);

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
          color="bg-emerald-600"
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
            color="bg-emerald-500"
          />
        )}
        <StatCard
          icon={TrendingUp}
          label="Hồ sơ mới"
          value={statPendingTeachers}
          sub="đang chờ xét duyệt hồ sơ"
          color="bg-amber-500"
        />
        <StatCard
          icon={Award}
          label="Chứng nhận đạt"
          value={certificationStats.dat}
          sub={`${certificationStats.choNop} chờ nộp · ${certificationStats.choCham} chờ chấm`}
          color="bg-emerald-600"
        />
      </div>

      {/* Dashboard thời gian thực & Biểu đồ Funnel chuyển đổi */}
      <section className="cms-dash-panel">
        <div className="cms-dash-panel-head">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Activity size={16} aria-hidden="true" />
            </span>
            <div>
              <h3 className="cms-dash-panel-title">Dashboard thời gian thực &amp; Phễu chuyển đổi</h3>
              <p className="text-xs text-slate-500">Số người đang online, doanh thu hôm nay và tỷ lệ chuyển đổi học viên.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSnapshotMs(Date.now())}
            className="cms-dash-link"
          >
            Cập nhật trực tiếp
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
          <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3">
              <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Đang online
              </p>
              <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{realtime.onlineTotal}</p>
              <p className="text-[10px] text-slate-500">15 phút gần đây</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[11px] font-bold text-slate-600">Truy cập hôm nay</p>
              <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{realtime.activeToday}</p>
              <p className="text-[10px] text-slate-500">học viên hoạt động</p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3">
              <p className="text-[11px] font-bold text-amber-800">Doanh thu hôm nay</p>
              <p className="mt-1 text-xl font-black text-amber-700 tabular-nums">
                {realtime.todayRevenue >= 1_000_000
                  ? `${(realtime.todayRevenue / 1_000_000).toFixed(1)}M`
                  : `${Math.round(realtime.todayRevenue / 1000)}K`}
              </p>
              <p className="text-[10px] text-slate-500">VNĐ ghi nhận mới</p>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5">
            <p className="text-xs font-black text-slate-700">Biểu đồ Funnel (Đăng ký → Dùng thử / Học → Mua gói)</p>
            {realtime.funnel.map((step) => (
              <div key={step.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{step.label}</span>
                  <span className="tabular-nums font-bold">{step.count} HV ({step.pct}%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${step.bar} transition-all`} style={{ width: `${Math.max(4, step.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <section className="cms-dash-panel">
          <div className="cms-dash-panel-head">
            <h3 className="cms-dash-panel-title">
              <span className="cms-dash-panel-icon bg-emerald-50 text-emerald-600">
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
                    const color = isPaid ? 'bg-emerald-600' : refunded ? 'bg-emerald-500' : 'bg-slate-400';
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
                    <p className="text-xs sm:text-[13px] text-slate-500 font-medium truncate mt-0.5">
                      {String(s.course || '').trim().toLowerCase() === 'tài khoản miễn phí'
                        ? 'Dewskill'
                        : (s.course || (s.freePortal ? 'Dewskill' : 'Chưa chọn khóa'))}
                    </p>
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
                      color={active ? 'bg-emerald-600' : 'bg-amber-500'}
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

      {/* Cảnh báo học viên có nguy cơ bỏ học */}
      <section className="cms-dash-panel">
        <div className="cms-dash-panel-head">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="cms-dash-panel-title">Cảnh báo học viên có nguy cơ bỏ học</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lọc tự động học viên ≥ 5 ngày chưa đăng nhập, điểm TB giảm (&lt; 5.5) hoặc ngưng học ≥ 7 ngày.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin#students')}
            className="cms-dash-link"
          >
            {atRiskStudents.length} cần chú ý <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        {atRiskStudents.length > 0 ? (
          <ul className="cms-dash-list">
            {atRiskStudents.slice(0, 6).map((item) => (
              <li key={item.id} className="cms-dash-list-row">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                    <span className="truncate text-xs text-slate-400">· {item.course}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/70"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`cms-pill shrink-0 ${
                    item.level === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.level === 'high' ? 'Nguy cơ cao' : 'Cần nhắc'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cms-dash-empty">Hiện chưa có học viên nào thuộc nhóm nguy cơ.</p>
        )}
      </section>

      {/* Tự động hóa (Nhắc gia hạn, Nhắc học, Sinh nhật) & Bảo mật thiết bị */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        <section className="cms-dash-panel lg:col-span-8">
          <div className="cms-dash-panel-head">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="cms-dash-panel-title">Tự động hóa nhắc học · Gia hạn gói · Sinh nhật</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng hợp mẫu tin Zalo/Email tự động cá nhân hóa theo trạng thái từng học viên.
                </p>
              </div>
            </div>
            <span className="cms-pill bg-emerald-50 text-emerald-700">{realtime.automations.length} gợi ý</span>
          </div>

          {realtime.automations.length > 0 ? (
            <ul className="cms-dash-list">
              {realtime.automations.map((item) => (
                <li key={item.id} className="cms-dash-list-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${item.tone}`}>
                        {item.badge}
                      </span>
                      <p className="truncate text-sm font-bold text-slate-900">{item.studentName}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard?.writeText(item.message);
                        setCopiedAutoId(item.id);
                        setTimeout(() => setCopiedAutoId(''), 1800);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedAutoId === item.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copiedAutoId === item.id ? 'Đã chép' : 'Chép tin gửi'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cms-dash-empty">Hiện chưa có học viên nào đến kỳ gia hạn hoặc sinh nhật trong tháng.</p>
          )}
        </section>

        <section className="cms-dash-panel lg:col-span-4">
          <div className="cms-dash-panel-head">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="cms-dash-panel-title">Thiết bị &amp; Bảo mật phiên</h3>
                <p className="text-xs text-slate-500 mt-0.5">Phiên đăng nhập quản trị đang hoạt động</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
              <Laptop size={20} className="shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900">Thiết bị hiện tại · Đang tin cậy</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-600">{readBrowserSummary()}</p>
                <p className="mt-1 text-[11px] text-emerald-700 font-semibold">
                  Tài khoản: {session?.username || session?.name || 'Quản trị viên'} · JWT Active
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSecurityVerifiedAt(new Date().toLocaleTimeString('vi-VN'))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {securityVerifiedAt ? `✓ Đã xác thực lúc ${securityVerifiedAt}` : 'Kiểm tra an toàn phiên'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin#device-security')}
                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Thiết bị & 2FA OTP →
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Quick access */}
      <section>
        <h3 className="text-xs sm:text-sm font-bold  tracking-wider text-slate-400 mb-3 px-0.5">
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
