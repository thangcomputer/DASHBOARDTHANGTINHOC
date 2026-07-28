import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Clock, RefreshCw, X } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import api from '../../../services/api';

export default function ResetPasswordOtpModal({ modal, onClose }) {
  const toast = useToast();
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpTimerRef = useRef(null);

  const startCountdown = () => {
    setOtpCountdown(120);
    clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(otpTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const generateOtp = async () => {
    if (!modal) return;
    setResetPwLoading(true);
    try {
      const res = await api.auth.adminGenerateOTP(modal.id, modal.role);
      if (res.success) {
        setOtpResult(res.data);
        startCountdown();
        toast.success('Đã sinh OTP thành công!');
      } else {
        toast.error(res.message || 'Lỗi sinh OTP');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setResetPwLoading(false);
    }
  };

  useEffect(() => {
    generateOtp();
    return () => clearInterval(otpTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.id, modal?.role]);

  if (!modal) return null;

  const close = () => {
    clearInterval(otpTimerRef.current);
    onClose();
  };

  const otpMessage = otpResult
    ? `[THẮNG TIN HỌC] Mã OTP đặt lại mật khẩu: ${otpResult.otp}\n⏱ Hiệu lực 2 phút.\nVào: dashboard.thangtinhoc.edu.vn → Quên mật khẩu → Nhập OTP.`
    : '';

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cấp lại mật khẩu"
        className="cms-sheet w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-amber-50 text-amber-600" aria-hidden="true">
            <KeyRound size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="cms-sheet-header__title">Cấp lại mật khẩu</h3>
            <p className="text-center text-[11px] text-slate-500 truncate mt-0.5">
              {modal.role === 'teacher' ? 'Giảng viên' : 'Học viên'}: <strong>{modal.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-body space-y-4">
          {!otpResult ? (
            <div className="cms-empty py-8">
              <div className="w-10 h-10 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              <p className="cms-empty__desc">Đang sinh mã OTP...</p>
            </div>
          ) : (
            <>
              <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full font-bold text-lg mx-auto w-fit ${
                otpCountdown > 30 ? 'bg-emerald-50 text-emerald-600'
                  : otpCountdown > 0 ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-500'
              }`}>
                <Clock size={18} />
                {otpCountdown > 0
                  ? `${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, '0')}`
                  : 'Hết hạn'}
              </div>
              <div className="rounded-2xl border border-dashed border-amber-300 bg-slate-50 p-4 text-center">
                <p className="cms-label mb-1">Mã OTP</p>
                <p className="text-5xl font-bold text-amber-600 tracking-[0.3em] font-mono">{otpResult.otp}</p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-slate-700 leading-relaxed">
                <p className="font-semibold text-sky-700 text-[12px] mb-1">Nội dung gửi cho {otpResult.name}:</p>
                <p className="font-mono text-[12px] bg-white rounded-lg p-2 border border-sky-100 whitespace-pre-wrap">{otpMessage}</p>
              </div>
            </>
          )}
        </div>

        {otpResult && (
          <div className="cms-sheet-footer" style={{ flexDirection: 'column' }}>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(otpMessage);
                  toast.success('Đã copy nội dung tin nhắn!');
                }}
                className="cms-btn cms-btn-outline"
              >
                Copy tin
              </button>
              <button
                type="button"
                onClick={() => {
                  const phone = (otpResult.zalo || otpResult.phone || '').replace(/[^0-9]/g, '');
                  window.open(`https://zalo.me/${phone}`, '_blank');
                  navigator.clipboard.writeText(otpMessage);
                  toast.success('Mở Zalo! Nội dung đã được copy sẵn.');
                }}
                className="cms-btn cms-btn-primary"
                style={{ background: '#0068ff', boxShadow: '0 4px 12px rgba(0,104,255,0.28)' }}
              >
                Gửi Zalo
              </button>
            </div>
            {otpCountdown === 0 && (
              <button
                type="button"
                disabled={resetPwLoading}
                onClick={generateOtp}
                className="cms-btn cms-btn-outline w-full"
              >
                <RefreshCw size={15} /> Sinh lại OTP mới
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
