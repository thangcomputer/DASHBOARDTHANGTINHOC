import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Bug, CheckCircle2, ChevronDown, ChevronRight,
  Database, Gauge, HardDrive, Loader2, RefreshCw, RotateCcw, Server,
  ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, Timer, Zap,
} from 'lucide-react';
import { aiSupportAPI, monitoringAPI } from '../services/api';
import { captureClientError } from '../utils/telemetry';
import { useToast } from '../utils/useToast';

function formatUptime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + (s % 60) + 's';
}

function formatVitalValue(name, val) {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) return 'Chưa có';
  if (name === 'CLS') return Number(val).toFixed(3);
  return `${Math.round(Number(val))} ms`;
}

function vitalBadge(rating) {
  if (rating === 'good') return { label: 'Tốt', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (rating === 'needs-improvement') return { label: 'Cần tối ưu', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  if (rating === 'poor') return { label: 'Chậm', cls: 'bg-red-50 text-red-700 border-red-200' };
  return { label: 'Chưa đo', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
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
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cls}`}>
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
        <p className="text-[10px] font-black text-gray-400 tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-black text-gray-900 truncate">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 font-medium mt-1">{sub}</p>}
    </div>
  );
}

const VITAL_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

export default function MonitoringPage({ session }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [ragMetrics, setRagMetrics] = useState(null);
  const [ragFeedbacks, setRagFeedbacks] = useState([]);
  const [reviewingFbId, setReviewingFbId] = useState('');
  const [windowHours, setWindowHours] = useState(24);
  const [issueStatus, setIssueStatus] = useState('all');
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const isSuper = session?.id === 'admin' || session?.adminRole === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    try {
      const [overviewRes, telRes, ragRes, fbRes] = await Promise.all([
        monitoringAPI.overview(),
        monitoringAPI.telemetry({ windowHours, issueStatus }),
        aiSupportAPI.getRagMetrics().catch(() => null),
        aiSupportAPI.listRagFeedback({ limit: 15 }).catch(() => null),
      ]);
      if (overviewRes?.success) setData(overviewRes.data);
      if (telRes?.success) setTelemetry(telRes.data);
      if (ragRes?.success) setRagMetrics(ragRes.data);
      if (fbRes?.success) setRagFeedbacks(Array.isArray(fbRes.data?.items) ? fbRes.data.items : []);
    } catch {
      toast.error('Không tải được dữ liệu monitoring');
    } finally {
      setLoading(false);
    }
  }, [toast, windowHours, issueStatus]);

  const onReviewRagFeedback = async (id, reviewStatus) => {
    setReviewingFbId(id);
    try {
      const res = await aiSupportAPI.reviewRagFeedback(id, { reviewStatus });
      if (res?.success) {
        toast.success(reviewStatus === 'reviewed_approved' ? 'Đã đánh dấu đã xem góp ý' : 'Đã bỏ qua góp ý');
        load();
      } else {
        toast.error(res?.message || 'Không cập nhật được phản hồi AI');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setReviewingFbId('');
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const onReset = async () => {
    if (!(await window.cmsConfirm('Reset bộ đếm metrics trong RAM?'))) return;
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

  const onToggleIssueResolve = async (issue) => {
    try {
      const nextResolved = !issue.resolved;
      const res = await monitoringAPI.resolveTelemetryIssue(issue.fingerprint, nextResolved);
      if (res.success) {
        toast.success(nextResolved ? 'Đã đánh dấu đã xử lý lỗi' : 'Đã mở lại issue lỗi');
        load();
      } else {
        toast.error(res.message || 'Không cập nhật được trạng thái');
      }
    } catch {
      toast.error('Lỗi kết nối');
    }
  };

  const onTriggerTestError = async () => {
    setSendingTest(true);
    try {
      captureClientError(new Error('Sentry Browser Test Error'), { route: '/admin/monitoring' });
      const res = await monitoringAPI.sendTestError('frontend');
      if (res.success) {
        toast.success('Đã ghi nhận sự kiện kiểm tra vào Sentry Tracker');
        load();
      } else {
        toast.error(res.message || 'Không gửi được test error');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSendingTest(false);
    }
  };

  const health = data?.health;
  const metrics = data?.metrics;
  const alerts = data?.alerts || [];
  const vitals = telemetry?.vitals || {};
  const routes = telemetry?.routes || [];
  const issues = telemetry?.issues || [];
  const sentry = telemetry?.sentry || {};
  const totals = telemetry?.totals || {};

  return (
    <div className="cms-viewport-fill w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Activity className="text-cyan-600" size={22} /> Giám sát hệ thống, Lỗi (Sentry) & Web Vitals
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Health · API Latency · Real User Core Web Vitals · Sentry Error Tracker (tự làm mới 8s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700"
            aria-label="Khung thời gian đo"
          >
            <option value={1}>1 giờ qua</option>
            <option value={24}>24 giờ qua</option>
            <option value={168}>7 ngày qua</option>
          </select>
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100" title="Làm mới ngay">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isSuper && (
            <>
              <button
                type="button"
                onClick={onTriggerTestError}
                disabled={sendingTest}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1.5"
              >
                {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}
                Test Sentry Error
              </button>
              <button type="button" onClick={onReset} className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 flex items-center gap-1.5">
                <RotateCcw size={14} /> Reset metrics
              </button>
            </>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="cms-viewport-scroll p-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <div className="cms-viewport-scroll space-y-5 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={health?.status || 'unknown'} />
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              sentry.configured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              {sentry.configured ? `Sentry External DSN: ${sentry.dsnMasked}` : 'Sentry Built-in Tracker (MongoDB)'}
            </span>
            <span className="text-xs text-gray-500 font-medium">
              Node {health?.node} · PID {health?.pid} · {health?.env}
            </span>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.code}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${a.level === 'critical'
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

          {/* Core Server & Traffic Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Database} label="MongoDB" value={health?.db?.status || '-'} sub={health?.db?.host || ''} color="text-emerald-600" bg="bg-emerald-50" />
            <StatCard icon={Server} label="Redis" value={health?.redis?.status || '-'} sub={`Queue: ${health?.queue?.mode || '-'}`} color="text-rose-600" bg="bg-rose-50" />
            <StatCard icon={HardDrive} label="Memory" value={`${health?.memory?.heapUsedMb ?? '-'} MB`} sub={`RSS ${health?.memory?.rssMb ?? '-'} MB`} color="text-red-600" bg="bg-red-50" />
            <StatCard icon={Timer} label="Uptime" value={formatUptime(health?.uptimeSec)} sub={`API Req: ${metrics?.requestsTotal ?? 0} · P95 ${metrics?.latency?.p95Ms ?? 0}ms`} color="text-cyan-600" bg="bg-cyan-50" />
          </div>

          {/* Core Web Vitals Real User Monitoring (Mục 4.3.6) */}
          <section className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Gauge className="text-emerald-600" size={18} />
                  Core Web Vitals người dùng thực tế ({windowHours}h)
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Tổng {totals.vitalSamples || 0} mẫu đo thực tế từ trình duyệt học viên / giảng viên / admin (ngưỡng Google p75)
                </p>
              </div>
              <span className="text-[11px] font-bold text-gray-400">
                API 4xx/5xx: {metrics?.errors4xx ?? 0} / {metrics?.errors5xx ?? 0}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {VITAL_ORDER.map((metricKey) => {
                const v = vitals[metricKey] || { name: metricKey, count: 0, p75: null, p50: null, p75Rating: '', breakdown: {} };
                const badge = vitalBadge(v.p75Rating);
                const goodPct = v.breakdown?.goodPct ?? 0;
                return (
                  <div key={metricKey} className="rounded-xl border border-gray-100 bg-slate-50/60 p-3 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-gray-800">{metricKey}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div>
                      <p className="text-xl font-black text-gray-900">{formatVitalValue(metricKey, v.p75)}</p>
                      <p className="text-[10px] text-gray-500 font-medium truncate">{v.label || metricKey} (p75)</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${v.count ? goodPct : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 flex justify-between">
                        <span>{v.count || 0} mẫu</span>
                        <span>{v.count ? `${goodPct}% Tốt` : '—'}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {routes.length > 0 && (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Trang / Route</th>
                      <th className="px-3 py-2">LCP (p75)</th>
                      <th className="px-3 py-2">INP (p75)</th>
                      <th className="px-3 py-2">CLS (TB)</th>
                      <th className="px-3 py-2 text-right">Mẫu đo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {routes.map((r) => {
                      const b = vitalBadge(r.lcpRating);
                      return (
                        <tr key={r.route} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-mono font-bold text-gray-800 truncate max-w-[240px]">{r.route}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${b.cls}`}>
                              {r.p75Lcp === null ? '—' : `${r.p75Lcp} ms`}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold text-gray-700">{r.p75Inp === null ? '—' : `${r.p75Inp} ms`}</td>
                          <td className="px-3 py-2 font-bold text-gray-700">{r.avgCls === null ? '—' : r.avgCls}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-500">{r.samples}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Sentry-style Error Issue Tracker (Mục 4.3.6) */}
          <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Bug className="text-rose-600" size={18} />
                  Giám sát lỗi ứng dụng (Sentry Issue Tracker)
                </h2>
                <p className="text-[11px] text-gray-500">
                  {totals.openIssues || 0} issue chưa xử lý · Tổng {totals.errorEvents || 0} sự kiện lỗi trong {windowHours}h qua
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'open', label: 'Chưa xử lý' },
                  { id: 'resolved', label: 'Đã xử lý' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setIssueStatus(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      issueStatus === tab.id
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-bold">
                <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={24} />
                Không ghi nhận lỗi nào trong bộ lọc hiện tại
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {issues.map((issue) => {
                  const isOpen = expandedIssue === issue.fingerprint;
                  return (
                    <li key={issue.fingerprint} className="p-4 hover:bg-slate-50/60 transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedIssue(isOpen ? null : issue.fingerprint)}
                          className="flex-1 min-w-0 text-left flex items-start gap-2"
                        >
                          {isOpen ? <ChevronDown size={16} className="mt-0.5 text-gray-400 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 text-gray-400 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                issue.source === 'backend'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {issue.source === 'backend' ? 'BACKEND' : 'FRONTEND'}
                              </span>
                              <span className="text-xs font-black text-gray-900">{issue.name}</span>
                              <span className="text-[11px] font-mono text-gray-500">{issue.route}</span>
                              {issue.resolved && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Đã xử lý
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 font-semibold mt-1 break-words">{issue.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {issue.occurrences} lần · Cuối: {new Date(issue.lastSeenAt).toLocaleString('vi-VN')} · {issue.browser || 'N/A'} · {issue.os || 'N/A'} · Role: {issue.userRole}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleIssueResolve(issue)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border shrink-0 transition-colors ${
                            issue.resolved
                              ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {issue.resolved ? 'Mở lại' : 'Đánh dấu đã sửa'}
                        </button>
                      </div>
                      {isOpen && (
                        <div className="mt-3 ml-6 rounded-xl bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto space-y-2">
                          <div>
                            <span className="text-slate-400">Fingerprint:</span> {issue.fingerprint}
                            {issue.statusCode ? ` · HTTP ${issue.statusCode}` : ''}
                            {issue.sentryForwarded ? ' · Forwarded to Sentry DSN' : ''}
                          </div>
                          {issue.stack && <pre className="whitespace-pre-wrap break-all text-rose-200">{issue.stack}</pre>}
                          {issue.componentStack && (
                            <pre className="whitespace-pre-wrap break-all text-amber-200 border-t border-slate-700 pt-2">
                              {issue.componentStack}
                            </pre>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* AI DewSkill RAG Pilot Monitoring & Feedback Review (Giai đoạn 6) */}
          {ragMetrics && (
            <section className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Sparkles className="text-emerald-600" size={18} />
                    Giám sát Pilot AI DewSkill (RAG Canary &amp; Phản hồi 7–14 ngày)
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Kho tri thức v{ragMetrics.ragConfig?.knowledgeVersion || 'n/a'} · Canary {ragMetrics.ragConfig?.canaryUserIdsCount ?? 0} User ID ·
                    Production All: {ragMetrics.ragConfig?.allowAllProduction ? 'BẬT' : 'KHÓA AN TOÀN (0)'} ·
                    Cache: <strong>{ragMetrics.cacheBackend?.activeBackend}</strong> ({ragMetrics.cacheBackend?.namespace || 'cms:'})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={ragMetrics.healthStatus || 'healthy'} />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Rollback: {ragMetrics.rollbackCommand || 'AI_KNOWLEDGE_RAG_ENABLED=0'}
                  </span>
                </div>
              </div>

              {Array.isArray(ragMetrics.alerts) && ragMetrics.alerts.length > 0 && (
                <div className="space-y-1.5">
                  {ragMetrics.alerts.map((al) => (
                    <div
                      key={al.code}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                        al.severity === 'critical'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div>[{al.code}] {al.message}</div>
                      {al.action && <div className="text-[11px] font-medium mt-0.5 opacity-90">Khuyến nghị: {al.action}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="rounded-xl border border-gray-100 bg-slate-50/70 p-3">
                  <div className="text-[10px] font-black text-gray-400 uppercase">Người dùng / Lượt thật</div>
                  <div className="text-lg font-black text-gray-900 mt-1">
                    {ragMetrics.promotionGate?.uniqueRealUsersCount ?? ragMetrics.uniqueRealUsersCount ?? 0} HV · {ragMetrics.promotionGate?.observedRequests ?? ragMetrics.pilotRequests ?? 0} câu
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Ngày: {ragMetrics.promotionGate?.observedDays ?? 0}/{ragMetrics.promotionGate?.requiredDays || '7-14'} · Mục tiêu ≥ {ragMetrics.promotionGate?.requiredMinRequests ?? 200}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-slate-50/70 p-3">
                  <div className="text-[10px] font-black text-gray-400 uppercase">Cache Hit Rate</div>
                  <div className="text-lg font-black text-emerald-700 mt-1">{ragMetrics.cacheHitRatePct ?? 0}%</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Hit {ragMetrics.cacheHits ?? 0} · Coalesced {ragMetrics.coalescedHits ?? 0} · Redis {ragMetrics.cacheBackend?.redisVersion || 'n/a'}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-slate-50/70 p-3">
                  <div className="text-[10px] font-black text-gray-400 uppercase">Chi phí &amp; Token</div>
                  <div className="text-lg font-black text-gray-900 mt-1">${Number(ragMetrics.estimatedCostUsd || 0).toFixed(5)}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {ragMetrics.tokens?.totalTokens ?? 0} tok · {ragMetrics.geminiCallsCount ?? 0} gọi Gemini
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-slate-50/70 p-3">
                  <div className="text-[10px] font-black text-gray-400 uppercase">Phản hồi thực tế</div>
                  <div className="text-lg font-black text-gray-900 mt-1 flex items-center gap-2">
                    <span className="text-emerald-700 inline-flex items-center gap-1"><ThumbsUp size={13} /> {ragMetrics.storedFeedback?.helpful ?? ragMetrics.feedback?.helpful ?? 0}</span>
                    <span className="text-rose-600 inline-flex items-center gap-1"><ThumbsDown size={13} /> {ragMetrics.storedFeedback?.inaccurate ?? ragMetrics.feedback?.inaccurate ?? 0}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Chờ Admin duyệt: {ragMetrics.storedFeedback?.pendingReview ?? 0}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-slate-50/70 p-3">
                  <div className="text-[10px] font-black text-gray-400 uppercase">Lỗi &amp; Không nguồn</div>
                  <div className="text-lg font-black text-gray-900 mt-1">
                    {Object.values(ragMetrics.errorsByType || {}).reduce((a, b) => a + Number(b || 0), 0)} API · {ragMetrics.noSourceFoundCount ?? 0} thiếu nguồn
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Client Web/Mob: {ragMetrics.clientErrors?.web ?? 0}/{ragMetrics.clientErrors?.mobile ?? 0} · Guard: {ragMetrics.outOfScopeRejected ?? 0}
                  </div>
                </div>
              </div>

              {/* Separated latency streams table */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Luồng AI (tách riêng)</th>
                      <th className="px-3 py-2 text-right">Số mẫu</th>
                      <th className="px-3 py-2 text-right">TB</th>
                      <th className="px-3 py-2 text-right">P50</th>
                      <th className="px-3 py-2 text-right">P95</th>
                      <th className="px-3 py-2 text-right">P99</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { key: 'ragCold', label: 'RAG Cold (Gemini + Giáo trình)' },
                      { key: 'ragWarmCache', label: 'RAG Warm (Redis Cache)' },
                      { key: 'legacy', label: 'Legacy (AI cũ ngoài Canary)' },
                      { key: 'guardMemory', label: 'Guard / Memory (chặn ngoài phạm vi & FAQ)' },
                    ].map(({ key, label }) => {
                      const s = ragMetrics.latencyByStream?.[key] || {};
                      return (
                        <tr key={key} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-bold text-gray-800">{label}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-600">{s.count ?? 0}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{s.avg ?? 0} ms</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{s.p50 ?? 0} ms</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{s.p95 ?? 0} ms</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{s.p99 ?? 0} ms</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Recent feedback queue for manual Admin review (NEVER auto-promoted to knowledge) */}
              {ragFeedbacks.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-black text-gray-700">
                      Phản hồi người dùng gần đây (Chỉ Admin duyệt thủ công · Không tự nạp vào RAG)
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{ragFeedbacks.length} mục</span>
                  </div>
                  <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {ragFeedbacks.map((fb) => (
                      <li key={fb._id} className="px-3 py-2.5 flex flex-wrap items-start justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              fb.rating === 'helpful'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {fb.rating === 'helpful' ? 'Hữu ích' : 'Chưa chính xác'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{fb.platform} · {fb.userRole}</span>
                            <span className="text-[10px] font-mono text-gray-400">{fb.reviewStatus}</span>
                          </div>
                          {fb.questionPreview && <p className="text-gray-800 font-semibold mt-1 truncate">Hỏi: {fb.questionPreview}</p>}
                          {fb.comment && <p className="text-rose-700 text-[11px] mt-0.5">Góp ý: {fb.comment}</p>}
                        </div>
                        {fb.reviewStatus === 'pending_admin_review' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={reviewingFbId === fb._id}
                              onClick={() => onReviewRagFeedback(fb._id, 'reviewed_approved')}
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100"
                            >
                              Đã duyệt xem
                            </button>
                            <button
                              type="button"
                              disabled={reviewingFbId === fb._id}
                              onClick={() => onReviewRagFeedback(fb._id, 'reviewed_dismissed')}
                              className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-bold hover:bg-gray-200"
                            >
                              Bỏ qua
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Top API endpoints & Recent RAM 500s */}
          <div className="grid lg:grid-cols-2 gap-4 min-h-[220px]">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 max-h-[min(40vh,22rem)]">
              <div className="px-4 py-3 border-b border-gray-50 shrink-0 flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                  <Zap size={15} className="text-amber-500" /> Top endpoints
                </h2>
              </div>
              <ul className="divide-y divide-gray-50 flex-1 min-h-0 overflow-y-auto">
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

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 max-h-[min(40vh,22rem)]">
              <div className="px-4 py-3 border-b border-gray-50 shrink-0">
                <h2 className="text-sm font-black text-gray-800">Lỗi HTTP gần đây (RAM)</h2>
              </div>
              <ul className="divide-y divide-gray-50 flex-1 min-h-0 overflow-y-auto">
                {(metrics?.recentErrors || []).length === 0 ? (
                  <li className="p-6 text-center text-xs text-gray-400 font-bold">Không có lỗi gần đây</li>
                ) : (
                  metrics.recentErrors.map((e, i) => (
                    <li key={i} className="px-4 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-gray-800 truncate">{e.method} {e.path}</span>
                        <span className="font-black text-red-600">{e.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.at).toLocaleTimeString('vi-VN')}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
