import { Calendar, Clock, CreditCard, Sparkles, Tag, Video } from 'lucide-react';
import { formatCourseExpiryDate, getCourseTimeRemaining } from '../../utils/courseAccessTime';

export function isPurchaseNotification(notif) {
  const kind = String(notif?.payload?.kind || '').trim();
  return kind === 'dewskill_course_paid' || kind === 'ai_package_paid';
}

export function isLongNotificationText(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return raw.length > 105 || raw.split(/\r?\n/).length > 2;
}

function formatPurchaseTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const timePart = d.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${timePart} · ${formatCourseExpiryDate(d)}`;
}

export function PurchaseNotificationReceipt({ notif, compact = false }) {
  const p = notif?.payload || {};
  const isAi = p.purchaseType === 'ai_package' || p.kind === 'ai_package_paid';
  const itemName = p.itemName || notif?.title || (isAi ? 'Gói hỗ trợ AI' : 'Khóa học DewSkill');
  const purchasedText = p.purchasedAtText || formatPurchaseTime(p.purchasedAt || notif?.time || notif?.createdAt);
  const amountNum = Number(p.amount || 0);
  const amountText = p.amountText || (amountNum > 0 ? `${amountNum.toLocaleString('vi-VN')}đ` : (p.paymentMethodLabel || 'Đã kích hoạt'));
  const expiresAt = p.expiresAt || null;
  const timeLeft = getCourseTimeRemaining(expiresAt);
  const durationText = p.durationText || (isAi ? 'Gói AI Unlimited' : '12 tháng');
  const expiryText = p.expiresAtText || (expiresAt ? formatCourseExpiryDate(expiresAt) : '');
  const refOrCode = p.activationCode ? `Mã: ${p.activationCode}` : (p.paymentRef ? `CK: ${p.paymentRef}` : '');

  return (
    <div
      className={`rounded-2xl border p-3.5 text-left space-y-2.5 ${
        isAi
          ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/85 to-white'
          : 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/85 to-sky-50/45'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold ${
            isAi
              ? 'border-amber-200 bg-amber-100/80 text-amber-900'
              : 'border-emerald-200 bg-emerald-100/80 text-emerald-800'
          }`}
        >
          {isAi ? <Sparkles size={11} /> : <Tag size={11} />}
          <span>{isAi ? 'Gói hỗ trợ AI' : 'Khóa học DewSkill'}</span>
        </span>
        {expiresAt ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
              timeLeft.isExpired
                ? 'bg-rose-100 text-rose-700'
                : 'bg-white text-emerald-700 border border-emerald-200'
            }`}
          >
            {timeLeft.shortNote}
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500 shrink-0">Đã mua:</span>
          <span className="font-extrabold text-slate-900 text-right">{itemName}</span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-slate-500 shrink-0">
            <Clock size={12} /> Thời gian mua:
          </span>
          <span className="font-bold text-slate-800 text-right tabular-nums">{purchasedText || '-'}</span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-slate-500 shrink-0">
            <CreditCard size={12} /> Số tiền:
          </span>
          <span className="font-extrabold text-emerald-700 text-right tabular-nums">{amountText}</span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-slate-500 shrink-0">
            <Calendar size={12} /> Hạn sử dụng:
          </span>
          <span className="font-bold text-slate-800 text-right">
            {durationText}
            {expiryText ? ` · Hết hạn ${expiryText}` : ''}
          </span>
        </div>

        {!compact && refOrCode ? (
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Tham chiếu:</span>
            <span className="font-mono text-[11px] font-bold text-slate-700 text-right">{refOrCode}</span>
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div className="rounded-xl border border-white/90 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-600 leading-relaxed">
          {!isAi && p.includesMeet !== false ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 mr-1">
              <Video size={12} /> Có học Meet cùng giảng viên.
            </span>
          ) : null}
          <span>{p.benefitNote || (isAi ? 'Hỏi AI không giới hạn trên Web & Mobile.' : 'Khi hết hạn, khóa học sẽ bị khóa & đặt lại về ban đầu.')}</span>
        </div>
      ) : null}
    </div>
  );
}
