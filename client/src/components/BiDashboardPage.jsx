import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Download, Loader2, RefreshCw, TrendingDown, TrendingUp,
  Users, GraduationCap, Calendar, DollarSign, ClipboardCheck, Wallet,
} from 'lucide-react';
import { biAPI, systemLogsAPI } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useToast } from '../utils/toast';

const PERIODS = [
  { value: '7d', label: '7 ngày' },
  { value: '1m', label: '1 tháng' },
  { value: '2m', label: '2 tháng' },
  { value: '1y', label: '1 năm' },
];

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ';
}

function Delta({ value }) {
  if (value === 0 || value == null) return <span className="text-[12px] text-slate-400">0%</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] font-bold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon size={12} />{up ? '+' : ''}{value}%
    </span>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta, color = 'text-sky-700', bg = 'bg-sky-50' }) {
  return (
    <div className="cms-m-kpi min-h-[112px]">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center`}>
          <Icon size={18} aria-hidden="true" />
        </div>
        {delta != null && <Delta value={delta} />}
      </div>
      <p className="cms-m-caption font-semibold uppercase tracking-wide">{label}</p>
      <p className="cms-m-kpi-value mt-1">{value}</p>
      {sub && <p className="cms-m-caption mt-0.5 line-clamp-2">{sub}</p>}
    </div>
  );
}

function MiniBars({ data = [], field = 'students', color = '#6366f1' }) {
  if (!data.length) {
    return (
      <div className="cms-m-empty min-h-[200px] flex-1">
        <BarChart3 size={28} className="opacity-30" aria-hidden="true" />
        <span>Chưa có dữ liệu biểu đồ</span>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d[field] || 0), 1);
  return (
    <div className="flex items-end gap-0.5 h-48 w-full min-h-[180px]">
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: ${d[field]}`}
          className="flex-1 rounded-t-sm opacity-90 hover:opacity-100 transition-opacity duration-150"
          style={{ height: `${Math.max(4, ((d[field] || 0) / max) * 100)}%`, background: color }}
        />
      ))}
    </div>
  );
}

export default function BiDashboardPage() {
  const toast = useToast();
  const { selectedBranchId } = useBranch();
  const [period, setPeriod] = useState('1m');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const branchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : 'all';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await biAPI.overview({ period, branchId });
      if (res.success) setData(res.data);
      else toast.error(res.message || 'Khong tai duoc BI');
    } catch {
      toast.error('Loi ket noi');
    } finally {
      setLoading(false);
    }
  }, [period, branchId, toast]);

  useEffect(() => { load(); }, [load]);

  const onExport = async () => {
    try {
      await biAPI.exportCsv({ period, branchId });
      systemLogsAPI.create({
        action: 'TẢI BÁO CÁO DOANH THU',
        category: 'finance',
        message: `Tải file báo cáo doanh thu BI (${period})`,
        target: 'bi-export-csv',
      }).catch(() => {});
      toast.success('Da tai CSV');
    } catch (e) {
      toast.error(e.message || 'Export that bai');
    }
  };

  const k = data?.kpis || {};

  return (
    <div className="max-w-6xl mx-auto cms-viewport-fill">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between shrink-0">
        <div className="min-w-0">
          <h1 className="cms-m-title flex items-center gap-2">
            <BarChart3 className="text-sky-700 flex-shrink-0" size={22} aria-hidden="true" /> BI Dashboard
          </h1>
          <p className="cms-m-caption mt-1">
            KPI điều hành · so sánh kỳ trước · cache 90s
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="cms-m-filter-scroll w-full sm:w-auto" role="group" aria-label="Khoảng thời gian">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`cms-m-filter-chip ${period === p.value ? 'is-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              aria-label="Làm mới"
              className="cms-m-btn bg-slate-50 text-slate-500 border border-slate-200"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onExport}
              className="cms-m-btn flex-1 sm:flex-none bg-red-600 text-white"
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="cms-viewport-scroll grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true" aria-label="Đang tải">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="cms-m-kpi animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-slate-100 mb-3" />
              <div className="h-3 w-20 bg-slate-100 rounded mb-2" />
              <div className="h-7 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="cms-viewport-scroll space-y-4">
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} label="Học viên mới" value={k.studentsNew ?? 0} delta={k.studentsNewChange} sub={`Tổng ${k.studentsTotal ?? 0}`} />
            <Kpi icon={DollarSign} label="Doanh thu thuần (kỳ)" value={fmtMoney(k.revenuePeriod)} delta={k.revenueChange} color="text-emerald-600" bg="bg-emerald-50" sub={`Tỷ lệ TT ${k.paidRate ?? 0}%`} />
            <Kpi icon={GraduationCap} label="Giảng viên" value={k.teachersActive ?? 0} sub={`Chờ duyệt ${k.teachersPending ?? 0}`} color="text-red-600" bg="bg-red-50" />
            <Kpi icon={Calendar} label="Buổi hoàn thành" value={k.schedulesCompleted ?? 0} sub={`Hủy ${k.schedulesCancelled ?? 0} · Sắp tới ${k.schedulesUpcoming ?? 0}`} color="text-amber-600" bg="bg-amber-50" />
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icon={Wallet}
              label="Hoàn học phí"
              value={fmtMoney(k.refundAmount ?? 0)}
              sub={k.refundCount ? `${k.refundCount} giao dịch trong kỳ` : 'Chưa có hoàn trong kỳ'}
              color="text-red-600"
              bg="bg-red-50"
            />
            <Kpi
              icon={DollarSign}
              label="Lợi nhuận (kỳ)"
              value={fmtMoney(k.profitPeriod ?? ((k.revenuePeriod || 0) - (k.costsPeriod || 0)))}
              sub={`Chi phí ${fmtMoney(k.costsPeriod ?? 0)}`}
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
            <Kpi icon={DollarSign} label="GV chờ chi" value={k.transactionsPending ?? 0} color="text-orange-600" bg="bg-orange-50" />
            <Kpi icon={Users} label="Đã thanh toán" value={k.studentsPaid ?? 0} color="text-emerald-600" bg="bg-emerald-50" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="cms-m-card p-4">
              <h2 className="cms-m-heading text-base mb-3">Học viên mới theo ngày</h2>
              <div className="cms-m-chart">
                <MiniBars data={data?.trend || []} field="students" color="#6366f1" />
              </div>
            </div>
            <div className="cms-m-card p-4">
              <h2 className="cms-m-heading text-base mb-3">Doanh thu đăng ký (theo ngày)</h2>
              <div className="cms-m-chart">
                <MiniBars data={data?.trend || []} field="revenue" color="#10b981" />
              </div>
            </div>
          </div>

          <div className="cms-m-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <h2 className="cms-m-heading text-base">Top khóa học (kỳ này)</h2>
            </div>
            <ul className="divide-y divide-slate-50">
              {(data?.byCourse || []).length === 0 ? (
                <li className="cms-m-empty min-h-[140px]">Chưa có dữ liệu</li>
              ) : (
                data.byCourse.map((c) => (
                  <li key={c.course} className="cms-m-list-row">
                    <span className="cms-m-list-title flex-1">{c.course}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="cms-m-caption font-bold">{c.count} HV</span>
                      <span className="text-[13px] font-extrabold text-emerald-700">{fmtMoney(c.revenue)}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
