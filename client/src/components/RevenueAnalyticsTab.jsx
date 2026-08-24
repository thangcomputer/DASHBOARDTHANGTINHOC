/**
 * RevenueAnalyticsTab.jsx — Dashboard Báo cáo Doanh thu Đa tầng
 * Hiển thị: Tổng doanh thu, So sánh kỳ trước, Biểu đồ thời gian, Breakdown theo chi nhánh
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, BarChart3, Calendar, Building2,
  RefreshCw, Download, Users, DollarSign, Target, Loader2,
  ChevronDown, AlertCircle
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { exportToCSV } from '../utils/exportExcel';
import api from '../services/api';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

function getToken() {
  for (const role of ['admin','staff','teacher','student']) {
    const s = localStorage.getItem(`${role}_user`);
    if (s) { try { const u = JSON.parse(s); if (u?.token) return u.token; } catch {} }
  }
  for (const role of ['admin','staff']) {
    const t = localStorage.getItem(`${role}_access_token`);
    if (t) return t;
  }
  return '';
}

const PERIODS = [
  { value: '1d',  label: 'Hôm nay',   icon: '📅' },
  { value: '7d',  label: '7 ngày',    icon: '📆' },
  { value: '1m',  label: '1 tháng',   icon: '🗓️' },
  { value: '2m',  label: '2 tháng',   icon: '📊' },
  { value: '10m', label: '10 tháng',  icon: '📈' },
  { value: '1y',  label: '1 năm',     icon: '🏆' },
  { value: '2y',  label: '2 năm',     icon: '🚀' },
];

const BRANCH_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

// ── Sparkline bar chart (CSS-based, no library needed) ─────────────────────────
function BarChart({ data = [], color = '#6366f1', height = 80, emptyMessage = 'Chưa có dữ liệu' }) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center w-full text-gray-400 text-sm"
        style={{ minHeight: Math.max(height, 120) }}
      >
        {emptyMessage}
      </div>
    );
  }
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const allZero = data.every((d) => !(Number(d.value) > 0));
  const chartH = Math.max(Number(height) || 120, 80);
  return (
    <div className="w-full">
      {allZero && (
        <p className="text-center text-xs text-gray-400 mb-2">Doanh thu thuần = 0đ trong khoảng này</p>
      )}
      {/* Dùng height px (không %) — % trong flex-col không có chiều cao cố định → cột = 0 */}
      <div className="flex items-end gap-0.5 sm:gap-1 w-full" style={{ height: chartH }}>
        {data.map((d, i) => {
          const val = Number(d.value) || 0;
          const barPx = allZero
            ? 8
            : Math.max(Math.round((val / max) * chartH), val > 0 ? 4 : 1);
          return (
            <div
              key={`${d.label}-${i}`}
              className="flex-1 h-full flex items-end justify-center group relative min-w-[3px]"
              title={`${d.label}: ${val.toLocaleString('vi-VN')}đ`}
            >
              <div
                className="w-full max-w-full rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer"
                style={{
                  height: barPx,
                  background: allZero ? '#cbd5e1' : (val > 0 ? color : '#e2e8f0'),
                }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10 shadow-lg pointer-events-none">
                {d.label}<br />{val.toLocaleString('vi-VN')}đ
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mini donut chart (SVG) ─────────────────────────────────────────────────────
function DonutChart({ segments = [], size = 100 }) {
  const total = segments.reduce((s, sg) => s + (sg.pct || 0), 1);
  let angle = -90;
  const r = 38, cx = 50, cy = 50;
  const arcs = segments.map((seg, i) => {
    const pct   = (seg.pct / total) * 360;
    const start = angle;
    angle += pct;
    const x1 = cx + r * Math.cos((start * Math.PI) / 180);
    const y1 = cy + r * Math.sin((start * Math.PI) / 180);
    const x2 = cx + r * Math.cos((angle * Math.PI) / 180);
    const y2 = cy + r * Math.sin((angle * Math.PI) / 180);
    const large = pct > 180 ? 1 : 0;
    return { ...seg, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: BRANCH_COLORS[i % BRANCH_COLORS.length] };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} opacity={0.85} />)}
      <circle cx={50} cy={50} r={24} fill="white" />
    </svg>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = '#6366f1', trend, loading }) {
  return (
    <div className="bg-white rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100 min-h-[112px] flex flex-col">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== null && trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : trend < 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
            {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : null}
            {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : 'Không đổi'}
          </div>
        )}
      </div>
      {loading
        ? <div className="h-8 w-28 bg-gray-100 rounded animate-pulse mb-1" />
        : <p className="text-[1.625rem] leading-tight font-extrabold tracking-tight text-gray-900">{value}</p>
      }
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{sub}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RevenueAnalyticsTab() {
  const [period, setPeriod]       = useState('1m');
  const [data, setData]           = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('revenue');

  // ⭐ RBAC: Staff tự động khóa vào chi nhánh của mình
  const sess = (() => {
    for (const k of ['admin_user','staff_user']) {
      try { const s = JSON.parse(localStorage.getItem(k) || '{}'); if (s?.id) return s; } catch {}
    }
    return {};
  })();
  const isSuperAdmin = sess?.id === 'admin' || sess?.adminRole === 'SUPER_ADMIN';
  const isHighAdmin = sess?.adminRole === 'HIGH_ADMIN';
  // HIGH xem báo cáo đa chi nhánh giống Super khi Topbar chọn "Tất cả"
  const isElevatedAdmin = isSuperAdmin || isHighAdmin;
  const staffBranchCode = sess?.branchCode || '';

  const { selectedBranchId } = useBranch();

  const headers = { Authorization: `Bearer ${getToken()}` };

  const fetchAll = useCallback(async (p, b) => {
    setLoading(true);
    setError('');
    try {
      // Backend `branchFilter` ưu tiên convention `branch_id` cho allowlist READ.
      // FE legacy đôi khi chỉ gửi `branchId` => HIGH_ADMIN bị fail-closed.
      const branch = b || 'all';
      const qs = `period=${encodeURIComponent(p)}&branchId=${encodeURIComponent(branch)}&branch_id=${encodeURIComponent(branch)}`;
      // Chỉ fetch revenue + enrollment theo cùng period — không gọi /branches (all-time).
      const [rev, enr] = await Promise.all([
        fetch(`${API}/api/analytics/revenue?${qs}`, { headers }).then((r) => r.json()),
        fetch(`${API}/api/analytics/enrollment?${qs}`, { headers }).then((r) => r.json()),
      ]);
      if (rev.success) setData(rev.data);
      if (enr.success) setEnrollment(enr.data);
    } catch { setError('Lỗi kết nối server. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { 
    // Khi gọi API lấy thông số, dùng selectedBranchId từ Topbar
    fetchAll(period, selectedBranchId); 
  }, [period, selectedBranchId, fetchAll]);

  const fmt = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
  const selectedPeriodLabel = PERIODS.find(p => p.value === period)?.label || '';

  const exportRevenueReport = () => {
    try {
      const rows = (data?.timeline || []).map((t) => ({
        'Thời gian / Ngày': t.label || t.date || 'N/A',
        'Doanh thu (VNĐ)': t.value || t.amount || 0,
      }));
      if (rows.length === 0) {
        rows.push({
          'Kỳ báo cáo': selectedPeriodLabel,
          'Tổng doanh thu (VNĐ)': data?.totalRevenue || 0,
          'Số giao dịch thu': data?.paidStudentsCount || 0,
          'Học viên mới': data?.newStudentsCount || 0,
        });
      }
      exportToCSV(rows, `BaoCaoDoanhThu_${period}_${new Date().toISOString().split('T')[0]}.csv`);
      api.systemLogs.create({
        action: 'TẢI BÁO CÁO DOANH THU',
        category: 'finance',
        message: `Tải file báo cáo doanh thu (${selectedPeriodLabel})`,
        target: 'revenue-analytics-csv',
      }).catch(() => {});
    } catch (e) {
      console.error('Lỗi khi xuất báo cáo:', e);
    }
  };

  return (
    <div className="cms-viewport-fill">
      {/* ── Header Controls ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BarChart3 size={22} className="text-sky-700" />
            Báo cáo Doanh thu
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{isElevatedAdmin ? 'Thống kê đa chi nhánh theo thời gian thực' : `Doanh thu chi nhánh ${staffBranchCode}`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isElevatedAdmin && (
            <div className="flex items-center gap-1.5 border border-sky-200 bg-sky-50 rounded-xl px-3 py-2 text-sm font-bold text-indigo-700">
              <Building2 size={14} /> {staffBranchCode || 'Chi nhánh của bạn'}
            </div>
          )}
          {/* Export Report */}
          <button
            type="button"
            onClick={exportRevenueReport}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 border border-emerald-200 bg-emerald-50 rounded-xl px-4 min-h-[44px] text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50 touch-manipulation shadow-sm"
            title="Xuất file báo cáo doanh thu CSV"
          >
            <Download size={14} />
            Xuất báo cáo
          </button>
          {/* Refresh */}
          <button onClick={() => fetchAll(period, selectedBranchId)} disabled={loading}
            className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl px-4 min-h-[44px] text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 touch-manipulation">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── Period Selector ─────────────────────────────────────────── */}
      <div className="cms-m-filter-scroll flex gap-2 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1 shrink-0">
        {PERIODS.map(p => (
          <button key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`cms-m-filter-chip flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition ${
              period === p.value ? 'is-active' : ''
            }`}>
            <span>{p.icon}</span> {p.label}
          </button>
        ))}
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <StatCard label={`Doanh thu ${selectedPeriodLabel}`} value={fmt(data?.totalRevenue)}
          icon={DollarSign} color="#6366f1" trend={data?.growthPct} loading={loading}
          sub={`Ledger net · so với kỳ trước: ${fmt(data?.prevRevenue)}`} />
        <StatCard label="Giao dịch thu (Ledger)" value={data?.paidStudentsCount ?? '—'}
          icon={Users} color="#10b981" trend={null} loading={loading}
          sub={`Trong ${selectedPeriodLabel}`} />
        <StatCard label="Học viên mới đăng ký" value={data?.newStudentsCount ?? '—'}
          icon={Target} color="#f59e0b" trend={null} loading={loading}
          sub={`Ops · trong ${selectedPeriodLabel}`} />
        <StatCard label="Tổng tích lũy (all-time)" value={fmt(data?.allTimeRevenue)}
          icon={TrendingUp} color="#ef4444" trend={null} loading={loading}
          sub="Ledger · toàn thời gian (cố ý, không theo kỳ)" />
      </div>

      {/* ── Sub-tabs ───────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 -mx-1 shrink-0">
        <div className="flex gap-1 flex-nowrap overflow-x-auto">
          {[
            { id: 'revenue',  label: '📈 Doanh thu theo thời gian' },
            ...(isElevatedAdmin ? [{ id: 'branches', label: '🏢 Theo chi nhánh' }] : []),
            { id: 'enrollment', label: '👥 Học viên đăng ký' },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 min-h-[48px] px-4 text-[15px] font-bold border-b-2 -mb-px transition whitespace-nowrap ${
                activeTab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab panels (scroll) ─────────────────────────────────────── */}
      <div className="cms-viewport-scroll space-y-4">
      {/* ── Tab: Revenue Timeline ──────────────────────────────────── */}
      {activeTab === 'revenue' && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col min-h-[220px] lg:min-h-0 lg:h-full">
          <h3 className="font-black text-gray-700 mb-1 flex items-center gap-2 shrink-0">
            <BarChart3 size={16} className="text-indigo-500" />
            Biểu đồ doanh thu — {selectedPeriodLabel}
          </h3>
          <p className="text-[11px] text-gray-400 mb-4 shrink-0">
            Doanh thu thuần từ sổ cái (Ledger: thu − hoàn) · {data?.timezone || 'Asia/Ho_Chi_Minh'}
          </p>
          <div className="cms-m-chart min-h-[180px] flex-1 flex flex-col">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-gray-400 min-h-[160px]">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : data?.timeSeries?.length ? (
              <>
                <div className="flex-1 flex flex-col justify-end min-h-[160px]">
                  <BarChart data={data.timeSeries} color="#6366f1" height={160} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                  <span>{data.timeSeries[0]?.label}</span>
                  <span>{data.timeSeries[data.timeSeries.length - 1]?.label}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center text-gray-400 text-sm min-h-[160px]">
                Chưa có dữ liệu trong khoảng này
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: By Branch ─────────────────────────────────────────── */}
      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut — cùng data.byBranch (Ledger + period) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-700 mb-1">Tỷ lệ đóng góp</h3>
            <p className="text-[11px] text-gray-400 mb-4">
              Ledger net · {selectedPeriodLabel} · {data?.timezone || 'Asia/Ho_Chi_Minh'}
            </p>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : data?.byBranch?.length ? (
              <div className="flex items-center gap-6">
                <DonutChart segments={data.byBranch} size={110} />
                <div className="space-y-2 flex-1">
                  {data.byBranch.map((b, i) => (
                    <div key={b.branchId || i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                        <span className="text-xs font-medium text-gray-700">
                          {b.branchName || b.branchCode || 'Không xác định'}
                        </span>
                      </div>
                      <span className="text-xs font-black text-gray-600">{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 text-sm">Chưa có doanh thu Ledger trong kỳ</div>
            )}
          </div>

          {/* Table — cùng data.byBranch (period Ledger); không dùng endpoint branches all-time */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-700 mb-1">Chi tiết từng chi nhánh</h3>
            <p className="text-[11px] text-gray-400 mb-4">
              Doanh thu thuần Ledger trong kỳ đã chọn ({selectedPeriodLabel})
            </p>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : data?.byBranch?.length ? (
              <div className="space-y-3">
                {data.byBranch.map((b, i) => {
                  const label = b.branchName || b.branchCode || 'Không xác định';
                  const initial = String(label)[0] || '?';
                  return (
                    <div key={b.branchId || i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0"
                          style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-700 truncate">{label}</p>
                          <p className="text-[10px] text-gray-400">
                            {b.count || 0} giao dịch thu
                            {b.branchCode && b.branchName ? ` · ${b.branchCode}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-indigo-700">{fmt(b.total)}</p>
                        <p className="text-[10px] text-gray-400">{b.pct}% tổng kỳ</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 text-sm">Chưa có doanh thu Ledger trong kỳ</div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Enrollment (ops — không phải Ledger revenue) ───────── */}
      {activeTab === 'enrollment' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed">
            Tab này là <strong>ops đăng ký</strong> (HV mới theo <code>createdAt</code> + học phí trên enrollment).
            {' '}KPI doanh thu phía trên và tab chi nhánh dùng <strong>Ledger</strong> — hai nguồn không bắt buộc bằng nhau.
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Học viên mới (ops)', value: enrollment?.total ?? '—', color: '#6366f1' },
              { label: 'HV có enrollment đã đóng', value: enrollment?.paid ?? '—', color: '#10b981' },
              { label: 'Học phí enrollment (ops)', value: fmt(enrollment?.totalFee), color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Enrollment chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-700 mb-1">Đăng ký theo thời gian — {selectedPeriodLabel}</h3>
            <p className="text-[11px] text-gray-400 mb-4">Số liệu ops theo ngày đăng ký HV (không phải Ledger)</p>
            <div className="cms-m-chart min-h-[180px] flex flex-col">
              {loading
                ? <div className="flex flex-1 items-center justify-center min-h-[160px]"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
                : enrollment?.timeSeries?.length
                  ? (
                    <div className="flex-1 flex flex-col justify-end min-h-[260px]">
                      <BarChart
                        data={enrollment.timeSeries.map((d) => ({ ...d, value: d.value || 0 }))}
                        color="#10b981"
                        height={100}
                        emptyMessage="Chưa có dữ liệu"
                      />
                    </div>
                  )
                  : <div className="flex flex-1 items-center justify-center text-center text-gray-400 text-sm min-h-[160px]">Chưa có dữ liệu</div>
              }
            </div>
          </div>

          {/* By branch table */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-700 mb-1">Đăng ký theo chi nhánh</h3>
            <p className="text-[11px] text-gray-400 mb-4">Ops enrollment — cột tiền = học phí trên hồ sơ, không phải doanh thu Ledger</p>
            {loading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : enrollment?.byBranch?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 text-left font-bold">Chi nhánh</th>
                      <th className="pb-2 text-center font-bold whitespace-nowrap">HV mới</th>
                      <th className="pb-2 text-center font-bold whitespace-nowrap">Có đóng phí</th>
                      <th className="pb-2 text-right font-bold whitespace-nowrap">Học phí enrollment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollment.byBranch.map((b, i) => {
                      const branchLabel = b.branchName || b.branchCode || 'Không xác định';
                      const idHint = (!b.branchCode && !b.branchName && b.branchId && b.branchId !== 'unknown')
                        ? String(b.branchId).slice(-6)
                        : '';
                      return (
                        <tr key={b.branchId || i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 font-medium text-gray-700 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Building2 size={13} className="text-gray-400 flex-shrink-0" />
                              <span>
                                {branchLabel}
                                {idHint ? <span className="text-[10px] text-gray-400 ml-1">…{idHint}</span> : null}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 text-center font-bold text-indigo-700">{b.count}</td>
                          <td className="py-2.5 text-center text-emerald-600 font-bold">{b.paid}</td>
                          <td className="py-2.5 text-right font-black text-gray-800 whitespace-nowrap">{fmt(b.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 text-sm">Chưa có dữ liệu đăng ký</div>
            )}
          </div>

          {/* By course */}
          {enrollment?.byCourse?.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-700 mb-1">Đăng ký theo khóa học</h3>
              <p className="text-[11px] text-gray-400 mb-4">Đếm lượt enrollment/khóa (một HV nhiều khóa → tổng có thể &gt; số HV)</p>
              <div className="space-y-2">
                {enrollment.byCourse.slice(0, 6).map((c, i) => {
                  const maxCount = enrollment.byCourse[0]?.count || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-28 min-w-[5rem] flex-shrink-0 text-xs text-gray-600 font-medium line-clamp-2 break-words leading-snug">{c.course}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${(c.count / maxCount) * 100}%`, background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                      </div>
                      <div className="w-20 text-right text-xs font-black text-gray-700">{c.count} lượt</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
