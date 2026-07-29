import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Clock, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import api from '../../../services/api';

export default function ResetPasswordOtpModal({ modal, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState('password'); // password | otp
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpTimerRef = useRef(null);

  const [pwMode, setPwMode] = useState('auto');
  const [manualPassword, setManualPassword] = useState('');
  const [provisionResult, setProvisionResult] = useState(null);

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
        toast.success(res.data?.queued
          ? 'Đã tạo OTP và đưa vào hàng đợi gửi.'
          : 'Đã tạo OTP (không hiển thị mã trên màn hình).');
      } else {
        toast.error(res.message || 'Lỗi sinh OTP');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setResetPwLoading(false);
    }
  };

  const provisionPassword = async () => {
    if (!modal) return;
    if (pwMode === 'manual' && String(manualPassword).trim().length < 6) {
      toast.error('Mật khẩu nhập tay tối thiểu 6 ký tự');
      return;
    }
    setResetPwLoading(true);
    try {
      const res = await api.auth.adminResetPassword(
        modal.id,
        modal.role,
        pwMode === 'manual' ? manualPassword : undefined,
        pwMode
      );
      if (res.success) {
        setProvisionResult(res.data || {});
        toast.success(res.message || 'Đã cấp mật khẩu');
      } else {
        toast.error(res.message || 'Lỗi cấp mật khẩu');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setResetPwLoading(false);
    }
  };

  useEffect(() => {
    setOtpResult(null);
    setProvisionResult(null);
    setManualPassword('');
    setPwMode('auto');
    setTab('password');
    return () => clearInterval(otpTimerRef.current);
  }, [modal?.id, modal?.role]);

  const handleClose = () => {
    clearInterval(otpTimerRef.current);
    onClose?.();
  };

  const guideMessage = otpResult
    ? `[THẮNG TIN HỌC] Admin đã cấp OTP đặt lại mật khẩu cho bạn.\n⏱ Hiệu lực 2 phút.\nVào: dashboard.thangtinhoc.edu.vn → Quên mật khẩu → Nhập OTP nhận được qua Zalo/email.`
    : '';

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 min-w-0">
          <KeyRound size={18} className="text-amber-600 shrink-0" />
          Cấp mật khẩu — {modal?.name || ''}
        </h3>
        <button type="button" onClick={handleClose} className="shrink-0 inline-flex items-center justify-center min-w-11 min-h-11 rounded-2xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" aria-label="Đóng">
          <X size={18} />
        </button>
      </div>

      <div className="px-5 pt-3 flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab === 'password' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
          onClick={() => setTab('password')}
        >
          Cấp mật khẩu
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab === 'otp' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
          onClick={() => setTab('otp')}
        >
          OTP quên mật khẩu
        </button>
      </div>

      <div className="p-5 space-y-4">
        {tab === 'password' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border ${pwMode === 'auto' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200'}`}
                onClick={() => setPwMode('auto')}
              >
                Sinh tự động
              </button>
              <button
                type="button"
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border ${pwMode === 'manual' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200'}`}
                onClick={() => setPwMode('manual')}
              >
                Nhập tay
              </button>
            </div>

            {pwMode === 'manual' && (
              <input
                type="text"
                className="cms-input w-full"
                placeholder="Mật khẩu mới (≥ 6 ký tự)"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}

            <p className="text-xs text-gray-500">
              Sau khi cấp: gửi Zalo + Email (nếu có) + thông báo in-app, ghi audit & lịch sử (không lưu mật khẩu plaintext).
            </p>

            <button
              type="button"
              disabled={resetPwLoading}
              onClick={provisionPassword}
              className="cms-btn cms-btn-primary w-full"
            >
              {resetPwLoading ? 'Đang cấp…' : 'Cấp mật khẩu ngay'}
            </button>

            {provisionResult && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
                <p className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                  <CheckCircle2 size={16} /> Đã cấp ({provisionResult.mode === 'auto' ? 'tự động' : 'nhập tay'})
                </p>
                {provisionResult.temporaryPassword && (
                  <p className="text-sm font-mono bg-white border rounded-lg px-3 py-2">
                    Mật khẩu tạm (chỉ hiện 1 lần): <strong>{provisionResult.temporaryPassword}</strong>
                  </p>
                )}
                <p className="text-xs text-gray-600">
                  Queue: {provisionResult.queued ? `đã xếp (${provisionResult.queueMode || 'ok'})` : 'chưa gửi được kênh tự động'}
                  {provisionResult.phone ? ` · Zalo/SĐT ${provisionResult.phone}` : ''}
                  {provisionResult.email ? ` · Email ${provisionResult.email}` : ''}
                </p>
                {provisionResult.temporaryPassword && (
                  <button
                    type="button"
                    className="cms-btn cms-btn-outline w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(provisionResult.temporaryPassword);
                      toast.success('Đã copy mật khẩu tạm');
                    }}
                  >
                    Copy mật khẩu tạm
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'otp' && (
          <div className="space-y-3">
            {!otpResult && (
              <button
                type="button"
                disabled={resetPwLoading}
                onClick={generateOtp}
                className="cms-btn cms-btn-primary w-full"
              >
                {resetPwLoading ? 'Đang tạo OTP…' : 'Sinh OTP và gửi'}
              </button>
            )}

            {otpResult && (
              <>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                  otpCountdown > 30 ? 'bg-emerald-50 text-emerald-600'
                    : otpCountdown > 0 ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                }`}>
                  <Clock size={14} />
                  {otpCountdown > 0
                    ? `${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, '0')}`
                    : 'Hết hạn'}
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
                  <p className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 size={16} /> OTP đã tạo — không hiển thị mã trên UI
                  </p>
                  <p className="text-sm text-gray-700">
                    Người nhận: <strong>{otpResult.name}</strong>
                    {' · '}
                    Zalo/SĐT: <strong>{otpResult.zalo || otpResult.phone}</strong>
                  </p>
                </div>

                <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                  <p className="font-semibold text-sky-700 text-[12px] mb-1">Gợi ý nhắn HV/GV:</p>
                  <p className="font-mono text-[12px] bg-white rounded-lg p-2 border border-sky-100 whitespace-pre-wrap">{guideMessage}</p>
                </div>

                <button
                  type="button"
                  className="cms-btn cms-btn-outline w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(guideMessage);
                    toast.success('Đã copy hướng dẫn (không gồm mã OTP)');
                  }}
                >
                  Copy hướng dẫn
                </button>
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
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
