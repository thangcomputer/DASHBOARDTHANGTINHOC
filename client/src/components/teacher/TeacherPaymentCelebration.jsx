import React from 'react';
import { CheckCircle2, FileText, X } from 'lucide-react';

export default function TeacherPaymentCelebration({ payment, onClose, onViewDetail }) {
  if (!payment) return null;

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-emerald-950/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-payment-title"
      >
        <div className="teacher-payment-success relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-5 pb-5 pt-7 text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo thanh toán"
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 mx-auto h-28 w-28">
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                className="money-drop"
                style={{
                  left: `${50 + (index - 2) * 15}%`,
                  top: '-18%',
                  animationDelay: `${index * 0.12}s`,
                }}
              >
                ₫
              </span>
            ))}
            <div className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-emerald-200 bg-white shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={54} className="text-emerald-500" />
            </div>
          </div>

          <p className="relative z-10 mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            Bạn vừa nhận được thanh toán
          </p>
          <h2 id="teacher-payment-title" className="relative z-10 mt-2 text-3xl font-black text-slate-900">
            {Number(payment.amount || 0).toLocaleString('vi-VN')}đ
          </h2>
          <p className="relative z-10 mt-2 text-sm text-slate-600">
            Admin đã chuyển tiền hoa hồng cho bạn.
          </p>

          <div className="relative z-10 mt-5 grid grid-cols-2 gap-2 text-left text-xs">
            <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
              <p className="text-slate-500">Số buổi</p>
              <p className="mt-1 font-bold text-slate-800">{Number(payment.sessions || 0)} buổi</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white/80 p-3">
              <p className="text-slate-500">Thưởng sao</p>
              <p className="mt-1 font-bold text-amber-700">{Number(payment.starBonusAmount || 0).toLocaleString('vi-VN')}đ</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-white p-4">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline flex-1">
            Đóng
          </button>
          <button type="button" onClick={onViewDetail} className="cms-btn cms-btn-primary flex-1">
            <FileText size={16} /> Xem tài chính
          </button>
        </div>
      </div>
    </div>
  );
}
