import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, ArrowRight, Headphones, Crown, Sparkles, ChevronLeft } from 'lucide-react';
import subscriptionApi from '../../../services/subscriptionApi';
import api from '../../../services/api';
import { generateVietQRUrl } from '../../bankSelectUtils';
import TransferPaymentDetails from '../../shared/TransferPaymentDetails';
import { openAdminZalo } from '../../../utils/adminZaloContact';

const MEET_LOGO = '/uploads/popup/google-meet.webp';

const MEET_SLOTS = [
  { icon: '☀️', label: 'Sáng', time: '9h – 12h' },
  { icon: '⛅', label: 'Chiều', time: '14h – 16h' },
  { icon: '🌜', label: 'Tối', time: '19h – 21h' },
];

const BENEFITS = [
  'Học trực tiếp cùng giảng viên',
  'Hỏi đáp ngay trong buổi học',
  'Không giới hạn số lần hỏi lại',
  'Có video xem lại sau buổi học',
  'Hỗ trợ đến khi làm được',
];

const OFFER_PLANS = [
  { id: '1m', label: '1 tháng', hint: 'Làm quen' },
  { id: '3m', label: '3 tháng', hint: 'Nền tảng vững', featured: true },
  { id: '6m', label: '6 tháng', hint: 'Học chắc' },
  { id: '12m', label: '1 năm', hint: 'Tiết kiệm nhất' },
  { id: 'lifetime', label: 'Trọn khóa', hint: 'Học đến khi thành thạo' },
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
      setError('Gói này chưa mở thanh toán tự động. Hãy bấm "Nhận tư vấn" để đăng ký trực tiếp.');
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

  const handleConsultation = () => {
    const msg = `Chào Thầy Thắng, em muốn nhận tư vấn về gói học Tin học văn phòng Google Meet (${selected.label}).`;
    openAdminZalo(msg);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9700] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-5xl max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[32px] border-2 border-emerald-200/90 bg-gradient-to-b from-[#f2fcf6] via-[#f8fdfa] to-[#ffffff] shadow-[0_25px_60px_-15px_rgba(5,150,105,0.25)] p-4 sm:p-7 text-slate-900 transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-meet-plan-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Nút Đóng góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-slate-200/90 bg-white/95 px-4 py-1.5 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-100 hover:scale-105 active:scale-95"
        >
          Đóng
        </button>

        {/* LOGO DEWSKILL Ở ĐỈNH GIỮA */}
        <div className="flex justify-center mb-3 sm:mb-4">
          <img
            src="/brand/logo.webp"
            alt="DewSkill"
            className="h-8 sm:h-9 w-auto object-contain drop-shadow-xs"
            onError={(e) => {
              // fallback nếu chưa tải được logo
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {notice && !paid && !order ? (
          <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-center text-xs sm:text-sm font-bold text-amber-900 border border-amber-200/80 shadow-xs">
            {notice}
          </p>
        ) : null}

        {/* ===================== TRƯỜNG HỢP: ĐÃ THANH TOÁN THÀNH CÔNG ===================== */}
        {order && paid ? (
          <div className="px-4 py-10 text-center flex flex-col items-center">
            <div className="relative mx-auto h-40 w-40">
              <span className="dp-pay-ring absolute inset-0 rounded-full bg-emerald-400/30" />
              <span className="dp-pay-ring dp-pay-ring-delay absolute inset-3 rounded-full bg-emerald-400/25" />
              <span className="dp-pay-circle absolute inset-4 overflow-hidden rounded-full bg-emerald-950 shadow-xl ring-4 ring-emerald-500">
                <img
                  src="/mascot/thanh-toan-thanh-cong.gif"
                  alt="Thanh toán thành công"
                  className="dp-pay-mascot h-full w-full object-cover"
                  draggable={false}
                />
              </span>
              <span className="dp-pay-circle absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white shadow-md">
                <Check size={24} strokeWidth={4} className="text-white" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-black text-emerald-800">Bạn đã thanh toán thành công!</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700 max-w-md">
              Gói <strong>{order.planLabel || selected.label}</strong> đã được kích hoạt thành công. Bạn có thể tham gia các buổi học Google Meet trực tiếp với giảng viên.
            </p>
          </div>
        ) : order ? (
          /* ===================== TRƯỜNG HỢP: ĐANG THANH TOÁN (VIETQR) ===================== */
          <div className="space-y-4 py-2 px-2 sm:px-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setOrder(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                <ChevronLeft size={16} /> Quay lại chọn gói
              </button>
              <span className="text-sm font-black text-emerald-800">
                Đăng ký: Gói {order.planLabel || selected.label}
              </span>
            </div>

            <p className="text-sm font-semibold text-slate-700 text-center">
              Quét mã QR chuyển khoản đúng nội dung <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{order.ref}</span> để hệ thống tự động kích hoạt.
            </p>

            <TransferPaymentDetails
              courseName={`Gói Meet ${order.planLabel || selected.label}`}
              amount={order.amount}
              qrUrl={qrUrl}
              loading={!bank}
              error={!bank ? 'Chưa cấu hình tài khoản nhận tiền.' : ''}
            />

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
              <Loader2 size={16} className="animate-spin text-emerald-600" />
              <span>Hệ thống đang tự động kiểm tra giao dịch...</span>
            </div>

            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={markPaid}
                disabled={simulating}
                className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/80 py-2.5 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-60 transition"
              >
                {simulating ? 'Đang kích hoạt thử...' : '⚡ Test thử thanh toán thành công (Chỉ DEV)'}
              </button>
            )}
            {error && <p className="text-center text-sm font-semibold text-red-600">{error}</p>}
          </div>
        ) : (
          /* ===================== GIAO DIỆN CHÍNH (THEO ĐÚNG HÌNH 1) ===================== */
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* KHỐI TRÊN: 3 CỘT (GIẢNG VIÊN - HERO TIÊU ĐỀ - QUYỀN LỢI) */}
            <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_260px] items-center gap-4 sm:gap-6">
              {/* CỘT 1: THÔNG TIN GIẢNG VIÊN */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  {/* Doodles tia sáng xanh xung quanh avatar */}
                  <span className="absolute -top-2 left-0 text-emerald-500 font-black text-base select-none leading-none animate-pulse">
                    \ | /
                  </span>
                  <span className="absolute -top-2 right-0 text-emerald-500 font-black text-base select-none leading-none animate-pulse">
                    \ | /
                  </span>

                  {/* Ảnh đại diện thầy Thắng có quầng sáng ngọc */}
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full p-1.5 bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-300 shadow-xl shadow-emerald-900/10">
                    <img
                      src="/giang-vien-phi-van-thang.png"
                      alt="Giảng viên Phí Văn Thắng"
                      className="h-full w-full rounded-full border-2 border-white object-cover object-top"
                    />
                  </div>
                </div>

                {/* Badge tên Giảng viên */}
                <div className="mt-3 w-full max-w-[190px] rounded-2xl bg-white px-3 py-1.5 text-center shadow-md shadow-slate-900/5 border border-emerald-100">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    GIẢNG VIÊN
                  </span>
                  <span className="block text-sm sm:text-base font-black tracking-tight text-slate-900">
                    Phí Văn Thắng
                  </span>
                </div>

                {/* Giới thiệu ngắn */}
                <p className="mt-2 text-center text-[11px] font-medium leading-relaxed text-slate-600 max-w-[190px]">
                  Giảng viên tin học văn phòng – đồng hành cùng người mới bắt đầu.
                </p>
              </div>

              {/* CỘT 2: TIÊU ĐỀ, CHƯƠNG TRÌNH & LINH VẬT CỬ NHÂN */}
              <div className="flex flex-col items-center text-center px-1">
                {/* Tiêu đề chính kèm logo Google Meet */}
                <h2
                  id="free-meet-plan-title"
                  className="text-lg sm:text-2xl lg:text-[1.65rem] font-black tracking-tight text-slate-900 leading-snug sm:leading-tight"
                >
                  <span>HỌC TIN HỌC CÙNG GIẢNG VIÊN QUA</span>{' '}
                  <span className="inline-flex items-center gap-1.5 align-middle rounded-full bg-white px-3 py-1 shadow-sm border border-slate-200 text-xs sm:text-sm font-black text-slate-800">
                    <img
                      src={MEET_LOGO}
                      alt="Google Meet"
                      className="h-4 sm:h-5 w-auto object-contain"
                      draggable={false}
                    />
                    <span>Google Meet</span>
                  </span>
                </h2>

                {/* Pill giới thiệu phương pháp */}
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-3.5 py-1 text-xs font-extrabold text-emerald-800 shadow-2xs">
                  <span>Học trực tiếp – dễ hiểu – được hướng dẫn từng bước</span>
                </div>

                {/* Đoạn mô tả phù hợp đối tượng */}
                <p className="mt-2 text-xs sm:text-[13px] font-medium leading-relaxed text-slate-600 max-w-md">
                  Phù hợp cho người mới bắt đầu, người mất gốc, người cần học Word – Excel – PowerPoint bài bản.
                </p>

                {/* Bộ 3 icon Office W, X, P + Linh vật giọt nước cử nhân đọc sách */}
                <div className="mt-3 flex items-center justify-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {/* Word */}
                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white font-black text-sm shadow-md shadow-blue-500/25">
                      W
                    </span>
                    {/* Excel */}
                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-500/25">
                      X
                    </span>
                    {/* PowerPoint */}
                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-600 to-red-600 text-white font-black text-sm shadow-md shadow-orange-500/25">
                      P
                    </span>
                  </div>

                  {/* Linh vật giọt nước đội mũ cử nhân học bài */}
                  <img
                    src="/mascot/cam-xuc-hoc-bai.gif"
                    alt="Linh vật học bài"
                    className="h-14 w-14 sm:h-16 sm:w-16 object-contain -my-2 drop-shadow-md"
                    draggable={false}
                  />
                </div>
              </div>

              {/* CỘT 3: THẺ QUYỀN LỢI NỔI BẬT */}
              <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-4 sm:p-5 shadow-lg shadow-emerald-900/15 border border-emerald-400/30">
                <div className="flex items-center gap-2 border-b border-emerald-500/50 pb-2.5 mb-3">
                  <Crown size={20} className="text-amber-300 drop-shadow-xs" />
                  <span className="text-sm font-black uppercase tracking-wider text-white">QUYỀN LỢI</span>
                </div>

                <ul className="space-y-2.5">
                  {BENEFITS.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-left text-xs sm:text-[13px] font-bold text-white">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 font-black shadow-xs">
                        <Check size={13} strokeWidth={3.5} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* KHỐI GIỮA: 3 KHUNG GIỜ HỌC */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {MEET_SLOTS.map((slot) => (
                <div
                  key={slot.label}
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-2xl border border-emerald-200/80 bg-white/90 px-2 py-2 sm:px-4 sm:py-2.5 shadow-sm text-center"
                >
                  <span className="text-base sm:text-lg">{slot.icon}</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    {slot.label} <span className="font-extrabold text-emerald-700">{slot.time}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* KHỐI GÓI HỌC: 5 THẺ (RESPONSIVE VUỐT NGANG TRÊN MOBILE / 5 CỘT DESKTOP) */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-3 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 sm:pt-0 lg:grid-cols-5">
              {plans.map((plan) => {
                const isSelected = plan.id === selected.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedId(plan.id)}
                    className={`group relative flex min-w-[138px] shrink-0 snap-start flex-col justify-between rounded-2xl border-2 p-3 sm:p-3.5 text-center transition-all duration-200 sm:min-w-0 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-lg shadow-emerald-500/15 ring-2 ring-emerald-400/30 -translate-y-0.5'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
                    }`}
                  >
                    {/* Huy hiệu ⭐ Nên chọn cho gói 3 tháng */}
                    {plan.featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-0.5 text-[10px] font-black text-amber-950 shadow-sm">
                        ⭐ Nên chọn
                      </span>
                    )}

                    <div className="flex flex-col items-center gap-1.5">
                      {/* Học qua Google Meet */}
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <img src={MEET_LOGO} alt="" className="h-3 w-auto object-contain" draggable={false} />
                        <span>Học qua Meet</span>
                      </div>

                      {/* Tên thời gian gói có icon lịch */}
                      <div className="mt-1 flex items-center justify-center gap-1 text-base font-black tracking-tight text-slate-900">
                        <span className="text-sm">📅</span>
                        <span>{plan.label}</span>
                      </div>

                      {/* Hint pill (Làm quen, Nền tảng vững...) */}
                      <span
                        className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold transition-colors ${
                          isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {plan.hint}
                      </span>
                    </div>

                    {/* Footer của card: Đăng ký học cùng giảng viên & giá */}
                    <div className="mt-3 pt-2 border-t border-slate-100/90 flex flex-col items-center gap-0.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 leading-tight">
                        <span>👥</span>
                        <span>Đăng ký học cùng giảng viên</span>
                      </div>
                      {plan.price > 0 && (
                        <span className="text-xs font-black text-emerald-700">
                          {plan.price.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <p className="text-center text-sm font-semibold text-red-600">{error}</p>}

            {/* KHỐI NÚT HÀNH ĐỘNG DƯỚI CÙNG (2 NÚT) */}
            <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Nút Đăng ký học ngay */}
              <button
                type="button"
                onClick={register}
                disabled={busy}
                className="relative inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-black text-white transition-all duration-200 active:scale-95 shadow-lg shadow-emerald-500/30 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 hover:brightness-105 hover:-translate-y-0.5 w-full sm:w-auto cursor-pointer"
              >
                {busy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>🎓 Đăng ký học ngay</span>
                    {selected.price > 0 && (
                      <span className="text-xs font-bold text-emerald-100">
                        ({selected.price.toLocaleString('vi-VN')}đ)
                      </span>
                    )}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Nút Nhận tư vấn */}
              <button
                type="button"
                onClick={handleConsultation}
                className="relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-black text-emerald-800 transition-all duration-200 active:scale-95 border-2 border-emerald-400 bg-white hover:bg-emerald-50 shadow-sm hover:-translate-y-0.5 w-full sm:w-auto cursor-pointer"
              >
                <Headphones size={18} className="text-emerald-600" />
                <span>Nhận tư vấn</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
