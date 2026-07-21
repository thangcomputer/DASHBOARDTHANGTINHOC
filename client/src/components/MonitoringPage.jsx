import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Database, HardDrive,
  Loader2, RefreshCw, Server, Timer, RotateCcw,
} from 'lucide-react';
import { monitoringAPI } from '../services/api';
import { useToast } from '../utils/toast';

function formatUptime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + (s % 60) + 's';
}

function StatusPill({ status }) {
  const ok = status === 'up' || status === 'healthy' || status === 'disabled' || status === 'inline' || status === 'bullmq';
  const warn = status === 'down' || status === 'degraded' || status === 'connecting';
  const cls = ok && status !== 'down'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : warn
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-600', bg = 'bg-indigo-50' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-black text-gray-900 truncate">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 font-medium mt-1">{sub}</p>}
    </div>
  );
}

export default function MonitoringPage({ session }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isSuper = session?.id === 'admin' || session?.adminRole === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    try {
      const res = await monitoringAPI.overview();
      if (res.success) setData(res.data);
    } catch {
      toast.error('Không tải được monitoring');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const onReset = async () => {
    if (!window.confirm('Reset bộ đếm metrics trong RAM?')) return;
    try {
      const res = await monitoringAPI.resetMetrics();
      if (res.success) {
        toast.success('Đã reset metrics');
        load();
      } else toast.error(res.message || 'Reset thất bại');
    } catch {
      toast.error('Lỗi kết nối');
    }
  };

  const health = data?.health;
  const metrics = data?.metrics;
  const alerts = data?.alerts || [];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Activity className="text-cyan-600" size={22} /> Monitoring
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Health · latency · lỗi request (tự làm mới 5s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isSuper && (
            <button type="button" onClick={onReset} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 flex items-center gap-1.5">
              <RotateCcw size={14} /> Reset metrics
            </button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="p-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={health?.status || 'unknown'} />
            <span className="text-xs text-gray-500 font-medium">
              Node {health?.node} · PID {health?.pid} · {health?.env}
            </span>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.code}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                    a.level === 'critical'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : a.level === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                  }`}
                >
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Database}
              label="MongoDB"
              value={health?.db?.status || '—'}
              sub={health?.db?.host || ''}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <StatCard
              icon={Server}
              label="Redis"
              value={health?.redis?.status || '—'}
              sub={`Queue: ${health?.queue?.mode || '—'}`}
              color="text-rose-600"
              bg="bg-rose-50"
            />
            <StatCard
              icon={HardDrive}
              label="Memory"
              value={`${health?.memory?.heapUsedMb ?? '—'} MB`}
              sub={`RSS ${health?.memory?.rssMb ?? '—'} MB`}
              color="text-violet-600"
              bg="bg-violet-50"
            />
            <StatCard
              icon={Timer}
              label="Uptime"
              value={formatUptime(health?.uptimeSec)}
              sub={`Since metrics: ${formatUptime(metrics?.uptimeSec)}`}
              color="text-cyan-600"
              bg="bg-cyan-50"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Activity} label="Requests" value={metrics?.requestsTotal ?? 0} sub={`Error rate ${metrics?.errorRate ?? 0}%`} />
            <StatCard icon={AlertTriangle} label="4xx / 5xx" value={`${metrics?.errors4xx ?? 0} / ${metrics?.errors5xx ?? 0}`} color="text-amber-600" bg="bg-amber-50" />
            <StatCard icon={Timer} label="Latency avg" value={`${metrics?.latency?.avgMs ?? 0} ms`} sub={`P95 ${metrics?.latency?.p95Ms ?? 0} ms`} />
            <StatCard icon={CheckCircle2} label="Latency max" value={`${metrics?.latency?.maxMs ?? 0} ms`} sub={`P50 ${metrics?.latency?.p50Ms ?? 0} ms`} color="text-emerald-600" bg="bg-emerald-50" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-sm font-black text-gray-800">Top endpoints</h2>
              </div>
              <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {(metrics?.topPaths || []).length === 0 ? (
                  <li className="p-6 text-center text-xs text-gray-400 font-bold">Chưa có traffic</li>
                ) : (
                  metrics.topPaths.map((p) => (
                    <li key={p.path} className="px-4 py-2.5 flex items-center gap-2 text-xs">
                      <span className="flex-1 font-mono text-gray-700 truncate">{p.path}</span>
                      <span className="font-black text-gray-900">{p.count}</span>
                      <span className="text-gray-400 w-14 text-right">{p.avgMs}ms</span>
                      {p.errors > 0 && <span className="text-red-600 font-bold">{p.errors} err</span>}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-sm font-black text-gray-800">Lỗi gần đây</h2>
              </div>
              <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {(metrics?.recentErrors || []).length === 0 ? (
                  <li className="p-6 text-center text-xs text-gray-400 font-bold">Không có lỗi gần đây</li>
                ) : (
                  metrics.recentErrors.map((e, i) => (
                    <li key={i} className="px-4 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-red-600">{e.status}</span>
                        <span className="text-gray-400">{e.durationMs}ms</span>
                      </div>
                      <p className="font-mono text-gray-700 truncate mt-0.5">{e.method} {e.path}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.at).toLocaleTimeString('vi-VN')}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}