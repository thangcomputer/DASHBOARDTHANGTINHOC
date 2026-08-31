import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertTriangle, ChevronRight, Fingerprint, Activity, MonitorX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setTokens, clearOtherRoleSessions, API_BASE, SOCKET_BASE, ensureCsrfToken } from '../services/api';
import { unlockAudio } from '../utils/sound';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, normalizePhone } from '../utils/validators';

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
      .catch(() => {});
  }, [API]);

  const [userInputCaptcha, setUserInputCaptcha] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');

  // CAPTCHA do server sinh — dùng 1 lần, phải làm mới sau mỗi lần gửi
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
      setError('VUI LÒNG NHẬP SỐ ĐIỆN THOẠI HỢP LỆ VÀ MẬT KHẨU');
      toast.error('Cảnh báo: Thông tin trống');
      return;
    }

    // 2. Kiểm tra mã CAPTCHA (server xác thực, client chỉ chặn trường trống)
    if (!userInputCaptcha.trim()) {
      setError('VUI LÒNG NHẬP MÃ BẢO VỆ');
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
        setError(data.message?.toUpperCase() || 'TÀI KHOẢN HOẶC MẬT KHẨU KHÔNG ĐÚNG');
        toast.error('Truy cập bị từ chối!');
        setPassword('');
        generateCaptcha(); // CAPTCHA dùng 1 lần — cấp mã mới cho lần thử tiếp theo
      }
    } catch (err) {
      console.error('[AdminLogin]', err);
      setError(
        err?.message === 'INVALID_JSON'
          ? 'MÁY CHỦ TRẢ VỀ DỮ LIỆU KHÔNG HỢP LỆ (KIỂM TRA API ĐANG CHẠY VÀ PROXY VITE)'
          : 'LỖI KẾT NỐI HỆ THỐNG BẢO MẬT',
      );
      toast.error('Không kết nối được máy chủ — chạy backend (port 5000) và npm run dev client');
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
      setError('NHẬP MÃ OTP 6 SỐ');
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
        setError(data.message?.toUpperCase() || 'MÃ OTP KHÔNG ĐÚNG');
        toast.error(data.message || 'Mã OTP không đúng');
      }
    } catch {
      setError('LỖI KẾT NỐI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#020617] flex items-center justify-center p-0 font-sans overflow-x-clip overflow-y-auto selection:bg-red-500/30 relative">
      
      {/* Background Decor - Cyber Dots */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="w-full min-h-[100dvh] md:h-[100dvh] flex flex-col md:flex-row relative z-10 overflow-x-clip md:overflow-hidden">
        
        {/* LEFT COLUMN: CYBER COMMAND CENTER */}
        <div className="hidden md:flex md:w-[60%] bg-transparent p-10 lg:p-20 flex-col justify-center relative border-r border-white/5 min-w-0">
          <div className="relative z-10 space-y-12 animate-in fade-in slide-in-from-left-20 duration-1000">
            <div className="inline-flex items-center gap-3 bg-red-600/10 border border-red-500/20 px-4 py-2 rounded-xl">
               <ShieldCheck size={18} className="text-red-500" aria-hidden="true" />
               <span className="text-xs font-black text-red-400 uppercase tracking-[0.3em]">Hệ thống quản trị tối cao</span>
            </div>

            <div className="space-y-4">
               <h1 className="text-5xl lg:text-7xl xl:text-8xl font-black text-white leading-none tracking-tighter break-anywhere">
                LMS <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-500 to-red-800">CENTRAL</span>
              </h1>
              <p className="text-slate-400 text-lg lg:text-xl font-medium max-w-xl leading-relaxed">
                Trung tâm điều hành nền tảng Đào tạo Tin học văn phòng. 
                Kiểm soát dữ liệu, phân quyền giảng viên và theo dõi tăng trưởng doanh thu theo thời gian thực.
              </p>
            </div>

            {/* Quick Stats Grid - Premium Feel */}
            <div className="grid grid-cols-2 gap-6 max-w-lg pt-10">
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] group hover:border-red-500/50 transition-all duration-500">
                  <Activity size={24} className="text-red-500 mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-3xl font-black text-white">99.9%</p>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">Uptime System</p>
               </div>
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] group hover:border-red-500/50 transition-all duration-500">
                  <Fingerprint size={24} className="text-red-500 mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-3xl font-black text-white">AES-256</p>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">Data Security</p>
               </div>
            </div>
          </div>

          {/* Glowing Orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-[100px]" />
        </div>

        {/* RIGHT COLUMN: ADMIN GATEWAY */}
        <div className="w-full md:w-[40%] flex flex-col px-[15px] py-6 sm:p-8 lg:py-10 lg:px-14 xl:py-14 relative bg-[#020617]/50 backdrop-blur-3xl min-w-0 overflow-y-auto">
          
          <div className="w-full max-w-md space-y-6 sm:space-y-8 z-10 my-auto mx-auto">
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-700">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-red-600 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                <img src={dynamicLogo || "/logo-thang-tin-hoc.svg"} alt="Thắng Tin Học" className="h-12 sm:h-16 max-w-[min(100%,180px)] relative z-10 object-contain mx-auto" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Cổng Admin</h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em]">Xác thực quyền truy cập hệ thống</p>
              </div>
            </div>

            <form onSubmit={mfaToken ? handleMfaVerify : handleLogin} className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-right-10 duration-1000 delay-200">
              {error && (
                <div role="alert" className="bg-[#1a0505] border-l-4 border-red-600 p-5 rounded-2xl flex items-center gap-4 text-red-400 text-[11px] font-black tracking-widest shadow-2xl">
                  <AlertTriangle size={20} className="flex-shrink-0" aria-hidden="true" />
                  <span className="break-anywhere">{error}</span>
                </div>
              )}

              {mfaToken ? (
                <div className="space-y-4">
                  <p className="text-slate-400 text-sm font-medium">Nhập mã 6 số từ Google Authenticator / Authy</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-white/[0.03] border-2 border-white/10 rounded-3xl px-5 py-5 text-white text-center text-2xl font-black tracking-[0.4em] outline-none focus:border-red-600/50 placeholder:text-slate-500"
                    placeholder="000000"
                    autoFocus
                    aria-label="Mã xác thực 2 bước"
                  />
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
              <div className="space-y-3">
                <label htmlFor="admin-phone" className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Số điện thoại</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors">
                    <User size={20} aria-hidden="true" />
                  </div>
                  <input
                    id="admin-phone"
                    type="tel"
                    inputMode="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="w-full bg-white/[0.03] border-2 border-white/10 rounded-3xl pl-14 pr-5 py-3.5 sm:py-4 text-white outline-none focus:border-red-600/50 focus:bg-white/[0.05] transition-all font-black placeholder:text-slate-400 shadow-inner"
                    placeholder="VD: 0912345678 hoặc +84912345678"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label htmlFor="admin-password" className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Master Password</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors">
                    <Lock size={20} aria-hidden="true" />
                  </div>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-white/[0.03] border-2 border-white/10 rounded-3xl pl-14 pr-14 py-3.5 sm:py-4 text-white outline-none focus:border-red-600/50 focus:bg-white/[0.05] transition-all font-black placeholder:text-slate-400 shadow-inner"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block ml-1">Mã bảo vệ</label>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white/5 border-2 border-white/5 rounded-3xl p-4 flex items-center justify-center relative overflow-hidden h-16 select-none shadow-inner">
                    {captchaSvg ? (
                      <img src={captchaSvg} alt="Mã bảo vệ" className="h-12 w-auto rounded-lg" />
                    ) : (
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đang tải mã…</span>
                    )}
                  </div>
                  <button 
                    type="button" 
                    onClick={generateCaptcha}
                    className="w-16 h-16 rounded-3xl bg-white/5 border-2 border-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all hover:bg-white/10 active:scale-95"
                  >
                    <Activity size={24} className={loading ? 'animate-pulse' : ''} />
                  </button>
                </div>
                
                <input
                  type="text"
                  required={!mfaToken}
                  value={userInputCaptcha}
                  onChange={(e) => setUserInputCaptcha(e.target.value)}
                  className="w-full bg-white/[0.03] border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-center text-xs font-black outline-none focus:border-red-600/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-700 uppercase tracking-widest"
                  placeholder="Nhập mã hiển thị ở trên"
                />
              </div>
              </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-3xl py-4 font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-900/40 hover:from-red-700 hover:to-rose-800 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-70 flex items-center justify-center gap-4 border border-white/10"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mfaToken ? 'Xác thực OTP' : 'Khởi tạo truy cập'}
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Terminal Style Footer */}
            <div className="text-center pt-6 animate-in fade-in duration-1000 delay-500">
               <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 inline-block">
                  <p className="text-xs font-mono text-slate-600">
                    TERMINAL ID: <span className="text-red-500/70">ADMIN-01X8</span> <br />
                    LOCATION: <span className="text-slate-400">VIETNAM CENTRAL HUB</span>
                  </p>
               </div>
            </div>
          </div>

          <div className="absolute bottom-6 text-[9px] font-black text-slate-700 uppercase tracking-[0.5em]">
            Authorized Personnel Only © 2026
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
