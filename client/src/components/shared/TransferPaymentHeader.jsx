import { CreditCard, X } from 'lucide-react';

export default function TransferPaymentHeader({
  title,
  subtitle = 'VietQR · Tự động xác nhận',
  onClose,
  children,
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 bg-gradient-to-r from-rose-600 via-fuchsia-700 to-indigo-600 px-3 py-2.5 text-white">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <CreditCard size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black leading-tight tracking-tight">{title}</h3>
        <p className="truncate text-[10px] font-semibold text-white/85">{subtitle}</p>
      </div>
      {children}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15 transition hover:bg-white/25"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
