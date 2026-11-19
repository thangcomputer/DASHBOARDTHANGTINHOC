import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE, ensureCsrfToken } from '../services/api';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { openAdminZalo } from '../utils/adminZaloContact';
import { isValidEmail, isValidVNPhone, normalizePhone } from '../utils/validators';
import NavArrow from './ui/NavArrow';

function resolveContact(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (isValidEmail(trimmed)) {
    return { type: 'email', value: trimmed.toLowerCase(), label: 'Gmail' };
  }
  const normalizedPhone = normalizePhone(trimmed);
  if (normalizedPhone && isValidVNPhone(normalizedPhone)) {
    return { type: 'phone', value: normalizedPhone, label: 'SĐT' };
  }
  return null;
}

/**
 * Modal Quên mật khẩu qua OTP (Gmail hoặc SĐT SMS).
 * Sau khi xác minh đúng mã 6 số sẽ tạo phiên đăng nhập tạm (mustChangePassword=true)
 * để vào thẳng Web App đặt lại mật khẩu mới.
 */
export default function ForgotPasswordModal({
  open,
  initialRole = 'student',
  lockRole = false,
  onClose,
  onRecovered,
  onSwitchToRegister,
}) {
  const [step, setStep] = useState(1); // 1 = nhập SĐT/Gmail, 2 = nhập mã OTP 6 số
  const [role, setRole] = useState(initialRole);
  const [contactInput, setContactInput] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notFoundAccount, setNotFoundAccount] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [deliveryMeta, setDeliveryMeta] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setRole(initialRole);
    setContactInput('');
    setOtp('');
    setError('');
    setNotFoundAccount(false);
    setResendCooldown(0);
    setDeliveryMeta(null);
  }, [initialRole, open]);

  useEffect(() => {
    if (!open || resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => {
      setResendCooldown((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [open, resendCooldown]);

  if (!open) return null;

  const parsedContact = resolveContact(contactInput);
  const roleName = role === 'teacher' ? 'Giảng viên' : 'Học viên';

  const requestOtp = async (isResend = false) => {
    if (!parsedContact) {
      setError('Vui lòng nhập số điện thoại Việt Nam (0…) hoặc Gmail hợp lệ');
      return;
    }
    if (isResend) setResending(true);
    else setLoading(true);
    setError('');
    setNotFoundAccount(false);

    try {
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/auth/forgot-password/request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          identifier: parsedContact.value,
          ...(parsedContact.type === 'phone' ? { phone: parsedContact.value } : { email: parsedContact.value }),
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 404 || data.code === 'ACCOUNT_NOT_FOUND') {
          setNotFoundAccount(true);
        }
        setError(data.message || 'Không gửi được mã xác nhận. Vui lòng thử lại.');
        return;
      }

      setDeliveryMeta({
        channel: data.channel || (parsedContact.type === 'email' ? 'email' : 'sms'),
        channelConfigured: data.channelConfigured !== false,
        emailConfigured: Boolean(data.emailConfigured),
        smsConfigured: Boolean(data.smsConfigured),
      });
      setResendCooldown(Number(data.resendAfterSec || 45));
      setStep(2);
      toast.success(isResend ? 'Đã gửi lại mã xác nhận' : 'Đã tạo yêu cầu mã xác nhận');
    } catch {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const verifyOtpAndEnter = async () => {
    const cleanOtp = String(otp || '').replace(/\D/g, '');
    if (!parsedContact || cleanOtp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số mã xác nhận');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/auth/forgot-password/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          identifier: parsedContact.value,
          role,
          otp: cleanOtp,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data?.accessToken) {
        setError(data.message || 'Mã xác nhận không đúng hoặc đã hết hạn.');
        return;
      }

      toast.success('Xác thực thành công! Vui lòng đặt lại mật khẩu mới.');
      onRecovered(data.data, role);
    } catch {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <KeyRound size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg">Quên mật khẩu</h3>
              <p className="text-white/80 text-xs font-medium">
                {step === 1 ? 'Nhận mã xác nhận qua Gmail hoặc SĐT' : 'Nhập mã 6 số để vào đặt mật khẩu mới'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 ? (
            <>
              {!lockRole ? (
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-2">Vai trò tài khoản</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setRole('student'); setError(''); setNotFoundAccount(false); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 cursor-pointer ${
                        role === 'student'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      Học viên
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRole('teacher'); setError(''); setNotFoundAccount(false); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 cursor-pointer ${
                        role === 'teacher'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      Giảng viên
                    </button>
                  </div>
                </div>
              ) : null}

              <div>
                <label htmlFor="forgot-identifier" className="text-xs font-bold text-gray-400 block mb-1.5">
                  Số điện thoại hoặc Gmail đăng ký
                </label>
                <div className="relative">
                  {parsedContact?.type === 'email' ? (
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" />
                  ) : (
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  )}
                  <input
                    id="forgot-identifier"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    value={contactInput}
                    onChange={(e) => { setContactInput(e.target.value); setError(''); setNotFoundAccount(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void requestOtp(false); }}
                    className="w-full bg-[#0f172a] border-2 border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500 transition placeholder:text-slate-400"
                    placeholder="0912345678 hoặc ten@gmail.com"
                  />
                </div>
              </div>

              {parsedContact ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3">
                  <p className="text-[11px] font-bold text-emerald-400/90 mb-0.5">Kênh nhận mã xác nhận</p>
                  <p className="text-sm font-bold text-emerald-200">
                    {`${roleName} · ${parsedContact.type === 'email' ? 'Gửi qua Gmail' : 'Gửi qua tin nhắn SĐT'}: ${parsedContact.value}`}
                  </p>
                </div>
              ) : (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3">
                  <p className="text-sky-300 text-xs font-bold leading-relaxed">
                    Nhập Gmail hoặc Số điện thoại đã đăng ký để nhận mã xác nhận 6 số.
                  </p>
                </div>
              )}

              {error ? (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl space-y-2.5 text-red-400 text-sm font-bold">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                  {notFoundAccount && role === 'student' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const val = parsedContact?.value || contactInput.trim();
                        if (typeof onSwitchToRegister === 'function') {
                          onSwitchToRegister(val);
                        } else {
                          window.location.assign(`/DANGNHAPMIENPHI?mode=register${val ? `&contact=${encodeURIComponent(val)}` : ''}`);
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={14} />
                      Đăng ký tài khoản ngay
                      <ArrowRight size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => { void requestOtp(false); }}
                disabled={loading || !parsedContact}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl tracking-wide text-sm hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Gửi mã xác nhận
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3.5 space-y-1">
                <p className="text-xs font-bold text-slate-400">
                  Tài khoản {roleName} · <span className="text-white font-mono">{parsedContact?.value}</span>
                </p>
                {deliveryMeta?.channelConfigured ? (
                  <p className="text-xs font-bold text-emerald-400">
                    {deliveryMeta.channel === 'email'
                      ? 'Mã xác nhận 6 số đã được gửi tới Gmail (kiểm tra Hộp thư đến hoặc Spam). Hiệu lực 5 phút.'
                      : 'Mã xác nhận 6 số đã được gửi về tin nhắn điện thoại của bạn. Hiệu lực 5 phút.'}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-amber-300 leading-relaxed">
                    {deliveryMeta?.channel === 'email'
                      ? 'Máy chủ chưa cấu hình SMTP/Gmail để gửi email tự động. Khi chạy cục bộ có thể xem mã OTP trên log server hoặc liên hệ Admin Zalo bên dưới.'
                      : 'Máy chủ chưa cấu hình cổng SMS gửi tin nhắn điện thoại. Hãy thử nhập Gmail đã đăng ký (nếu đã bật SMTP), xem log server cục bộ hoặc liên hệ Admin Zalo bên dưới.'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="forgot-otp-input" className="text-xs font-bold text-gray-400 block mb-1.5">
                  Mã xác nhận 6 chữ số
                </label>
                <input
                  id="forgot-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void verifyOtpAndEnter(); }}
                  placeholder="• • • • • •"
                  className="w-full bg-[#0f172a] border-2 border-white/15 focus:border-emerald-500 rounded-xl px-4 py-3 text-center text-white font-mono text-2xl font-black tracking-[0.45em] outline-none transition placeholder:text-slate-600 placeholder:tracking-widest"
                />
              </div>

              {error ? (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 text-red-400 text-sm font-bold">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => { void verifyOtpAndEnter(); }}
                disabled={loading || otp.length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl text-sm hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Xác nhận mã &amp; Đặt mật khẩu mới
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); }}
                  className="py-2 px-3 rounded-xl border border-white/10 text-gray-300 text-xs font-bold hover:border-white/25 transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <NavArrow size={14} direction="back" className="text-gray-300" />
                  Đổi SĐT / Gmail
                </button>
                <button
                  type="button"
                  onClick={() => { void requestOtp(true); }}
                  disabled={resending || resendCooldown > 0}
                  className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-emerald-300 text-xs font-bold hover:bg-white/10 transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                  {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại mã'}
                </button>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => openAdminZalo('[THẮNG TIN HỌC] Hỗ trợ khôi phục mật khẩu')}
              className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle size={13} />
              Cần Admin hỗ trợ? Chat Zalo Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
