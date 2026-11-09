import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Lock, User, Eye, EyeOff, AlertTriangle, ChevronRight, Fingerprint, Activity, MonitorX,
  RefreshCw, KeyRound, Users, ScrollText, LayoutDashboard, BarChart3,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setTokens, clearOtherRoleSessions, API_BASE, SOCKET_BASE, ensureCsrfToken } from '../services/api';
import { unlockAudio } from '../utils/sound';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, limitPhoneInput, normalizePhone, PHONE_MAX_DIGITS } from '../utils/validators';

const ADMIN_HIGHLIGHTS = [
  { label: 'Bảo mật 2 lớp', icon: KeyRound },
  { label: 'Phân quyền chi tiết', icon: Users },
  { label: 'Nhật ký truy cập', icon: ScrollText },
];

const AdminLoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceConflict, setDeviceConflict] = useState(false);
  const [forceTicket, setForceTicket] = useState(null);
  const [mfaToken, setMfaToken] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  /** Base gốc API (domain backend hoặc '' để dùng proxy Vite /api) */
  const API = SOCKET_BASE;
  const [dynamicLogo, setDynamicLogo] = useState('');

  // Fetch dynamic logo from web settings
  React.useEffect(() => {
    fetch(`${API}/api/settings/web`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.logoUrl) {
          const url = res.data.logoUrl;
          setDynamicLogo(url.startsWith('http') ? url : `${API}${url}`);
        }
      })
      .catch(() => { });
  }, [API]);

  const [userInputCaptcha, setUserInputCaptcha] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');

  // CAPTCHA do server sinh - dùng 1 lần, phải làm mới sau mỗi lần gửi
  const generateCaptcha = React.useCallback(async () => {
    setUserInputCaptcha('');
    try {
      const res = await fetch(`${API_BASE}/auth/captcha`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setCaptchaId(data.cid);
        // Bọc trong data-URI để trình duyệt render SVG trong sandbox của <img>
        setCaptchaSvg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.svg)}`);
      }
    } catch {
      setCaptchaSvg('');
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => generateCaptcha(), 0);
    return () => window.clearTimeout(timer);
  }, [generateCaptcha]);

  const handleLogin = async (e, forceDevice = false) => {
    if (e?.preventDefault) e.preventDefault();

    // 1. Kiểm tra trường trống
    const canonicalPhone = normalizePhone(phone);
    if (!canonicalPhone || !isValidVNPhone(canonicalPhone) || !password) {
      setError('Vui lòng nhập số điện thoại hợp lệ và mật khẩu');
      toast.error('Cảnh báo: Thông tin trống');
      return;
    }

    // 2. Kiểm tra mã CAPTCHA (server xác thực, client chỉ chặn trường trống)
    if (!userInputCaptcha.trim()) {
      setError('Vui lòng nhập mã bảo vệ');
      toast.error('Chưa nhập mã bảo vệ');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const csrf = await ensureCsrfToken();
      const fp = getDeviceFingerprint();
      const response = await fetch(`${API_BASE}/auth/login/internal`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          phone: canonicalPhone,
          password,
          captchaId,
          captchaAnswer: userInputCaptcha.trim(),
          deviceFingerprint: fp,
          force: forceDevice,
          ...(forceDevice && forceTicket ? { forceTicket } : {}),
        }),
      });

      const raw = await response.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error('INVALID_JSON');
      }

      if (response.status === 409 && data.code === 'DEVICE_CONFLICT') {
        setForceTicket(data.forceTicket || null);
        setDeviceConflict(true);
        setLoading(false);
        return;
      }

      if (data.success && (data.mfaRequired || data.data?.mfaRequired)) {
        setMfaToken(data.mfaToken || data.data?.mfaToken);
        setMfaCode('');
        setLoading(false);
        toast.success('Nhập mã OTP từ ứng dụng Authenticator');
        return;
      }

      if (data.success) {
        finishLogin(data);
      } else {
        setError(data.message || 'Tài khoản hoặc mật khẩu không đúng');
        toast.error('Truy cập bị từ chối!');
        setPassword('');
        generateCaptcha(); // CAPTCHA dùng 1 lần - cấp mã mới cho lần thử tiếp theo
      }
    } catch (err) {
      console.error('[AdminLogin]', err);
      setError(
        err?.message === 'INVALID_JSON'
          ? 'Máy chủ trả về dữ liệu không hợp lệ (kiểm tra API đang chạy và proxy vite)'
          : 'Lỗi kết nối hệ thống bảo mật',
      );
      toast.error('Không kết nối được máy chủ - chạy backend (port 5000) và npm run dev client');
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = (data) => {
    setDeviceConflict(false);
    setForceTicket(null);
    setMfaToken(null);
    const actualUser = data.data.user || data.data;
    const accessToken = data.data.accessToken || actualUser.token || actualUser.accessToken;
    const refreshToken = data.data.refreshToken || actualUser.refreshToken;
    const role = actualUser.adminRole === 'STAFF' ? 'staff' : (actualUser.role || 'admin');
    const finalUserObj = {
      ...actualUser,
      id: actualUser.id || actualUser._id,
      role,
      token: accessToken,
      refreshToken,
    };
    clearOtherRoleSessions(role);
    localStorage.setItem(`${role}_user`, JSON.stringify(finalUserObj));
    setTokens(accessToken, refreshToken, role);
    unlockAudio();
    onLogin(finalUserObj);
    toast.success(`Hệ thống đã sẵn sàng, chào mừng ${actualUser.name}!`);
    navigate(role === 'student' ? '/student' : '/admin');
  };

  const handleMfaVerify = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!mfaCode.trim() || !mfaToken) {
      setError('Nhập mã OTP 6 số');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/mfa/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ mfaToken, code: mfaCode.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.success && data.data?.accessToken) {
        finishLogin(data);
      } else {
        setError(data.message || 'Mã OTP không đúng');
        toast.error(data.message || 'Mã OTP không đúng');
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cms-login-bg relative min-h-[100dvh] flex items-center justify-center p-0 font-sans overflow-x-clip overflow-y-auto selection:bg-red-500/30">
      <div className="cms-login-aura cms-login-aura--red" aria-hidden="true" />
      <div className="cms-login-aura cms-login-aura--blue" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden text-white/[0.05]" aria-hidden="true">
        <ShieldCheck size={88} className="absolute left-[5%] top-[9%] -rotate-12" />
        <LayoutDashboard size={72} className="absolute right-[6%] top-[28%] rotate-12" />
        <BarChart3 size={64} className="absolute bottom-[18%] left-[4%] rotate-6" />
        <Fingerprint size={76} className="absolute bottom-[6%] right-[9%] -rotate-6" />
      </div>

      <div className="relative z-10 w-full min-h-[100dvh] md:h-[100dvh] flex flex-col md:flex-row overflow-x-clip md:overflow-hidden">

        {/* CỘT TRÁI: GIỚI THIỆU TRUNG TÂM ĐIỀU HÀNH */}
        <div className="hidden md:flex md:w-[55%] p-10 lg:p-20 flex-col justify-center relative min-w-0">
          <div className="relative z-10 space-y-10 animate-in fade-in slide-in-from-left-20 duration-1000">
            <div className="cms-login-chip">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Hệ thống quản trị tối cao</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl lg:text-7xl xl:text-8xl font-black text-white leading-none tracking-tighter break-anywhere">
                LMS <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-700">Central</span>
              </h1>
              <p className="text-slate-400 text-lg lg:text-xl font-medium max-w-xl leading-relaxed">
                Trung tâm điều hành nền tảng Đào tạo Tin học văn phòng.
                Kiểm soát dữ liệu, phân quyền giảng viên và theo dõi tăng trưởng doanh thu theo thời gian thực.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-lg">
              {[
                { value: '99.9%', label: 'Uptime System', icon: Activity },
                { value: 'AES-256', label: 'Data Security', icon: Fingerprint },
              ].map((stat) => (
                <div key={stat.label} className="cms-login-highlight !items-start !gap-2 !p-5 !text-left">
                  <span className="cms-login-highlight__icon"><stat.icon size={17} aria-hidden="true" /></span>
                  <span className="text-3xl font-black text-white">{stat.value}</span>
                  <span className="text-xs font-black text-slate-500 tracking-widest">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CỔNG ĐĂNG NHẬP */}
        <div className="w-full md:w-[45%] flex-1 flex flex-col px-[15px] py-6 sm:p-8 lg:py-10 lg:px-14 xl:py-14 relative min-w-0 overflow-y-auto">
          <div className="w-full max-w-md space-y-6 z-10 my-auto mx-auto">
            <div className="flex justify-center animate-in fade-in zoom-in duration-700">
              <div className="cms-login-logo">
                <img src={dynamicLogo || "/logo-thang-tin-hoc.svg"} alt="Thắng Tin Học" className="h-11 sm:h-12 max-w-[200px] object-contain" />
                <span className="cms-login-shine" aria-hidden="true" />
              </div>
            </div>

            <div className="cms-login-card px-5 py-6 sm:px-7 sm:py-8 space-y-5 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <div className="text-center space-y-2">
                <div className="cms-login-chip mx-auto">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>Cổng quản trị</span>
                </div>
                <h2 className="text-fluid-2xl font-black text-white">Cổng Admin</h2>
                <p className="text-sm text-slate-400 font-medium">
                  {mfaToken ? 'Nhập mã 6 số từ Google Authenticator / Authy' : 'Xác thực quyền truy cập hệ thống'}
                </p>
              </div>

              <form onSubmit={mfaToken ? handleMfaVerify : handleLogin} className="space-y-4">
                {error && (
                  <div role="alert" className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm font-bold">
                    <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
                    <span className="break-anywhere">{error}</span>
                  </div>
                )}

                {mfaToken ? (
                  <div className="space-y-3">
                    <div className="cms-login-field">
                      <KeyRound size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="cms-login-input !text-center !text-2xl !font-black !tracking-[0.4em]"
                        placeholder="000000"
                        autoFocus
                        aria-label="Mã xác thực 2 bước"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMfaToken(null); setMfaCode(''); setError(null); }}
                      className="text-xs font-bold text-slate-400 hover:text-white underline"
                    >
                      Quay lại đăng nhập
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="admin-phone" className="text-xs font-bold text-slate-400 block ml-1">Số điện thoại</label>
                      <div className="cms-login-field group">
                        <User size={18} className="shrink-0 text-slate-400 group-focus-within:text-red-500 transition-colors" aria-hidden="true" />
                        <input
                          id="admin-phone"
                          type="tel"
                          inputMode="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(limitPhoneInput(e.target.value))}
                          maxLength={PHONE_MAX_DIGITS + 1}
                          autoComplete="tel"
                          className="cms-login-input"
                          placeholder="VD: 0912345678"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="admin-password" className="text-xs font-bold text-slate-400 block ml-1">Mật khẩu quản trị</label>
                      <div className="cms-login-field group">
                        <Lock size={18} className="shrink-0 text-slate-400 group-focus-within:text-red-500 transition-colors" aria-hidden="true" />
                        <input
                          id="admin-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          className="cms-login-input"
                          placeholder="••••••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          className="shrink-0 text-slate-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="admin-captcha" className="text-xs font-bold text-slate-400 block ml-1">Mã bảo vệ</label>
                      <div className="flex gap-2">
                        <div className="cms-login-field flex-1 justify-center !min-h-[60px] select-none">
                          {captchaSvg ? (
                            <img src={captchaSvg} alt="Mã bảo vệ" className="h-11 w-auto rounded-lg" />
                          ) : (
                            <span className="text-xs font-bold text-slate-500">Đang tải mã…</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={generateCaptcha}
                          aria-label="Đổi mã bảo vệ khác"
                          title="Đổi mã bảo vệ khác"
                          className="cms-login-icon-btn"
                        >
                          <RefreshCw size={20} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="cms-login-field">
                        <input
                          id="admin-captcha"
                          type="text"
                          required={!mfaToken}
                          value={userInputCaptcha}
                          onChange={(e) => setUserInputCaptcha(e.target.value)}
                          className="cms-login-input !text-center !tracking-[0.3em] uppercase placeholder:normal-case placeholder:!tracking-normal"
                          placeholder="Nhập mã hiển thị ở trên"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button type="submit" disabled={loading} className="cms-login-submit group">
                  <span className="cms-login-shine" aria-hidden="true" />
                  {loading ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      {mfaToken ? 'Xác thực OTP' : 'Khởi tạo truy cập'}
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ADMIN_HIGHLIGHTS.map((item) => (
                <div key={item.label} className="cms-login-highlight">
                  <span className="cms-login-highlight__icon"><item.icon size={15} aria-hidden="true" /></span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] font-bold text-slate-500 tracking-widest">
              Chỉ dành cho nhân sự được cấp quyền · © 2026
            </p>
          </div>
        </div>
      </div>

      {/* ═══ DIALOG: CẢNH BÁO THIẾT BỊ KHÁC ═══ */}
      {deviceConflict && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-3xl w-full max-w-sm border border-amber-500/30 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <MonitorX size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg">Phát hiện đăng nhập khác</h3>
                <p className="text-white/70 text-xs font-medium">Tài khoản đang hoạt động trên thiết bị khác</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-amber-300 text-sm font-bold leading-relaxed">
                  ⚠️ Số điện thoại <strong className="text-white">{phone}</strong> hiện đang đăng nhập trên máy tính khác.
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Nếu tiếp tục, phiên quản trị trên máy kia sẽ bị đăng xuất ngay lập tức.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeviceConflict(false); setForceTicket(null); generateCaptcha(); }}
                  className="flex-1 py-3 border-2 border-white/10 text-gray-400 font-bold rounded-xl hover:border-white/20 transition text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => { setDeviceConflict(false); handleLogin(null, true); }}
                  disabled={loading}
                  className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl hover:from-amber-600 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
                >
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><MonitorX size={15} /> Đăng nhập, đăng xuất máy kia</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLoginPage;
