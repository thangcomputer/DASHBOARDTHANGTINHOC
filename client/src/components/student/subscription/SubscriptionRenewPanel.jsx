import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, Loader2 } from 'lucide-react';
import VideoCoursePayModal from '../../VideoCoursePayModal';
import subscriptionApi from '../../../services/subscriptionApi';
import { useToast } from '../../../utils/useToast';
import { formatExpiryDate, formatVnd } from '../../../utils/subscription';
import { resolveMeetXpSummary } from './meetPlanConstants';
import {
  ActivationCodeSection,
  MeetBenefitsCard,
  MeetPlanGrid,
  MeetScheduleStrip,
} from './MeetPlanShared';

/** Chọn gói (thanh toán SePay) hoặc nhập mã kích hoạt - dùng ở màn khóa và popup gia hạn. */
export default function SubscriptionRenewPanel({ overview, onRenewed }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState('3m');
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState('');
  const [payment, setPayment] = useState(null);
  const codeInputRef = useRef(null);

  const plans = useMemo(() => overview?.plans || [], [overview?.plans]);
  const subscription = overview?.subscription;
  const isLifetime = subscription?.state === 'lifetime';
  const isFreePortal = (() => {
    try { return JSON.parse(localStorage.getItem('student_user') || '{}')?.freePortal === true; } catch { return false; }
  })();

  useEffect(() => {
    if (!plans.length) return;
    if (plans.some((p) => p.id === selectedId)) return;
    const preferred = plans.find((p) => p.id === '3m') || plans.find((p) => Number(p.price) > 0) || plans[0];
    if (preferred?.id) setSelectedId(preferred.id);
  }, [plans, selectedId]);

  const selected = plans.find((p) => p.id === selectedId) || plans.find((p) => p.id === '3m') || plans[0];
  const selectedPrice = Number(selected?.price) || 0;
  const xpSummary = resolveMeetXpSummary(overview);

  const benefits = [
    'Học qua Meet với giảng viên',
    xpSummary.rangeText
      ? `${xpSummary.rangeText} ${xpSummary.cycleText} khi gói còn hạn`
      : 'Tăng hạn mức XP luyện tập mỗi kỳ',
    `Hết hạn tài khoản Dewskill về ${xpSummary.freeXp} XP ${xpSummary.cycleText}`,
    'Xem video và dùng tính năng tự học trong hạn gói',
  ];

  const redeem = async (event) => {
    event.preventDefault();
    if (!code || redeeming) return;
    setRedeeming(true);
    try {
      const result = await subscriptionApi.student.redeem(code);
      toast.success(`Kích hoạt thành công gói ${result.redeemedPlanLabel || ''}!`);
      setCode('');
      window.dispatchEvent(new CustomEvent('free-portal-unlocked'));
      window.dispatchEvent(new CustomEvent('cms:subscription-updated'));
      onRenewed?.();
    } catch (err) {
      toast.error(err.message || 'Không kích hoạt được mã');
    } finally {
      setRedeeming(false);
    }
  };

  const buy = async (plan) => {
    if (!plan || checkoutPlan) return;
    if (!(Number(plan.price) > 0)) {
      codeInputRef.current?.focus();
      toast.info('Gói này kích hoạt bằng mã. Vui lòng nhập mã bên dưới.');
      return;
    }
    setCheckoutPlan(plan.id);
    try {
      const session = await subscriptionApi.student.checkout(plan.id);
      setPayment({ ...session, title: `Gói hỗ trợ AI ${plan.label}` });
    } catch (err) {
      toast.error(err.message || 'Không tạo được thanh toán');
    } finally {
      setCheckoutPlan('');
    }
  };

  return (
    <div className="space-y-4">
      {!isLifetime && (
        <>
          {!plans.length ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs font-semibold text-slate-500">
              <Loader2 size={16} className="animate-spin text-emerald-600" />
              <span>Đang tải danh sách gói học...</span>
            </div>
          ) : (
            <>
              {/* Khối giới thiệu & Quyền lợi cân đối 2 cột đồng bộ với Popup Đăng ký học Meet */}
              <div className="grid gap-3 md:grid-cols-[1.15fr_1fr]">
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-200/75 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                        <CalendarClock size={11} aria-hidden="true" /> Quy tắc cộng hạn
                      </span>
                      {subscription?.expiresAt && subscription.state !== 'expired' ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          Hạn hiện tại: {formatExpiryDate(subscription.expiresAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">
                      Thanh toán hoặc nhập mã đều kích hoạt gói hỗ trợ AI ngay. Thời gian mới được cộng nối tiếp từ hạn hiện tại.
                    </p>
                  </div>
                  <MeetScheduleStrip />
                </div>

                <MeetBenefitsCard benefits={benefits} title="Quyền lợi gói hỗ trợ AI" />
              </div>

              {/* Lưới 5 thẻ gói thống nhất với FreeMeetPlanModal */}
              <MeetPlanGrid
                plans={plans}
                selectedId={selected?.id}
                onSelect={setSelectedId}
                xpSummary={xpSummary}
                heading="Chọn gói hỗ trợ AI"
              />

              {/* Nút CTA chính duy nhất bên dưới 5 gói */}
              <div className="flex justify-center pt-0.5">
                <button
                  type="button"
                  disabled={!selected || Boolean(checkoutPlan)}
                  onClick={() => buy(selected)}
                  className="inline-flex w-full sm:w-auto sm:min-w-[310px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {checkoutPlan === selected?.id ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : selectedPrice > 0 ? (
                    <>
                      <span>Gia hạn gói {selected?.label}</span>
                      <span className="text-emerald-100">·</span>
                      <span className="tabular-nums">{formatVnd(selectedPrice)}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  ) : (
                    <span>Gói {selected?.label} kích hoạt bằng mã bên dưới</span>
                  )}
                </button>
              </div>
            </>
          )}
        </>
      )}

      <ActivationCodeSection
        code={code}
        onChangeCode={setCode}
        onSubmit={redeem}
        redeeming={redeeming}
        inputRef={codeInputRef}
      />

      {payment && (
        <VideoCoursePayModal
          courseTitle={payment.title}
          sessionId={payment.sessionId}
          refCode={payment.ref}
          amount={payment.amount}
          paymentTitle={isFreePortal ? 'Gói hỗ trợ AI' : 'Gói Khóa học'}
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
    </div>
  );
}
