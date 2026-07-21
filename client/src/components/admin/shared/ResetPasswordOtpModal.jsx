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
    ? `[THẮNG TIN HỌC] Mã OTP đặt lại mật khẩu: ${otpResult.otp}\n⏱ Hiệu lực 2 phút.\nVào: dashboard.giasutinhoc24h.com → Quên mật khẩu → Nhập OTP.`
    : '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4" onClick={close}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><KeyRound size={20} /></div>
            <div>
              <p className="font-black text-base">Cấp lại mật khẩu</p>
              <p className="text-white/80 text-xs">{modal.role === 'teacher' ? 'Giảng viên' : 'Học viên'}: <strong>{modal.name}</strong></p>
            </div>
          </div>
          <button type="button" onClick={close} className="hover:bg-white/20 rounded-lg p-1 transition"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {!otpResult ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-bold">Đang sinh mã OTP...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full font-black text-lg mx-auto w-fit ${
                otpCountdown > 30 ? 'bg-emerald-50 text-emerald-600'
                  : otpCountdown > 0 ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-500'
              }`}>
                <Clock size={18} />
                {otpCountdown > 0
                  ? `${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, '0')}`
                  : 'Hết hạn'}
              </div>
              <div className="bg-gray-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Mã OTP</p>
                <p className="text-5xl font-black text-amber-600 tracking-[0.3em] font-mono">{otpResult.otp}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                <p className="font-bold text-blue-700 text-xs mb-1">Nội dung gửi cho {otpResult.name}:</p>
                <p className="font-mono text-xs bg-white rounded-lg p-2 border border-blue-200 whitespace-pre-wrap">{otpMessage}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(otpMessage);
                    toast.success('Đã copy nội dung tin nhắn!');
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
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
                  className="flex-[2] py-3 bg-[#0068ff] hover:bg-[#0055d4] text-white font-bold rounded-xl transition shadow-lg"
                >
                  Gửi Zalo
                </button>
              </div>
              {otpCountdown === 0 && (
                <button
                  type="button"
                  disabled={resetPwLoading}
                  onClick={generateOtp}
                  className="w-full py-2.5 border-2 border-amber-400 text-amber-600 font-bold rounded-xl hover:bg-amber-50 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={15} /> Sinh lại OTP mới
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
