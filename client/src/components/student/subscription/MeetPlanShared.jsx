import { Check, Crown, GraduationCap, KeyRound, Loader2, Ticket, X } from 'lucide-react';
import { formatActivationCodeInput, formatVnd } from '../../../utils/subscription';
import { MEET_SLOTS, PLAN_META, formatCycleText } from './meetPlanConstants';

/** Logo Google Meet SVG sắc nét, không phụ thuộc ảnh tĩnh ngoài /uploads. */
export function GoogleMeetIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 7.5H6C4.89543 7.5 4 8.39543 4 9.5V14.5C4 15.6046 4.89543 16.5 6 16.5H14.5C15.6046 16.5 16.5 15.6046 16.5 14.5V9.5C16.5 8.39543 15.6046 7.5 14.5 7.5Z" fill="#00832D" />
      <path d="M4 9.5C4 8.39543 4.89543 7.5 6 7.5H10.5V12H4V9.5Z" fill="#0066DA" />
      <path d="M4 12H10.5V16.5H6C4.89543 16.5 4 15.6046 4 14.5V12Z" fill="#EA4335" />
      <path d="M10.5 7.5H14.5C15.6046 7.5 16.5 8.39543 16.5 9.5V12H10.5V7.5Z" fill="#FFBA00" />
      <path d="M16.5 10.2L20.1 7.65C20.59 7.3 21.25 7.65 21.25 8.25V15.75C21.25 16.35 20.59 16.7 20.1 16.35L16.5 13.8V10.2Z" fill="#00AC47" />
    </svg>
  );
}

/** Header thống nhất cho cả Popup Đăng ký học Meet & Popup Gia hạn gói Meet. */
export function MeetModalHeader({
  title,
  subtitle,
  badge = null,
  isCourseStudent = false,
  onClose,
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-emerald-50/75 via-emerald-50/25 to-white px-5 py-3.5 sm:px-6 sm:py-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-2xs ring-1 ring-emerald-200/80">
          {isCourseStudent
            ? <GraduationCap size={20} className="text-emerald-600" aria-hidden="true" />
            : <GoogleMeetIcon size={22} />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] sm:text-lg font-extrabold tracking-tight text-slate-900 leading-snug">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-medium text-slate-500 leading-snug">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          title="Đóng"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 cursor-pointer !shadow-none"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** 3 khung giờ học cố định qua Meet, gọn mắt không dùng emoji. */
export function MeetScheduleStrip() {
  return (
    <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-slate-200/75">
      {MEET_SLOTS.map((slot) => {
        const Icon = slot.icon;
        return (
          <div
            key={slot.key}
            className="flex flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white px-2 py-1.5 text-center shadow-2xs"
          >
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500">
              <Icon size={12} className={slot.iconClass} aria-hidden="true" />
              <span>{slot.label}</span>
            </span>
            <span className="mt-0.5 text-[11px] sm:text-xs font-extrabold text-slate-800 tabular-nums whitespace-nowrap">
              {slot.time}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Thẻ Quyền lợi đồng bộ cho cả 2 popup. */
export function MeetBenefitsCard({ benefits, title = 'Quyền lợi gói Meet' }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50/55 p-3.5 sm:p-4">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Crown size={14} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
          {title}
        </span>
      </div>
      <ul className="space-y-2">
        {benefits.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs font-semibold text-slate-700 leading-snug">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check size={10} strokeWidth={3} aria-hidden="true" />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lưới 5 gói chọn dạng radio-card sạch sẽ, dùng chung giữa Popup 1 & Popup 2. */
export function MeetPlanGrid({
  plans,
  selectedId,
  onSelect,
  xpSummary,
  heading = 'Chọn gói học phù hợp',
}) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          {heading}
        </h3>
        <span className="text-[11px] font-medium text-slate-400">
          Chạm vào gói để chọn
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={heading}
        className="grid grid-cols-2 gap-2.5 pt-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {plans.map((plan, idx) => {
          const meta = PLAN_META[plan.id] || {};
          const selected = plan.id === selectedId;
          const price = Number(plan.price) || 0;
          const sellable = price > 0;
          const planXp = xpSummary?.getPlanXp ? xpSummary.getPlanXp(plan) : null;
          const cycleText = xpSummary?.cycleText || formatCycleText(plan.resetCycle);
          const spanLastOnMobile = plans.length % 2 === 1 && idx === plans.length - 1 ? 'col-span-2 sm:col-span-1' : '';
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(plan.id)}
              className={`group relative flex flex-col justify-between rounded-2xl border p-3 text-left transition-all duration-150 cursor-pointer !shadow-none ${spanLastOnMobile} ${
                selected
                  ? 'border-emerald-500 bg-emerald-50/45 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/50'
              }`}
            >
              {meta.featured && meta.badge ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-950 shadow-2xs">
                  {meta.badge}
                </span>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm sm:text-[15px] font-extrabold tracking-tight text-slate-900">
                    {plan.label || meta.fallbackLabel}
                  </span>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      selected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white group-hover:border-emerald-400'
                    }`}
                  >
                    {selected ? <Check size={10} strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                </div>

                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {meta.hint || plan.hint || 'Gói học Meet'}
                </p>

                {planXp != null ? (
                  <span
                    className={`mt-2 inline-flex items-center rounded-lg px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${
                      selected
                        ? 'bg-emerald-100/90 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    +{planXp} XP {cycleText}
                  </span>
                ) : (
                  <span className="mt-2 inline-block h-[22px] w-20 rounded-lg bg-slate-100 animate-pulse" />
                )}
              </div>

              <div className="mt-3 border-t border-slate-100 pt-2">
                <p className={`text-[15px] font-black tabular-nums ${
                  sellable
                    ? (selected ? 'text-emerald-700' : 'text-slate-900')
                    : 'text-xs font-bold text-slate-400'
                }`}>
                  {sellable ? formatVnd(price) : 'Chỉ dùng mã'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Hộp nhập mã kích hoạt gọn gàng, dùng chung ở chân modal. */
export function ActivationCodeSection({
  code,
  onChangeCode,
  onSubmit,
  redeeming,
  inputRef = null,
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-slate-50/75 p-3 sm:px-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-xs sm:text-[13px] font-extrabold text-slate-800">
            <Ticket size={15} className="text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Có mã kích hoạt?</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Nhập mã trung tâm cấp (TTH-XXXX-XXXX) để kích hoạt ngay.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2 sm:min-w-[310px]">
          <label className="relative flex-1">
            <KeyRound size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => onChangeCode(formatActivationCodeInput(e.target.value))}
              placeholder="TTH-XXXX-XXXX"
              aria-label="Mã kích hoạt"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-2.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            disabled={code.length < 13 || redeeming}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 cursor-pointer !shadow-none"
          >
            {redeeming ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : 'Kích hoạt'}
          </button>
        </form>
      </div>
    </section>
  );
}
