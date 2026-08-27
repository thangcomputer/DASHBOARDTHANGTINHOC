import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Clock, RefreshCw, X, CheckCircle2, Eye, EyeOff, Copy, Shuffle } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import api from '../../../services/api';

function genTempPassword(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

export default function ResetPasswordOtpModal({ modal, onClose }) {
  const toast = useToast();
  const isTeacher = modal?.role === 'teacher';
  const [mode, setMode] = useState('manual');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualDone, setManualDone] = useState(null);

  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpTimerRef = useRef(null);
  const otpAutoStarted = useRef(false);

  useEffect(() => {
    setMode('manual');
    setPassword('');
    setConfirm('');
    setShowPw(false);
    setManualDone(null);
    setOtpResult(null);
    setOtpCountdown(0);
    otpAutoStarted.current = false;
    clearInterval(otpTimerRef.current);
  }, [modal?.id, modal?.role]);

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

  useEffect(() => {
    if (mode !== 'otp' || !modal?.id || otpAutoStarted.current) return;
    otpAutoStarted.current = true;
    generateOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, modal?.id]);

  useEffect(() => () => clearInterval(otpTimerRef.current), []);

  const handleClose = () => {
    clearInterval(otpTimerRef.current);
    onClose?.();
  };

  const fillRandom = () => {
    const pw = genTempPassword(8);
    setPassword(pw);
    setConfirm(pw);
    setShowPw(true);
  };

  const handleManualSave = async () => {
    if (!modal) return;
    const pw = String(password || '').trim();
    if (pw.length < 6) {
      toast.error('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if (pw !== String(confirm || '').trim()) {
      toast.error('Xác nhận mật khẩu không khớp');
      return;
    }
    setManualLoading(true);
    try {
      const res = await api.auth.adminResetPassword(modal.id, modal.role, pw);
      if (res.success) {
        setManualDone({ name: res.data?.name || modal.name, password: pw });
        toast.success(res.message || 'Đã cấp mật khẩu mới');
      } else {
        toast.error(res.message || 'Cấp mật khẩu thất bại');
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi kết nối server');
    } finally {
      setManualLoading(false);
    }
  };

  const guideMessage = otpResult
    ? `[THẮNG TIN HỌC] Admin đã cấp OTP đặt lại mật khẩu cho bạn.\n⏱ Hiệu lực 2 phút.\nVào: dashboard.thangtinhoc.edu.vn › Quên mật khẩu › Nhập OTP nhận được qua Zalo/email.`
    : '';

  const roleLabel = isTeacher ? 'giảng viên' : 'học viên';

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cấp mật khẩu"
        className="cms-sheet cms-sheet--compact w-full md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-amber-50 text-amber-600" aria-hidden="true">
            <KeyRound size={18} />
          </span>
          <div className="min-w-0 px-1 text-center">
            <h3 className="cms-sheet-header__title">Cấp mật khẩu</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{modal?.name} · {roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            onClick={() => setMode('manual')}
            className={`cms-sheet-tab ${mode === 'manual' ? 'is-active' : ''}`}
          >
            Thủ công
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'otp'}
            onClick={() => setMode('otp')}
            className={`cms-sheet-tab ${mode === 'otp' ? 'is-active' : ''}`}
          >
            OTP Zalo/Email
          </button>
        </div>

        <div className="cms-sheet-body space-y-4">
          {mode === 'manual' && (
            <>
              {manualDone ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 space-y-2">
                    <p className="flex items-center gap-2 font-semibold text-emerald-800 text-sm">
                      <CheckCircle2 size={16} /> Đã cấp mật khẩu cho {manualDone.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      Lần đăng nhập sau sẽ yêu cầu đổi mật khẩu (đăng nhập lần đầu).
                    </p>
                    <div className="rounded-lg bg-white border border-emerald-100 px-3 py-2.5">
                      <p className="text-xs text-slate-500 mb-1">Mật khẩu mới</p>
                      <p className="font-mono text-base font-bold text-slate-900 tracking-wide break-all">
                        {manualDone.password}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cms-btn cms-btn-outline w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(manualDone.password);
                      toast.success('Đã copy mật khẩu');
                    }}
                  >
                    <Copy size={15} /> Copy mật khẩu
                  </button>
                  <button
                    type="button"
                    className="cms-btn cms-btn-outline w-full"
                    onClick={() => {
                      setManualDone(null);
                      setPassword('');
                      setConfirm('');
                    }}
                  >
                    Cấp mật khẩu khác
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nhập mật khẩu mới và gửi trực tiếp cho {roleLabel}. Tối thiểu 6 ký tự.
                  </p>
                  <div>
                    <label className="cms-label">Mật khẩu mới</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="cms-input font-mono pr-11"
                        placeholder="Tối thiểu 6 ký tự"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700"
                        aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="cms-label">Xác nhận mật khẩu</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="cms-input font-mono"
                      placeholder="Nhập lại mật khẩu"
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fillRandom}
                    className="cms-btn cms-btn-outline w-full"
                  >
                    <Shuffle size={15} /> Tạo mật khẩu ngẫu nhiên
                  </button>
                </div>
              )}
            </>
          )}

          {mode === 'otp' && (
            <>
              {resetPwLoading && !otpResult ? (
                <p className="text-sm text-slate-500 text-center py-8">Đang tạo OTP…</p>
              ) : (
                <div className="space-y-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                    otpCountdown > 30 ? 'bg-emerald-50 text-emerald-600'
                      : otpCountdown > 0 ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-600'
                  }`}
                  >
                    <Clock size={14} />
                    {otpCountdown > 0
                      ? `${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, '0')}`
                      : 'Hết hạn / chưa tạo'}
                  </div>

                  {otpResult && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 space-y-2">
                      <p className="flex items-center gap-2 font-semibold text-emerald-800 text-sm">
                        <CheckCircle2 size={16} /> OTP đã tạo — không hiện mã trên màn hình
                      </p>
                      <p className="text-xs text-slate-700">
                        Người nhận: <strong>{otpResult.name}</strong>
                        {' · '}
                        Zalo/SĐT: <strong>{otpResult.zalo || otpResult.phone}</strong>
                      </p>
                      <p className="text-xs text-slate-500">
                        {otpResult.message
                          || (otpResult.queued
                            ? 'Đã xếp hàng gửi OTP qua Zalo/email.'
                            : 'Nếu kênh tự động lỗi, kiểm tra queue OTP hoặc gửi lại.')}
                      </p>
                    </div>
                  )}

                  {otpResult && (
                    <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                      <p className="font-semibold text-sky-800 text-xs mb-1">Gợi ý nhắn {isTeacher ? 'GV' : 'HV'}:</p>
                      <p className="font-mono text-xs bg-white rounded-lg p-2 border border-sky-100 whitespace-pre-wrap">
                        {guideMessage}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {otpResult && (
                      <button
                        type="button"
                        className="cms-btn cms-btn-outline w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(guideMessage);
                          toast.success('Đã copy hướng dẫn (không gồm mã OTP)');
                        }}
                      >
                        <Copy size={15} /> Copy hướng dẫn
                      </button>
                    )}
                    {(otpCountdown === 0 || !otpResult) && (
                      <button
                        type="button"
                        disabled={resetPwLoading}
                        onClick={generateOtp}
                        className="cms-btn cms-btn-outline w-full"
                      >
                        <RefreshCw size={15} /> {otpResult ? 'Sinh lại OTP mới' : 'Tạo OTP'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="cms-sheet-footer">
          <button type="button" onClick={handleClose} className="cms-btn cms-btn-outline">
            {manualDone ? 'Đóng' : 'Huỷ'}
          </button>
          {mode === 'manual' && !manualDone && (
            <button
              type="button"
              onClick={handleManualSave}
              disabled={manualLoading}
              className="cms-btn cms-btn-primary"
            >
              <KeyRound size={16} /> {manualLoading ? 'Đang lưu…' : 'Cấp mật khẩu'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
