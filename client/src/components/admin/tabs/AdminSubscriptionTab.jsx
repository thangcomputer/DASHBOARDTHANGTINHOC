import { useCallback, useEffect, useState } from 'react';
import {
  Ban, Copy, CreditCard, Download, Loader2, Plus, RefreshCw, RotateCcw, Save, Search, Sparkles, Ticket, UserCog,
} from 'lucide-react';
import subscriptionApi from '../../../services/subscriptionApi';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { useToast } from '../../../utils/useToast';
import { PLAN_LABELS, formatExpiryDate } from '../../../utils/subscription';
import AdminStudentSubscriptionPanel from '../subscription/AdminStudentSubscriptionPanel';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100';
const STATUS_META = {
  unused: { label: 'Chưa dùng', tone: 'bg-emerald-50 text-emerald-700' },
  used: { label: 'Đã dùng', tone: 'bg-slate-100 text-slate-600' },
  revoked: { label: 'Đã thu hồi', tone: 'bg-red-50 text-red-600' },
};

function Card({ icon: Icon, title, children, right }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Icon size={16} className="text-red-600" /> {title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function PricesCard() {
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    subscriptionApi.admin.plans().then(setPlans).catch((err) => toast.error(err.message));
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      const prices = Object.fromEntries(plans.map((plan) => [plan.id, Number(plan.price) || 0]));
      setPlans(await subscriptionApi.admin.setPrices(prices));
      toast.success('Đã lưu giá gói');
    } catch (err) {
      toast.error(err.message || 'Không lưu được giá (cần quyền Tài chính)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      icon={Save}
      title="Giá gói (thanh toán SePay)"
      right={<button type="button" onClick={save} disabled={!plans || saving} className="cms-btn cms-btn-primary !py-1.5 text-xs">{saving && <Loader2 size={14} className="animate-spin" />} Lưu giá</button>}
    >
      {!plans ? <Loader2 size={18} className="animate-spin text-slate-400" /> : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {plans.map((plan, index) => (
            <label key={plan.id} className="block text-xs font-bold text-slate-600">
              {plan.label}
              <input
                type="number"
                min="0"
                step="1000"
                className={`${INPUT} mt-1`}
                value={plan.price}
                onChange={(e) => setPlans((prev) => prev.map((row, i) => (i === index ? { ...row, price: e.target.value } : row)))}
              />
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Giá 0 = gói không bán qua thanh toán, học viên chỉ kích hoạt được bằng mã.</p>
    </Card>
  );
}

function XpPackPricesCard() {
  const toast = useToast();
  const [packs, setPacks] = useState(null);
  const [prices, setPrices] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dailyPracticeApi.admin.xpPacks()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setPacks(list);
        setPrices(Object.fromEntries(list.map((pack) => [pack.id, String(pack.priceVnd)])));
      })
      .catch((err) => {
        setPacks([]);
        toast.error(err.message || 'Không tải được giá gói XP');
      });
  }, [toast]);

  const save = async () => {
    if (!packs?.length) return;
    setSaving(true);
    try {
      const next = await dailyPracticeApi.admin.saveXpPacks(
        Object.fromEntries(packs.map((pack) => [pack.id, Number(String(prices[pack.id] || '').replace(/\D/g, ''))])),
      );
      const list = Array.isArray(next) ? next : [];
      setPacks(list);
      setPrices(Object.fromEntries(list.map((pack) => [pack.id, String(pack.priceVnd)])));
      toast.success('Đã lưu giá gói XP');
    } catch (err) {
      toast.error(err.message || 'Chưa lưu được giá');
    } finally {
      setSaving(false);
    }
  };

  if (packs && !packs.length) return null;

  return (
    <Card
      icon={Save}
      title="Giá gói XP luyện"
      right={<button type="button" onClick={save} disabled={!packs || saving} className="cms-btn cms-btn-primary !py-1.5 text-xs">{saving && <Loader2 size={14} className="animate-spin" />} Lưu giá</button>}
    >
      {!packs ? <Loader2 size={18} className="animate-spin text-slate-400" /> : (
        <div className="grid gap-3 sm:grid-cols-3">
          {packs.map((pack) => (
            <label key={pack.id} className="block text-xs font-bold text-slate-600">
              {pack.label}
              <input
                inputMode="numeric"
                className={`${INPUT} mt-1`}
                value={prices[pack.id] || ''}
                onChange={(event) => setPrices((prev) => ({ ...prev, [pack.id]: event.target.value.replace(/[^\d]/g, '') }))}
              />
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Chỉ đổi số tiền. Mã gói và số XP giữ nguyên để đơn chuyển khoản cũ vẫn khớp.</p>
    </Card>
  );
}

function XpConfigCard() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    subscriptionApi.admin.getXpConfig().then(setConfig).catch((err) => toast.error(err.message));
  }, [toast]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await subscriptionApi.admin.setXpConfig(config);
      setConfig(updated);
      toast.success('Đã lưu cấu hình mức XP và chu kỳ đặt lại');
    } catch (err) {
      toast.error(err.message || 'Không lưu được cấu hình XP');
    } finally {
      setSaving(false);
    }
  };

  const resetAllNow = async () => {
    if (!window.confirm('Bạn có chắc muốn đặt lại ví XP của toàn bộ học viên về mức mới ngay bây giờ không?')) return;
    setResetting(true);
    try {
      const res = await subscriptionApi.admin.resetAllXp();
      toast.success(`Đã đặt lại ví XP cho ${res.modifiedCount} học viên thành công!`);
    } catch (err) {
      toast.error(err.message || 'Không đặt lại được ví XP');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card
      icon={Sparkles}
      title="Thiết lập mức XP & Chu kỳ đặt lại ví học viên"
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetAllNow}
            disabled={!config || resetting}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Đặt lại ví tất cả HV ngay
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!config || saving}
            className="cms-btn cms-btn-primary !py-1.5 text-xs flex items-center gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Lưu cấu hình XP
          </button>
        </div>
      }
    >
      {!config ? (
        <Loader2 size={18} className="animate-spin text-slate-400" />
      ) : (
        <div className="space-y-4">
          {/* 1. Chọn chu kỳ reset */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Chu kỳ đặt lại ví XP:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'daily', label: 'Reset mỗi ngày', desc: 'Đặt lại về mức gói đầu ngày (00:00 giờ VN)' },
                { id: 'monthly', label: 'Reset mỗi tháng', desc: 'Đặt lại về mức gói đầu tháng mới (ngày 1 hàng tháng)' },
                { id: 'never', label: 'Không cho reset', desc: 'Tặng 1 lần khi đăng ký / kích hoạt, không tự động đặt lại' },
              ].map((item) => {
                const active = config.resetCycle === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, resetCycle: item.id }))}
                    className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                      active
                        ? 'border-red-500 bg-red-50/70 text-red-950 ring-2 ring-red-200'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">{item.label}</span>
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${active ? 'border-red-600 bg-red-600' : 'border-slate-300'}`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Mức XP cho tài khoản cơ bản */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-2">
              1. Tài khoản cơ bản (Chưa mua gói)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                Tài khoản miễn phí (Cổng học thử)
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    className={INPUT}
                    value={config.freeAccountXp}
                    onChange={(e) => setConfig((prev) => ({ ...prev, freeAccountXp: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                  <span className="text-xs font-semibold text-slate-500 shrink-0">XP</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-normal">Học viên tự do đăng ký qua web, chưa đăng ký khóa học hay gói Meet.</p>
              </label>

              <label className="block text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                Tài khoản theo khóa học (Học viên chính thức)
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    className={INPUT}
                    value={config.courseAccountXp}
                    onChange={(e) => setConfig((prev) => ({ ...prev, courseAccountXp: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                  <span className="text-xs font-semibold text-slate-500 shrink-0">XP</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-normal">Học viên đóng học phí học các khóa tại trung tâm (Word, Excel, PowerPoint...).</p>
              </label>
            </div>
          </div>

          {/* 3. Mức XP theo từng gói học Meet */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-2">
              2. Tài khoản đăng ký theo gói học Google Meet
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: '1m', label: 'Gói 1 tháng', defaultHint: 'VD: 400 XP' },
                { id: '3m', label: 'Gói 3 tháng', defaultHint: 'VD: 500 XP' },
                { id: '6m', label: 'Gói 6 tháng', defaultHint: 'VD: 600 XP' },
                { id: '12m', label: 'Gói 1 năm', defaultHint: 'VD: 800 XP' },
                { id: 'lifetime', label: 'Gói Vĩnh viễn', defaultHint: 'VD: 1000 XP' },
              ].map((item) => (
                <label key={item.id} className="block text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {item.label}
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className={INPUT}
                      value={config.planXp?.[item.id] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setConfig((prev) => ({
                          ...prev,
                          planXp: { ...prev.planXp, [item.id]: val },
                        }));
                      }}
                    />
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">XP</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-normal">{item.defaultHint}</p>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function GenerateCard({ onCreated }) {
  const toast = useToast();
  const [plan, setPlan] = useState('1m');
  const [quantity, setQuantity] = useState(10);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastBatch, setLastBatch] = useState(null);

  const generate = async () => {
    setBusy(true);
    try {
      const batch = await subscriptionApi.admin.generate({ plan, quantity, note });
      setLastBatch(batch);
      toast.success(`Đã tạo ${batch.codes.length} mã gói ${PLAN_LABELS[plan]}`);
      onCreated?.();
    } catch (err) {
      toast.error(err.message || 'Không tạo được mã');
    } finally {
      setBusy(false);
    }
  };

  const copyBatch = async () => {
    const text = (lastBatch?.codes || []).map((row) => row.code).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép danh sách mã');
    } catch {
      toast.error('Không sao chép được');
    }
  };

  return (
    <Card icon={Plus} title="Tạo mã kích hoạt">
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_2fr_auto] sm:items-end">
        <label className="block text-xs font-bold text-slate-600">
          Gói
          <select className={`${INPUT} mt-1`} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {Object.entries(PLAN_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Số lượng
          <input type="number" min="1" max="500" className={`${INPUT} mt-1`} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Ghi chú lô
          <input className={`${INPUT} mt-1`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Khuyến mãi tháng 11" />
        </label>
        <button type="button" onClick={generate} disabled={busy} className="cms-btn cms-btn-primary !py-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />} Tạo mã
        </button>
      </div>
      {lastBatch?.codes?.length > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-emerald-800">Lô {lastBatch.batchId} · {lastBatch.codes.length} mã {PLAN_LABELS[lastBatch.plan]}</p>
            <button type="button" onClick={copyBatch} className="cms-btn cms-btn-outline !py-1 text-xs"><Copy size={13} /> Sao chép tất cả</button>
          </div>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {lastBatch.codes.map((row) => (
              <span key={row.id} className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-bold text-slate-800 ring-1 ring-emerald-200">{row.code}</span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function CodesCard({ reloadKey }) {
  const toast = useToast();
  const [filters, setFilters] = useState({ status: '', plan: '', q: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    subscriptionApi.admin.codes(filters)
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [filters, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const revoke = async (row) => {
    if (!window.confirm(`Thu hồi mã ${row.code}? Mã sẽ không dùng được nữa.`)) return;
    try {
      await subscriptionApi.admin.revoke(row.id);
      toast.success('Đã thu hồi mã');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Đã sao chép ${code}`);
    } catch {
      toast.error('Không sao chép được');
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await subscriptionApi.admin.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ma-kich-hoat.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      toast.error(err.message || 'Không xuất được CSV');
    }
  };

  const counts = data?.counts || {};
  return (
    <Card
      icon={Ticket}
      title="Danh sách mã"
      right={<button type="button" onClick={exportCsv} className="cms-btn cms-btn-outline !py-1.5 text-xs"><Download size={14} /> Xuất CSV</button>}
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${INPUT} pl-9`} value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Tìm mã, lô, ghi chú, người dùng…" />
        </label>
        <select className={INPUT} value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">Mọi trạng thái</option>
          <option value="unused">Chưa dùng ({counts.unused || 0})</option>
          <option value="used">Đã dùng ({counts.used || 0})</option>
          <option value="revoked">Đã thu hồi ({counts.revoked || 0})</option>
        </select>
        <select className={INPUT} value={filters.plan} onChange={(e) => setFilters((prev) => ({ ...prev, plan: e.target.value }))}>
          <option value="">Mọi gói</option>
          {Object.entries(PLAN_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {loading && !data ? <Loader2 size={18} className="animate-spin text-slate-400" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                <th className="py-2 pr-2">Mã</th>
                <th className="py-2 pr-2">Gói</th>
                <th className="py-2 pr-2">Trạng thái</th>
                <th className="py-2 pr-2">Người dùng</th>
                <th className="py-2 pr-2">Lô / ghi chú</th>
                <th className="py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(data?.codes || []).map((row) => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="py-2 pr-2 font-mono text-xs font-bold text-slate-800">{row.code}</td>
                  <td className="py-2 pr-2 text-xs font-semibold">{row.planLabel}</td>
                  <td className="py-2 pr-2">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${STATUS_META[row.status]?.tone || ''}`}>{STATUS_META[row.status]?.label || row.status}</span>
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-600">
                    {row.usedByName ? `${row.usedByName} · ${formatExpiryDate(row.usedAt)}` : '-'}
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-500">{[row.batchId, row.note].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => copy(row.code)} aria-label="Sao chép mã" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 !shadow-none"><Copy size={14} /></button>
                      {row.status === 'unused' && (
                        <button type="button" onClick={() => revoke(row)} aria-label="Thu hồi mã" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 !shadow-none"><Ban size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.codes.length && <p className="py-6 text-center text-sm text-slate-500">Chưa có mã nào khớp bộ lọc.</p>}
        </div>
      )}
    </Card>
  );
}

function StudentRenewCard() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const selectedId = selected?.id || '';

  useEffect(() => {
    const q = query.trim();
    if (!q || selectedId) {
      setMatches([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      subscriptionApi.admin.searchStudents(q)
        .then((rows) => { if (!cancelled) setMatches(Array.isArray(rows) ? rows : []); })
        .catch((err) => { if (!cancelled) toast.error(err.message || 'Không tìm được học viên'); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedId, toast]);

  const studentMeta = (student) => [student?.studentCode, student?.phone].filter(Boolean).join(' · ');

  return (
    <Card icon={UserCog} title="Gia hạn tay cho học viên">
      {selectedId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-sm font-black text-white">
              {String(selected?.name || 'H').trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-600">Học viên</p>
              <p className="truncate text-sm font-black text-slate-900">{selected?.name || 'Học viên'}</p>
              {studentMeta(selected) && <p className="truncate text-xs text-slate-500">{studentMeta(selected)}</p>}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="cms-btn cms-btn-outline shrink-0 !py-1.5 text-xs"
            >
              <RefreshCw size={13} /> Đổi học viên
            </button>
          </div>
          <AdminStudentSubscriptionPanel key={selectedId} studentId={selectedId} />
        </div>
      ) : (
        <>
          <label className="relative mb-2 block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${INPUT} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm học viên theo tên, số điện thoại hoặc mã HV…" />
          </label>
          {matches.length > 0 ? (
            <ul className="mb-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {matches.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(student)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-red-50/60 !shadow-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{student.name}</span>
                      {studentMeta(student) && <span className="block truncate text-xs text-slate-500">{studentMeta(student)}</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {student.subscription?.state === 'lifetime'
                        ? 'Vĩnh viễn'
                        : student.subscription?.state === 'expired'
                          ? 'Hết hạn'
                          : `Hạn ${formatExpiryDate(student.subscription?.expiresAt)}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {searching && <Loader2 size={13} className="animate-spin" />}
              {searching
                ? 'Đang tìm học viên…'
                : query.trim()
                  ? 'Không tìm thấy học viên phù hợp.'
                  : 'Tìm và chọn học viên để xem hạn, gia hạn thêm, đặt ngày hết hạn hoặc bắt buộc nhập mã.'}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/** Admin: giá gói, phát hành mã kích hoạt theo lô, danh sách mã, gia hạn tay cho HV. */
export default function AdminSubscriptionTab() {
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('pricing'); // pricing | codes | students

  const TABS = [
    { key: 'pricing', icon: CreditCard, label: 'Bảng giá & Cấu hình XP' },
    { key: 'codes', icon: Ticket, label: 'Mã kích hoạt' },
    { key: 'students', icon: UserCog, label: 'Gia hạn học viên' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-red-50 to-amber-50 p-4 ring-1 ring-red-100">
        <div>
          <h2 className="text-base font-black text-slate-900">Mã kích hoạt &amp; gói tài khoản</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Quản lý giá gói Meet (SePay), giá gói XP luyện, mức XP theo tài khoản, mã kích hoạt và gia hạn thủ công.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-white p-1 ring-1 ring-red-100 shadow-xs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                activeTab === tab.key
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'pricing' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PricesCard />
            <XpPackPricesCard />
          </div>
          <XpConfigCard />
        </div>
      )}

      {activeTab === 'codes' && (
        <div className="space-y-4">
          <GenerateCard onCreated={() => setReloadKey((n) => n + 1)} />
          <CodesCard reloadKey={reloadKey} />
        </div>
      )}

      {activeTab === 'students' && (
        <StudentRenewCard />
      )}
    </div>
  );
}
