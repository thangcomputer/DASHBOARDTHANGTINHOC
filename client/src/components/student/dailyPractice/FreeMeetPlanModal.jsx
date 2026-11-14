import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronLeft, Loader2 } from 'lucide-react';
import subscriptionApi from '../../../services/subscriptionApi';
import api from '../../../services/api';
import { formatVnd } from '../../../utils/subscription';
import { generateVietQRUrl } from '../../bankSelectUtils';
import TransferPaymentDetails from '../../shared/TransferPaymentDetails';
import {
  MEET_MODAL_SHELL_CLASS,
  PLAN_META,
  resolveMeetXpSummary,
} from '../subscription/meetPlanConstants';
import {
  ActivationCodeSection,
  MeetBenefitsCard,
  MeetModalHeader,
  MeetPlanGrid,
  MeetScheduleStrip,
} from '../subscription/MeetPlanShared';

const DEFAULT_PLANS = Object.entries(PLAN_META).map(([id, meta]) => ({
  id,
  label: meta.fallbackLabel,
  hint: meta.hint,
  price: 0,
}));

const OFFICE_APPS = [
  { short: 'W', name: 'Word', tone: 'bg-[#2B579A]' },
  { short: 'X', name: 'Excel', tone: 'bg-[#217346]' },
  { short: 'P', name: 'PowerPoint', tone: 'bg-[#D24726]' },
];

export function isFreePortalAccount() {
  try {
    if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student')) {
      return true;
    }
    const u = JSON.parse(localStorage.getItem('student_user') || '{}');
    if (u?.freePortal === true) return true;
    const course = String(u?.course || '').toLowerCase();
    return course === 'tài khoản miễn phí' || course.includes('miễn phí');
  } catch {
    return false;
  }
}

export default function FreeMeetPlanModal({ open, onClose, onPaid, notice = '' }) {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState('3m');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [bank, setBank] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [paid, setPaid] = useState(false);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedLabel, setRedeemedLabel] = useState('');
  const [forceOpen, setForceOpen] = useState(false);
  const onCloseRef = useRef(onClose);
  const onPaidRef = useRef(onPaid);
  onCloseRef.current = onClose;
  onPaidRef.current = onPaid;

  useEffect(() => {
    const handler = (e) => setForceOpen(Boolean(e.detail));
    window.addEventListener('dewskill-test-meet-modal', handler);
    return () => window.removeEventListener('dewskill-test-meet-modal', handler);
  }, []);

  const visible = Boolean(open || forceOpen);

  const handleClose = () => {
    setForceOpen(false);
    onCloseRef.current?.();
  };

  useEffect(() => {
    if (!visible) {
      setOrder(null);
      setPaid(false);
      setError('');
      setShowCodeBox(false);
      setRedeemedLabel('');
      return undefined;
    }
    let cancelled = false;
    const loadOverview = () => {
      subscriptionApi.student.overview()
        .then((data) => {
          if (!cancelled && data) setOverview(data);
        })
        .catch(() => {});
    };
    loadOverview();
    window.addEventListener('xp-config-updated', loadOverview);
    api.settings.getPayment()
      .then((res) => {
        if (!cancelled && res?.success && res.data?.bankCode) setBank(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener('xp-config-updated', loadOverview);
    };
  }, [visible]);

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
    window.dispatchEvent(new CustomEvent('cms:subscription-updated'));
    onPaidRef.current?.();
    const timer = window.setTimeout(() => {
      setForceOpen(false);
      onCloseRef.current?.();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [paid]);

  if (!visible) return null;

  const plans = overview?.plans?.length ? overview.plans : DEFAULT_PLANS;
  const selected = plans.find((plan) => plan.id === selectedId) || plans[1] || plans[0];
  const selectedPrice = Number(selected?.price) || 0;
  const xpSummary = resolveMeetXpSummary(overview);
  const benefits = [
    'Học trực tiếp & hỏi đáp không giới hạn',
    'Có video xem lại sau mỗi buổi học',
    xpSummary.rangeText
      ? `Nhận ${xpSummary.rangeText} ${xpSummary.cycleText} luyện tập`
      : 'Tăng hạn mức XP luyện tập mỗi kỳ',
    `Hết hạn tài khoản Dewskill về ${xpSummary.freeXp} XP ${xpSummary.cycleText}`,
  ];

  const qrUrl = bank?.bankCode && bank?.accountNumber && order
    ? generateVietQRUrl(bank.bankCode, bank.accountNumber, order.amount, order.ref, bank.accountName || '')
    : null;

  const register = async () => {
    if (!selected || busy) return;
    if (!(selectedPrice > 0)) {
      setShowCodeBox(true);
      setError('Gói này kích hoạt bằng mã. Vui lòng nhập mã kích hoạt bên dưới.');
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

  const redeem = async (event) => {
    event.preventDefault();
    if (code.length < 13 || redeeming) return;
    setRedeeming(true);
    setError('');
    try {
      const result = await subscriptionApi.student.redeem(code);
      setRedeemedLabel(result.redeemedPlanLabel || '');
      setCode('');
      setPaid(true);
    } catch (err) {
      setError(err.message || 'Không kích hoạt được mã');
    } finally {
      setRedeeming(false);
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

  const headerTitle = paid
    ? 'Kích hoạt thành công'
    : order
      ? `Thanh toán gói ${order.planLabel || selected?.label || ''}`
      : 'Học tin học cùng giảng viên qua Google Meet';
  const headerSubtitle = paid || order
    ? 'Hệ thống tự động mở khóa lớp học và cập nhật ví XP ngay sau khi xác nhận'
    : 'Học trực tiếp Word · Excel · PowerPoint bài bản — Thực hành dễ hiểu từng bước';

  return createPortal(
    <div
      className="fixed inset-0 z-[9700] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/55 p-3 sm:p-5 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className={MEET_MODAL_SHELL_CLASS}
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <MeetModalHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          onClose={handleClose}
          badge={
            !paid && !order ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">
                DewSkill
              </span>
            ) : null
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
          {notice && !paid && !order ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-center text-xs font-semibold text-amber-900">
              {notice}
            </p>
          ) : null}

          {paid ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <div className="relative mx-auto h-32 w-32">
                <span className="dp-pay-ring absolute inset-0 rounded-full bg-emerald-400/30" />
                <span className="dp-pay-ring dp-pay-ring-delay absolute inset-2 rounded-full bg-emerald-400/25" />
                <span className="dp-pay-circle absolute inset-3 overflow-hidden rounded-full bg-emerald-950 shadow-xl ring-4 ring-emerald-500">
                  <img
                    src="/mascot/thanh-toan-thanh-cong.gif"
                    alt="Thanh toán thành công"
                    className="dp-pay-mascot h-full w-full object-cover"
                    draggable={false}
                  />
                </span>
                <span className="dp-pay-circle absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white shadow-md">
                  <Check size={18} strokeWidth={3.5} className="text-white" />
                </span>
              </div>
              <p className="mt-4 text-lg font-extrabold text-emerald-800">
                Tài khoản đã được kích hoạt!
              </p>
              <p className="mt-1 max-w-md text-xs sm:text-sm font-medium text-slate-600">
                Gói <strong>{redeemedLabel || order?.planLabel || selected?.label}</strong> đã sẵn sàng. Bạn có thể vào lớp Google Meet và luyện tập ngay.
              </p>
            </div>
          ) : order ? (
            <div className="space-y-3.5 py-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <button
                  type="button"
                  onClick={() => setOrder(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer !shadow-none"
                >
                  <ChevronLeft size={14} /> Quay lại chọn gói
                </button>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700">
                  {order.planLabel || selected?.label} · {formatVnd(order.amount)}
                </span>
              </div>

              <p className="text-center text-xs sm:text-sm font-medium text-slate-600">
                Quét mã QR chuyển khoản đúng nội dung{' '}
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono font-bold text-emerald-700">
                  {order.ref}
                </span>{' '}
                để hệ thống tự động kích hoạt.
              </p>

              <TransferPaymentDetails
                courseName={`Gói Meet ${order.planLabel || selected?.label || ''}`}
                amount={order.amount}
                qrUrl={qrUrl}
                loading={!bank}
                error={!bank ? 'Chưa cấu hình tài khoản nhận tiền.' : ''}
              />

              <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
                <Loader2 size={15} className="animate-spin text-emerald-600" />
                <span>Hệ thống đang tự động kiểm tra giao dịch...</span>
              </div>

              {import.meta.env.DEV ? (
                <button
                  type="button"
                  onClick={markPaid}
                  disabled={simulating}
                  className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/80 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-60 transition cursor-pointer"
                >
                  {simulating ? 'Đang kích hoạt thử...' : 'Test thử thanh toán thành công (DEV)'}
                </button>
              ) : null}
              {error ? <p className="text-center text-xs font-semibold text-red-600">{error}</p> : null}
            </div>
          ) : (
            <>
              {/* Khối giới thiệu Giảng viên + Lịch học + Quyền lợi cân đối 2 cột */}
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src="/giang-vien-phi-van-thang.png"
                      alt="Giảng viên Phí Văn Thắng"
                      className="h-14 w-14 shrink-0 rounded-2xl border-2 border-white object-cover object-top shadow-xs ring-2 ring-emerald-500/20"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-emerald-100/85 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                          Giảng viên
                        </span>
                        <div className="inline-flex items-center gap-1">
                          {OFFICE_APPS.map((app) => (
                            <span
                              key={app.short}
                              title={app.name}
                              className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-black text-white ${app.tone}`}
                            >
                              {app.short}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm sm:text-[15px] font-extrabold text-slate-900">
                        Phí Văn Thắng
                      </p>
                      <p className="text-xs font-medium text-slate-600 leading-snug">
                        8 năm kinh nghiệm · Dạy trực tiếp, dễ hiểu cho người mới & mất gốc
                      </p>
                    </div>
                  </div>
                  <MeetScheduleStrip />
                </div>

                <MeetBenefitsCard benefits={benefits} />
              </div>

              {/* Khối 5 thẻ gói học thống nhất với Popup gia hạn */}
              <MeetPlanGrid
                plans={plans}
                selectedId={selected?.id}
                onSelect={(id) => {
                  setSelectedId(id);
                  setError('');
                }}
                xpSummary={xpSummary}
                heading="Chọn gói học Meet"
              />

              {error ? <p className="text-center text-xs font-semibold text-red-600">{error}</p> : null}

              {/* Khối CTA chính + tùy chọn nhập mã gọn nhẹ */}
              <div className="flex flex-col items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={register}
                  disabled={busy}
                  className="inline-flex w-full sm:w-auto sm:min-w-[310px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : selectedPrice > 0 ? (
                    <>
                      <span>Đăng ký gói {selected?.label}</span>
                      <span className="text-emerald-100">·</span>
                      <span className="tabular-nums">{formatVnd(selectedPrice)}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  ) : (
                    <span>Gói {selected?.label} chỉ kích hoạt bằng mã</span>
                  )}
                </button>

                {!showCodeBox ? (
                  <button
                    type="button"
                    onClick={() => setShowCodeBox(true)}
                    className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition cursor-pointer !shadow-none bg-transparent border-0"
                  >
                    Đã có mã kích hoạt? <span className="underline underline-offset-2 font-bold text-emerald-700">Nhập mã tại đây</span>
                  </button>
                ) : null}
              </div>

              {showCodeBox ? (
                <ActivationCodeSection
                  code={code}
                  onChangeCode={setCode}
                  onSubmit={redeem}
                  redeeming={redeeming}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
