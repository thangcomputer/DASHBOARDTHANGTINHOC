import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, History, Loader2 } from 'lucide-react';
import subscriptionApi from '../../../services/subscriptionApi';
import { useToast } from '../../../utils/useToast';
import { PLAN_LABELS, formatExpiryDate, formatVnd, subscriptionShortLabel } from '../../../utils/subscription';

const SOURCE_LABELS = { code: 'Mã kích hoạt', payment: 'Thanh toán', admin: 'Admin' };
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100';

/** Admin xem + đặt/gia hạn gói tài khoản cho 1 học viên (dùng ở tab Mã kích hoạt và chi tiết HV). */
export default function AdminStudentSubscriptionPanel({ studentId, compact = false }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('extend');
  const [plan, setPlan] = useState('1m');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    if (!studentId) return;
    subscriptionApi.admin.student(studentId)
      .then(setData)
      .catch((err) => toast.error(err.message || 'Không tải được gói tài khoản'));
  }, [studentId, toast]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      await subscriptionApi.admin.setStudent(studentId, {
        mode,
        plan,
        // Hết hạn cuối ngày đã chọn (giờ VN)
        expiresAt: expiresAt ? `${expiresAt}T23:59:59+07:00` : null,
        note,
      });
      toast.success('Đã cập nhật gói tài khoản');
      setNote('');
      load();
    } catch (err) {
      toast.error(err.message || 'Không cập nhật được');
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Đang tải gói tài khoản…</p>;
  }
  const sub = data.subscription;
  const freePortal = data.freePortal === true;
  const meetPlan = sub.meetLifetime || ((sub.state === 'active' || sub.state === 'expiring') && sub.plan !== 'lifetime');
  const xpLine = sub.freeTier ? '60 XP mỗi ngày' : meetPlan ? '300 XP mỗi ngày' : '';

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${sub.state === 'expired' ? 'bg-red-50 ring-red-200' : sub.state === 'expiring' ? 'bg-amber-50 ring-amber-200' : 'bg-slate-50 ring-slate-100'}`}>
        <CalendarClock size={20} className={sub.state === 'expired' ? 'text-red-600' : sub.state === 'expiring' ? 'text-orange-600' : 'text-emerald-600'} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Gói hiện tại</p>
          <p className="text-sm font-black text-slate-900">{sub.freeTier ? 'Miễn phí' : `Gói ${sub.planLabel}`}</p>
          <p className="text-xs font-semibold text-slate-600">
            {xpLine ? `${xpLine}${sub.freeTier ? '' : ' · '}` : ''}
            {sub.freeTier ? '' : sub.state === 'lifetime' ? 'Không giới hạn thời gian' : subscriptionShortLabel(sub)}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs font-bold text-slate-600">
          Thao tác
          <select className={`${INPUT} mt-1`} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="extend">Gia hạn thêm theo gói</option>
            <option value="set">Đặt ngày hết hạn</option>
            <option value="require_activation">Bắt buộc nhập mã (khóa ngay)</option>
            {freePortal && <option value="free">Về gói miễn phí</option>}
          </select>
        </label>
        {mode === 'extend' && (
          <label className="block text-xs font-bold text-slate-600">
            Gói
            <select className={`${INPUT} mt-1`} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {Object.entries(PLAN_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        )}
        {mode === 'set' && (
          <label className="block text-xs font-bold text-slate-600">
            Hết hạn ngày
            <input type="date" className={`${INPUT} mt-1`} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        )}
        <label className="block text-xs font-bold text-slate-600">
          Ghi chú
          <input className={`${INPUT} mt-1`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: tặng thêm 1 tháng" />
        </label>
      </div>
      {mode === 'extend' && sub.state === 'lifetime' && !sub.freeTier && plan !== 'lifetime' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Học viên đang ở gói Vĩnh viễn. Cập nhật sẽ chuyển sang gói {PLAN_LABELS[plan]}, tính từ hôm nay.
        </p>
      )}
      {mode === 'free' && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          Đưa về đúng gói miễn phí học viên thấy: 60 XP mỗi ngày, có thể đăng ký gói Meet.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || (mode === 'set' && !expiresAt)}
        className="cms-btn cms-btn-primary !py-2 text-sm disabled:opacity-50"
      >
        {busy && <Loader2 size={14} className="animate-spin" />} Cập nhật gói
      </button>

      {!compact && data.history?.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><History size={12} /> Lịch sử</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-xs">
            {data.history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-semibold text-slate-700">
                  {SOURCE_LABELS[row.source] || row.source} · {row.planLabel}
                  {row.amount ? ` · ${formatVnd(row.amount)}` : ''}
                  {row.note ? ` · ${row.note}` : ''}
                </span>
                <span className="text-slate-400">
                  {row.newExpiresAt ? `→ ${formatExpiryDate(row.newExpiresAt)}` : '→ Vĩnh viễn'} · {formatExpiryDate(row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
