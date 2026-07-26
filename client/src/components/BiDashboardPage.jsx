import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Download, Loader2, RefreshCw, TrendingDown, TrendingUp,
  Users, GraduationCap, Calendar, DollarSign, ClipboardCheck, Wallet,
} from 'lucide-react';
import { biAPI } from '../services/api';
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
  if (value === 0 || value == null) return <span className="text-[11px] text-gray-400">0%</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-black ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon size={12} />{up ? '+' : ''}{value}%
    </span>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta, color = 'text-indigo-600', bg = 'bg-indigo-50' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        {delta != null && <Delta value={delta} />}
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black text-gray-900 mt-1 truncate">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBars({ data = [], field = 'students', color = '#6366f1' }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d[field] || 0), 1);
  return (
    <div className="flex items-end gap-0.5 h-20 w-full">
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: ${d[field]}`}
          className="flex-1 rounded-t-sm opacity-90 hover:opacity-100"
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
      toast.success('Da tai CSV');
    } catch (e) {
      toast.error(e.message || 'Export that bai');
    }
  };

  const k = data?.kpis || {};

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={22} /> BI Dashboard
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            KPI điều hành · so sánh kỳ trước · cache 90s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-2 text-xs font-bold ${period === p.value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-500">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={onExport} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} label="Học viên mới" value={k.studentsNew ?? 0} delta={k.studentsNewChange} sub={`Tổng ${k.studentsTotal ?? 0}`} />
            <Kpi icon={DollarSign} label="Doanh thu kỳ" value={fmtMoney(k.revenuePeriod)} delta={k.revenueChange} color="text-emerald-600" bg="bg-emerald-50" sub={`Tỷ lệ TT ${k.paidRate ?? 0}%`} />
            <Kpi icon={GraduationCap} label="Giảng viên" value={k.teachersActive ?? 0} sub={`Chờ duyệt ${k.teachersPending ?? 0}`} color="text-violet-600" bg="bg-violet-50" />
            <Kpi icon={Calendar} label="Buổi hoàn thành" value={k.schedulesCompleted ?? 0} sub={`Hủy ${k.schedulesCancelled ?? 0} · Sắp tới ${k.schedulesUpcoming ?? 0}`} color="text-amber-600" bg="bg-amber-50" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Wallet} label="Chưa thanh toán" value={k.studentsUnpaid ?? 0} color="text-red-600" bg="bg-red-50" />
            <Kpi icon={ClipboardCheck} label="Tỷ lệ đỗ thi" value={k.examPassRate != null ? `${k.examPassRate}%` : '—'} sub={`${k.examPassed ?? 0}/${k.examTotal ?? 0} bài`} color="text-cyan-600" bg="bg-cyan-50" />
            <Kpi icon={DollarSign} label="GV chờ chi" value={k.transactionsPending ?? 0} color="text-orange-600" bg="bg-orange-50" />
            <Kpi icon={Users} label="Đã thanh toán" value={k.studentsPaid ?? 0} color="text-emerald-600" bg="bg-emerald-50" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-black text-gray-800 mb-3">Học viên mới theo ngày</h2>
              <MiniBars data={data?.trend || []} field="students" color="#6366f1" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-black text-gray-800 mb-3">Doanh thu đăng ký (theo ngày)</h2>
              <MiniBars data={data?.trend || []} field="revenue" color="#10b981" />
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-black text-gray-800">Top khóa học (kỳ này)</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {(data?.byCourse || []).length === 0 ? (
                <li className="p-6 text-center text-xs text-gray-400 font-bold">Chưa có dữ liệu</li>
              ) : (
                data.byCourse.map((c) => (
                  <li key={c.course} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <span className="flex-1 font-bold text-gray-800 truncate">{c.course}</span>
                    <span className="text-xs text-gray-500 font-bold">{c.count} HV</span>
                    <span className="text-xs font-black text-emerald-700">{fmtMoney(c.revenue)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}