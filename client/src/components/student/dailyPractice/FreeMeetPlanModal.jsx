import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';
import subscriptionApi from '../../../services/subscriptionApi';
import api from '../../../services/api';
import { generateVietQRUrl } from '../../bankSelectUtils';
import TransferPaymentDetails from '../../shared/TransferPaymentDetails';

const SPARKS = [
  { top: '-10px', left: '-14px', delay: '0s', size: 11 },
  { top: '-16px', left: '38%', delay: '0.35s', size: 8 },
  { top: '-6px', right: '-16px', delay: '0.7s', size: 13 },
  { top: '70%', left: '-18px', delay: '1.05s', size: 7 },
  { top: '78%', right: '-12px', delay: '0.5s', size: 9 },
  { top: '18%', left: '62%', delay: '1.3s', size: 6 },
  { top: '46%', right: '8%', delay: '0.2s', size: 8 },
];

const MEET_LOGO = '/uploads/popup/google-meet.webp';

const MEET_SLOTS = [
  { label: 'Sáng', time: '9h-12h' },
  { label: 'Chiều', time: '14h-16h' },
  { label: 'Tối', time: '19h-21h' },
];

function GoldSparkles() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {SPARKS.map((spark, index) => (
        <span
          key={index}
          className="free-meet-spark absolute text-amber-200"
          style={{
            top: spark.top,
            left: spark.left,
            right: spark.right,
            animationDelay: spark.delay,
            fontSize: spark.size,
          }}
        >
          ✦
        </span>
      ))}
    </span>
  );
}

const OFFER_PLANS = [
  { id: '1m', label: '1 tháng', hint: 'Làm quen' },
  { id: '3m', label: '3 tháng', hint: 'Phổ biến', featured: true },
  { id: '6m', label: '6 tháng', hint: 'Học chắc' },
  { id: '12m', label: '1 năm', hint: 'Tiết kiệm nhất' },
  { id: 'lifetime', label: 'Vĩnh viễn', hint: 'Học mãi' },
];

export function isFreePortalAccount() {
  try {
    return JSON.parse(localStorage.getItem('student_user') || '{}')?.freePortal === true;
  } catch {
    return false;
  }
}

export default function FreeMeetPlanModal({ open, onClose, onPaid, notice = '' }) {
  const [plans, setPlans] = useState(OFFER_PLANS);
  const [selectedId, setSelectedId] = useState('3m');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [bank, setBank] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [paid, setPaid] = useState(false);
  const onCloseRef = useRef(onClose);
  const onPaidRef = useRef(onPaid);
  onCloseRef.current = onClose;
  onPaidRef.current = onPaid;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    subscriptionApi.student.overview()
      .then((data) => {
        if (cancelled) return;
        const priced = new Map((data?.plans || []).map((plan) => [plan.id, plan]));
        setPlans(OFFER_PLANS.map((plan) => ({ ...plan, price: Number(priced.get(plan.id)?.price) || 0 })));
      })
      .catch(() => {});
    api.settings.getPayment()
      .then((res) => {
        if (!cancelled && res?.success && res.data?.bankCode) setBank(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!order?.sessionId || paid) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const status = await subscriptionApi.student.session(order.sessionId);
        if (status?.paid) setPaid(true);
      } catch {
        /* bỏ qua lỗi hỏi trạng thái */
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [order?.sessionId, paid]);

  useEffect(() => {
    if (!paid) return undefined;
    window.dispatchEvent(new CustomEvent('free-portal-unlocked'));
    onPaidRef.current?.();
    const timer = window.setTimeout(() => onCloseRef.current?.(), 2500);
    return () => window.clearTimeout(timer);
  }, [paid]);

  if (!open) return null;
  const selected = plans.find((plan) => plan.id === selectedId) || plans[1];
  const qrUrl = bank?.bankCode && bank?.accountNumber && order
    ? generateVietQRUrl(bank.bankCode, bank.accountNumber, order.amount, order.ref, bank.accountName || '')
    : null;

  const register = async () => {
    if (!selected || busy) return;
    if (!(selected.price > 0)) {
      setError('Gói này chưa mở thanh toán. Hãy liên hệ trung tâm để đăng ký.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await subscriptionApi.student.checkout(selected.id);
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Chưa tạo được đơn đăng ký');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!order?.sessionId || simulating || paid) return;
    setSimulating(true);
    setError('');
    try {
      await subscriptionApi.student.simulatePaid(order.sessionId);
      setPaid(true);
    } catch (err) {
      setError(err.message || 'Không xác nhận được thanh toán');
    } finally {
      setSimulating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9700] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <style>{`
        @keyframes free-meet-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.45) rotate(0deg); }
          45% { opacity: 1; transform: scale(1.15) rotate(18deg); }
        }
        @keyframes free-meet-gold {
          0% { background-position: 0% 50%; }
          100% { background-position: 220% 50%; }
        }
        @keyframes free-meet-spin { to { transform: rotate(360deg); } }
        .free-meet-run { overflow: hidden; }
        .free-meet-run::before {
          content: "";
          position: absolute;
          inset: -70%;
          background: conic-gradient(#22c55e, #ef4444, #a855f7, #22c55e);
          animation: free-meet-spin 2.8s linear infinite;
        }
        .free-meet-spark { animation: free-meet-twinkle 1.4s ease-in-out infinite; text-shadow: 0 0 8px #fde68a; }
        .free-meet-gold {
          background-image: linear-gradient(100deg, #fbbf24 0%, #fff7d6 28%, #f59e0b 46%, #fff 58%, #fbbf24 100%);
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: free-meet-gold 2.2s linear infinite;
          filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.85));
        }
      `}</style>
      <div
        className="w-full max-w-4xl overflow-hidden rounded-[28px] border-2 border-white bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.35),0_0_48px_12px_rgba(255,255,255,0.55),0_25px_60px_-12px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-meet-plan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-red-900 to-orange-600 px-5 py-5 text-white sm:px-6">
          <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-900 hover:bg-amber-100 !shadow-none">
            Đóng
          </button>
          <div className="grid items-center gap-4 pr-12 sm:grid-cols-[168px_minmax(0,1fr)_252px] sm:gap-6">
            <div className="flex flex-col items-center">
              <img
                src="/giang-vien-phi-van-thang.png"
                alt="Giảng viên Phí Văn Thắng"
                className="h-32 w-32 rounded-full border-[3px] border-white object-cover object-top shadow-[0_0_28px_rgba(255,255,255,0.55)]"
              />
              <p className="mt-2 w-full rounded-2xl bg-white px-3 py-1.5 text-center shadow-sm">
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Giảng viên</span>
                <span className="mt-0.5 block whitespace-nowrap text-[15px] font-black tracking-tight text-black">Phí Văn Thắng</span>
              </p>
              <p className="mt-2 text-center text-[11px] font-medium leading-5 text-white/90">
                8 năm kinh nghiệm
                <span className="block">đào tạo tin học.</span>
                <span className="mt-0.5 block font-semibold text-amber-100">Nhà sáng lập Thắng Tin Học.</span>
              </p>
            </div>
            <div className="min-w-0 text-center">
              <h2 id="free-meet-plan-title" className="text-[1.65rem] font-black leading-none tracking-tight sm:text-[1.85rem]">
                <span className="relative inline-block px-1">
                  <GoldSparkles />
                  <span className="free-meet-gold whitespace-nowrap">300 XP mỗi ngày</span>
                </span>
                <span className="mt-2.5 flex items-center justify-center gap-2 text-base font-black text-white">
                  <span className="text-amber-200">+</span>
                  học qua
                  <img src={MEET_LOGO} alt="Google Meet" className="h-10 w-auto object-contain drop-shadow-md" draggable={false} />
                </span>
              </h2>
              <div className="relative mx-auto mt-2 flex h-24 w-44 items-end justify-center">
                <span
                  className="pointer-events-none absolute bottom-1 left-1/2 h-10 w-40 -translate-x-1/2 rounded-[50%] bg-white/40 blur-xl"
                  aria-hidden="true"
                />
                <img
                  src="/uploads/popup/word-excel-powerpoint-3d.webp"
                  alt="Word, Excel và PowerPoint"
                  className="relative h-24 w-full object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.28)]"
                  draggable={false}
                />
              </div>
              <p className="mt-1 text-[13px] font-black leading-5 tracking-tight text-amber-50">
                Chinh phục tin học văn phòng
                <span className="mt-0.5 block text-xs font-semibold text-white/90">cùng Thầy Thắng</span>
              </p>
            </div>
            <div className="free-meet-run relative rounded-2xl p-[2px]">
              <div className="relative z-[1] rounded-[14px] bg-gradient-to-br from-red-950/95 via-red-800/90 to-orange-700/90 px-4 py-3.5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">Quyền lợi</p>
                <ul className="mt-3 space-y-2.5">
                  {['Học liên tục', 'Không giới hạn buổi học', 'Có video xem lại buổi học'].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-bold text-white">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
                        <Check size={12} strokeWidth={3.5} aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            {MEET_SLOTS.map((slot) => (
              <span key={slot.label} className="rounded-2xl border border-white/25 bg-white/10 px-2 py-2">
                <span className="block text-amber-200">{slot.label}</span>
                <span className="mt-0.5 block text-sm">{slot.time}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-5 py-5">
          {notice && !paid ? (
            <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-center text-sm font-black text-amber-900">{notice}</p>
          ) : null}
          {order && paid ? (
            <div className="px-2 py-3 text-center">
              <div className="relative mx-auto h-40 w-40">
                <span className="dp-pay-ring absolute inset-0 rounded-full bg-emerald-400/30" />
                <span className="dp-pay-ring dp-pay-ring-delay absolute inset-3 rounded-full bg-emerald-400/25" />
                <span className="dp-pay-circle absolute inset-4 overflow-hidden rounded-full bg-black shadow-lg ring-4 ring-emerald-500">
                  <img
                    src="/mascot/thanh-toan-thanh-cong.gif"
                    alt="Thanh toán thành công"
                    className="dp-pay-mascot h-full w-full object-cover"
                    draggable={false}
                  />
                </span>
                <span className="dp-pay-circle absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white shadow-md">
                  <svg viewBox="0 0 52 52" className="h-7 w-7" aria-hidden="true">
                    <path className="dp-pay-check" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M14 27 l8 8 l16-16" />
                  </svg>
                </span>
              </div>
              <p className="dp-pay-copy mt-2 text-lg font-black text-emerald-800">Bạn đã thanh toán thành công</p>
              <p className="dp-pay-copy text-sm font-semibold text-emerald-700">
                Gói {order.planLabel || selected.label} đã kích hoạt, kèm 300 XP mỗi ngày. Bạn có thể học Meet với giảng viên.
              </p>
            </div>
          ) : order ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Chuyển khoản đúng nội dung <span className="font-black text-slate-900">{order.ref}</span> để đăng ký gói {order.planLabel || selected.label}.
              </p>
              <TransferPaymentDetails
                courseName={`Gói ${order.planLabel || selected.label}`}
                amount={order.amount}
                qrUrl={qrUrl}
                loading={!bank}
                error={!bank ? 'Chưa cấu hình tài khoản nhận tiền.' : ''}
              />
              <p className="text-center text-[11px] font-semibold text-slate-400">Đang chờ thanh toán…</p>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={markPaid}
                  disabled={simulating}
                  className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-2.5 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-60 !shadow-none"
                >
                  {simulating ? 'Đang kích hoạt…' : 'Test thử'}
                </button>
              )}
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {plans.map((plan) => {
                  const active = plan.id === selected.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedId(plan.id)}
                      className={`group relative isolate overflow-visible rounded-2xl border-2 px-3 py-4 text-left !shadow-none transition duration-200 hover:-translate-y-0.5 ${active ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-amber-300'} ${plan.featured ? 'ring-2 ring-amber-300' : ''}`}
                    >
                      <span
                        className="pointer-events-none absolute -inset-2 -z-10 rounded-[22px] bg-[radial-gradient(circle,rgba(251,191,36,0.95),rgba(249,115,22,0.55)_42%,transparent_70%)] opacity-0 blur-md transition duration-200 group-hover:opacity-100"
                        aria-hidden="true"
                      />
                      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]" aria-hidden="true">
                        <span className="absolute inset-y-[-20%] left-[-40%] w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-all duration-700 group-hover:left-[130%] group-hover:opacity-90" />
                      </span>
                      {plan.featured && <span className="absolute -top-2 right-2 z-[1] rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">Nên chọn</span>}
                      <img src={MEET_LOGO} alt="" className="mb-1.5 h-8 w-auto object-contain" draggable={false} />
                      <span className="block text-base font-black tracking-tight text-slate-900">{plan.label}</span>
                      <span className="mt-1 block whitespace-nowrap text-[11px] font-black text-amber-600">+300 XP mỗi ngày</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{plan.hint}</span>
                      <span className="mt-3 block text-sm font-black tracking-tight text-red-600">
                        {plan.price > 0 ? `${plan.price.toLocaleString('vi-VN')}đ` : 'Liên hệ'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
              <button type="button" onClick={register} disabled={busy} className="cms-login-submit mt-4">
                {busy ? <Loader2 size={18} className="animate-spin" /> : 'Đăng ký gói này'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
