import { useState } from 'react';
import { Crown, KeyRound, Loader2, Sparkles, Ticket } from 'lucide-react';
import VideoCoursePayModal from '../../VideoCoursePayModal';
import subscriptionApi from '../../../services/subscriptionApi';
import { useToast } from '../../../utils/useToast';
import { formatActivationCodeInput, formatExpiryDate, formatVnd } from '../../../utils/subscription';

const PLAN_TONES = {
  '1m': 'from-sky-400 to-blue-600',
  '3m': 'from-emerald-400 to-teal-600',
  '6m': 'from-violet-400 to-purple-600',
  '12m': 'from-amber-400 to-orange-600',
  lifetime: 'from-red-500 to-rose-700',
};

/** Chọn gói (thanh toán SePay) hoặc nhập mã kích hoạt - dùng ở màn khóa và popup gia hạn. */
export default function SubscriptionRenewPanel({ overview, onRenewed }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState('');
  const [payment, setPayment] = useState(null);
  const plans = overview?.plans || [];
  const subscription = overview?.subscription;
  const isLifetime = subscription?.state === 'lifetime';
  const isFreePortal = (() => {
    try { return JSON.parse(localStorage.getItem('student_user') || '{}')?.freePortal === true; } catch { return false; }
  })();

  const redeem = async (event) => {
    event.preventDefault();
    if (!code || redeeming) return;
    setRedeeming(true);
    try {
      const result = await subscriptionApi.student.redeem(code);
      toast.success(`Kích hoạt thành công gói ${result.redeemedPlanLabel || ''}!`);
      setCode('');
      onRenewed?.();
    } catch (err) {
      toast.error(err.message || 'Không kích hoạt được mã');
    } finally {
      setRedeeming(false);
    }
  };

  const buy = async (plan) => {
    if (checkoutPlan) return;
    setCheckoutPlan(plan.id);
    try {
      const session = await subscriptionApi.student.checkout(plan.id);
      setPayment({ ...session, title: `Gói Meet ${plan.label}` });
    } catch (err) {
      toast.error(err.message || 'Không tạo được thanh toán');
    } finally {
      setCheckoutPlan('');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {!isLifetime && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-800">
            <Crown size={15} className="text-amber-500" aria-hidden="true" /> Chọn gói học Meet
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-1 sm:grid sm:grid-cols-3 md:grid-cols-5 sm:gap-2 sm:overflow-visible snap-x snap-mandatory">
            {plans.map((plan) => {
              const sellable = Number(plan.price) > 0;
              return (
                <div
                  key={plan.id}
                  className={`relative flex min-w-[125px] sm:min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-xl sm:rounded-2xl border bg-white text-center shadow-2xs transition-all hover:shadow-xs ${plan.id === 'lifetime' ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}
                >
                  <div className={`bg-gradient-to-br px-2 py-2 sm:px-2.5 sm:py-2.5 text-white ${PLAN_TONES[plan.id] || PLAN_TONES['1m']}`}>
                    {plan.id === 'lifetime' && <Sparkles size={12} className="absolute right-1.5 top-1.5 opacity-80" aria-hidden="true" />}
                    <p className="text-xs sm:text-sm lg:text-base font-black leading-tight">{plan.label}</p>
                    <p className="text-[9.5px] sm:text-[10px] font-semibold opacity-90 leading-tight mt-0.5">Meet · {plan.dailyXp || 300} XP {plan.resetCycle === 'monthly' ? 'mỗi tháng' : plan.resetCycle === 'never' ? 'tặng kèm' : 'mỗi ngày'}</p>
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-1.5 p-2 sm:p-2.5">
                    <p className={`text-xs sm:text-[13px] font-black ${sellable ? 'text-slate-900' : 'text-slate-400'}`}>
                      {sellable ? formatVnd(plan.price) : 'Kích hoạt bằng mã'}
                    </p>
                    <button
                      type="button"
                      disabled={!sellable || Boolean(checkoutPlan)}
                      onClick={() => buy(plan)}
                      className="cms-btn cms-btn-primary cms-btn-brand w-full !py-1 sm:!py-1.5 text-[11px] sm:text-xs rounded-lg sm:rounded-xl disabled:opacity-50"
                    >
                      {checkoutPlan === plan.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : 'Gia hạn'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <ul className="mt-2.5 grid gap-1 text-[10px] sm:text-[10.5px] font-medium text-slate-600 sm:grid-cols-2">
            {(plans[0]?.benefits || [
              'Học qua Meet với giảng viên',
              '300 XP mỗi ngày khi gói còn hạn',
              'Hết hạn thì tài khoản miễn phí về 60 XP mỗi ngày',
              'Xem video và dùng tính năng tự học trong hạn gói',
            ]).map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9.5px] sm:text-[10px] text-slate-500 leading-relaxed">
            Thanh toán hoặc nhập mã đều kích hoạt gói Meet. Thời gian mới được cộng tiếp từ hạn hiện tại. Trong hạn gói, mỗi ngày có 300 XP. Hết hạn thì tài khoản miễn phí về 60 XP mỗi ngày. XP đã mua vẫn được giữ.
          </p>
        </section>
      )}

      <section className="rounded-xl sm:rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-2.5 sm:p-3.5">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-800">
          <Ticket size={15} className="text-red-600" aria-hidden="true" /> Có mã kích hoạt?
        </h3>
        <form onSubmit={redeem} className="flex flex-col gap-1.5 sm:flex-row">
          <label className="relative flex-1">
            <KeyRound size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={code}
              onChange={(e) => setCode(formatActivationCodeInput(e.target.value))}
              placeholder="TTH-XXXX-XXXX"
              aria-label="Mã kích hoạt"
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 sm:py-2 pl-8 pr-2.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </label>
          <button type="submit" disabled={code.length < 13 || redeeming} className="cms-btn cms-btn-primary cms-btn-brand !py-1.5 sm:!py-2 text-xs sm:text-sm disabled:opacity-50">
            {redeeming ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : 'Kích hoạt'}
          </button>
        </form>
        <p className="mt-1 text-[9.5px] sm:text-[10px] text-slate-500">Mã do trung tâm cấp khi đăng ký gói Meet (1, 3, 6 tháng, 1 năm) hoặc gói vĩnh viễn.</p>
      </section>

      {payment && (
        <VideoCoursePayModal
          courseTitle={payment.title}
          sessionId={payment.sessionId}
          refCode={payment.ref}
          amount={payment.amount}
          paymentTitle={isFreePortal ? 'Gói học Meet' : 'Gói Khóa học'}
          paidEvent="subscription:renewed"
          getPaymentSession={subscriptionApi.student.session}
          simulatePayment={() => subscriptionApi.student.simulatePaid(payment.sessionId)}
          onClose={() => setPayment(null)}
          onPaid={() => {
            setPayment(null);
            toast.success('Thanh toán thành công. Tài khoản đã được gia hạn!');
            onRenewed?.();
          }}
          onSessionAlreadyPaid={() => {
            setPayment(null);
            onRenewed?.();
          }}
        />
      )}

      {subscription?.expiresAt && subscription.state !== 'expired' && (
        <p className="text-center text-xs text-slate-500">
          Hạn hiện tại: <strong className="text-slate-700">{formatExpiryDate(subscription.expiresAt)}</strong>
        </p>
      )}
    </div>
  );
}
