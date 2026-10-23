import { GraduationCap, Loader2 } from 'lucide-react';

export default function TransferPaymentDetails({
  courseName,
  amount,
  qrUrl,
  loading = false,
  error = '',
}) {
  return (
    <section className="space-y-2.5">
      {(courseName || amount != null) && (
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Khóa học</p>
          <p className="truncate pr-12 text-sm font-black uppercase leading-5 text-slate-800">
            {courseName || 'Thanh toán'}
          </p>
          <div className="mt-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Số tiền thanh toán</p>
            {amount != null && (
              <p className="text-2xl font-black leading-7 text-red-600 tabular-nums">
                {Number(amount || 0).toLocaleString('vi-VN')}đ
              </p>
            )}
          </div>
          <div className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <GraduationCap size={22} strokeWidth={2.5} />
          </div>
        </div>
      )}

      <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
        <div className="flex h-48 w-48 items-center justify-center rounded-sm border border-blue-300 bg-white p-0.5">
          {loading ? (
            <div className="text-center text-xs text-slate-500">
              <Loader2 size={22} className="mx-auto animate-spin text-blue-500" />
              <p className="mt-2">Đang tải mã QR...</p>
            </div>
          ) : qrUrl ? (
            <img src={qrUrl} alt="Mã QR VietQR thanh toán" className="aspect-square w-full object-contain" />
          ) : (
            <p className="px-2 text-center text-xs text-amber-700">
              {error || 'Chưa có thông tin tài khoản nhận thanh toán.'}
            </p>
          )}
        </div>

      </div>
    </section>
  );
}
