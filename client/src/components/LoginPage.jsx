import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle2, AlertCircle, BookOpen, Lock, User, KeyRound, MonitorX, UserPlus,
  GraduationCap, Award, Headphones, LogIn, Monitor, Clock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setTokens, clearOtherRoleSessions, ensureCsrfToken, API_BASE } from '../services/api';
import { unlockAudio } from '../utils/sound';
import NavArrow from './ui/NavArrow';
import { getDeviceAuthFields, rememberDeviceSecret } from '../utils/deviceFingerprint';
import { isValidEmail, isValidVNPhone, normalizePhone } from '../utils/validators';
import ForgotPasswordModal from './ForgotPasswordModal';
import LanguageSwitcher from './LanguageSwitcher';

const LOGIN_HIGHLIGHTS = [
  { label: 'Học mọi lúc', desc: 'Lộ trình 1-1 & Video', icon: BookOpen },
  { label: 'Thi chứng nhận', desc: 'Chuẩn MOS / IC3', icon: Award },
  { label: 'Hỗ trợ tận tâm', desc: 'Giảng viên đồng hành', icon: Headphones },
];

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('student');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notFoundError, setNotFoundError] = useState(false);
  const [reEnrollError, setReEnrollError] = useState(false);
  const [deviceConflict, setDeviceConflict] = useState(false); // cảnh báo máy khác
  const pendingLoginRef = useRef(null); // lưu payload để force login
  const [dynamicLogo, setDynamicLogo] = useState('');

  // Hiển thị thông báo nếu bị đăng xuất do không hoạt động hoặc do nơi khác đăng nhập
  const urlMsg = new URLSearchParams(location.search).get('msg');
  const inactivityMsg = urlMsg === 'inactivity';
  const sessionReplacedMsg = urlMsg === 'session_replaced';


  // ── Forgot Password State ──
  const [showForgot, setShowForgot] = useState(false);
  const [forgotRole, setForgotRole] = useState('student');

  const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

  useEffect(() => {
    fetch(`${API}/api/settings/web`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.logoUrl) {
          const url = res.data.logoUrl;
          setDynamicLogo(url.startsWith('http') ? url : `${API}${url}`);
        }
      }).catch(() => { });
  }, [API]);

  const doLogin = async (forceDevice = false) => {
    setLoading(true); setError(null); setNotFoundError(false); setReEnrollError(false);
    const rawContact = String(phone || '').trim();
    const normalized = normalizePhone(rawContact);
    const trimmedEmail = rawContact.toLowerCase();
    const isPhoneOk = Boolean(normalized && isValidVNPhone(normalized));
    const isEmailOk = isValidEmail(trimmedEmail);
    if (!isPhoneOk && !isEmailOk) {
      setError('Số điện thoại hoặc Gmail không hợp lệ'); setLoading(false); return;
    }
    const id = isPhoneOk ? normalized : trimmedEmail;
    try {
      const deviceScope = { role, identifier: id };
      const deviceAuth = getDeviceAuthFields(deviceScope);
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/login/public`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ identifier: id, phone: id, password, role, force: forceDevice, ...deviceAuth }),
      });
      const data = await response.json();
      if (data.code === 'DEVICE_NOT_REGISTERED_LIMIT_REACHED' || data.code === 'DEVICE_PROOF_INVALID' || data.code === 'DEVICE_KEY_REQUIRED') {
        setError(data.message || 'Không xác minh được thiết bị đã đăng ký.');
        toast.error(data.title || 'Không xác minh được thiết bị');
        return;
      }
      if (response.status === 409 && data.code === 'DEVICE_CONFLICT') {
        // Tài khoản đang dùng ở máy khác → hiện cảnh báo
        pendingLoginRef.current = { phone, password, role };
        setDeviceConflict(true);
        return;
      }
      if (data.success) {
        rememberDeviceSecret(data.data?.deviceSecret, deviceScope);
        setDeviceConflict(false);
        const user = data.data.user ? { ...data.data.user } : { ...data.data };
        const accessToken = data.data.accessToken || user.accessToken;
        const refreshToken = data.data.refreshToken || user.refreshToken;

        user.accessToken = accessToken;
        user.token = accessToken; // Ensure compatibility with SocketProvider
        user.refreshToken = refreshToken;

        if (!user.id && user._id) user.id = user._id;
        clearOtherRoleSessions(role);
        localStorage.setItem(`${role}_user`, JSON.stringify(user));
        setTokens(accessToken, refreshToken, role);
        unlockAudio();
        onLogin(user);
        toast.success(`Chào mừng ${role === 'teacher' ? 'Giảng viên' : 'Học viên'}: ${user.name}!`);
        const teacherHome = role === 'teacher'
          && String(user.status || '').toLowerCase() !== 'active'
          ? '/teacher/test'
          : role === 'teacher'
            ? '/teacher'
            : '/student';
        navigate(teacherHome);
      } else if (data.code === 'NEEDS_RE_ENROLL' || data.redirect === '/dangkykhoahoc') {
        const p = String(data.phone || phone || '').trim();
        setReEnrollError(true);
        setError(data.message || 'Bạn cần đăng ký và thanh toán khóa học mới để đăng nhập.');
        const q = new URLSearchParams({ reEnroll: '1' });
        if (p) q.set('phone', p);
        // Cho HV bấm ngay sang form đăng ký
        setTimeout(() => navigate(`/dangkykhoahoc?${q.toString()}`), 600);
      } else if (response.status === 404 || data.code === 'ACCOUNT_NOT_FOUND') {
        setNotFoundError(true);
        setError(data.message || 'Tài khoản không tồn tại. Vui lòng đăng ký tài khoản mới.');
      } else {
        setError(data.message || 'Số điện thoại/Gmail hoặc mật khẩu không đúng');
      }
    } catch { setError('Không thể kết nối đến máy chủ'); }
    finally { setLoading(false); }
  };

  const handleLogin = (e) => { e.preventDefault(); doLogin(false); };
  const handleForceLogin = () => { setDeviceConflict(false); doLogin(true); };

  const handleRecoveredSession = (payload, recoveredRole) => {
    const activeRole = recoveredRole === 'teacher' ? 'teacher' : 'student';
    const user = payload.user ? { ...payload.user } : { ...payload };
    const accessToken = payload.accessToken || user.accessToken;
    const refreshToken = payload.refreshToken || user.refreshToken;
    user.accessToken = accessToken;
    user.token = accessToken;
    user.refreshToken = refreshToken;
    if (!user.id && user._id) user.id = user._id;
    clearOtherRoleSessions(activeRole);
    localStorage.setItem(`${activeRole}_user`, JSON.stringify(user));
    setTokens(accessToken, refreshToken, activeRole);
    unlockAudio();
    setShowForgot(false);
    onLogin(user);
    const teacherHome = activeRole === 'teacher'
      && String(user.status || '').toLowerCase() !== 'active'
      ? '/teacher/test'
      : activeRole === 'teacher'
        ? '/teacher'
        : '/student';
    navigate(teacherHome);
  };

  return (
    <div className="cms-login-bg relative min-h-[100dvh] md:h-[100dvh] md:max-h-[100dvh] flex items-center justify-center p-0 font-sans overflow-x-hidden md:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="cms-login-aura cms-login-aura--red" />
        <div className="cms-login-aura cms-login-aura--blue" />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(rgba(52, 211, 153, 0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute inset-0 text-emerald-400/[0.06]">
          <GraduationCap size={96} className="cms-login-float absolute left-[5%] top-[9%]" style={{ '--cms-rot': '-12deg', animationDelay: '0s' }} />
          <BookOpen size={76} className="cms-login-float absolute right-[6%] top-[28%]" style={{ '--cms-rot': '12deg', animationDelay: '-2s' }} />
          <Award size={68} className="cms-login-float absolute bottom-[18%] left-[4%]" style={{ '--cms-rot': '6deg', animationDelay: '-4s' }} />
          <Monitor size={80} className="cms-login-float absolute bottom-[6%] right-[9%]" style={{ '--cms-rot': '-6deg', animationDelay: '-1.2s' }} />
        </div>
      </div>
      <div className="relative z-10 w-full flex-1 md:h-full flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden">
        <div className="absolute top-3.5 right-4 sm:top-6 sm:right-8 z-30">
          <LanguageSwitcher variant="pill" theme="dark" />
        </div>

        {/* CỘT TRÁI */}
        <div className="hidden md:flex md:w-1/2 p-8 lg:p-12 xl:p-16 flex-col justify-center relative min-w-0">
          <div className="absolute top-6 left-8 lg:top-10 lg:left-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-300 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span>Hệ thống đào tạo trực tuyến</span>
            </div>
          </div>
          <div className="relative z-10 space-y-6 lg:space-y-7 animate-in fade-in slide-in-from-left-10 duration-1000 cms-login-autoscale-left">
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-[1.15] tracking-tight break-anywhere">
              Nền tảng{' '}
              <span className="cms-login-text-shimmer bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent block md:inline">
                Học Tin Học
              </span>{' '}
              <br />Văn Phòng Chuyên Nghiệp
            </h1>
            <p className="text-slate-300/85 text-base lg:text-lg leading-relaxed max-w-lg">
              Tổ chức đào tạo, luyện thi và cấp chứng nhận tin học văn phòng thực chiến với lộ trình cá nhân hóa.
            </p>
            <div className="grid max-w-xl grid-cols-3 gap-3 pt-1">
              {LOGIN_HIGHLIGHTS.map((item) => (
                <div
                  key={item.label}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-500/[0.08] hover:shadow-[0_12px_30px_rgba(16,185,129,0.16)]"
                >
                  <span className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-300 transition-transform duration-300 group-hover:scale-110 group-hover:bg-emerald-500/25">
                    <item.icon size={17} aria-hidden="true" />
                  </span>
                  <div className="text-xs font-extrabold text-white">{item.label}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-slate-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI */}
        <div className="w-full md:w-1/2 flex-1 flex flex-col px-4 py-5 sm:px-8 md:py-4 lg:px-12 xl:px-16 justify-center relative min-w-0">
          <div className="w-full max-w-md space-y-3 sm:space-y-3.5 z-10 my-auto mx-auto cms-login-autoscale-right">
            <div className="flex justify-center animate-in fade-in zoom-in duration-700">
              <div className="inline-flex items-center justify-center rounded-2xl bg-white/95 px-2.5 py-1.5 shadow-[0_10px_30px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/30 transition-transform duration-300 hover:-translate-y-0.5">
                <img src={dynamicLogo || "/logo-thang-tin-hoc.svg"} alt="Thắng Tin Học" className="h-7 sm:h-8 max-w-[170px] object-contain" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/15 border-t-emerald-400/40 bg-slate-900/75 px-5 py-5 sm:px-7 sm:py-6 space-y-4 shadow-[0_24px_60px_rgba(2,6,23,0.65),0_0_50px_rgba(16,185,129,0.10)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" aria-hidden="true" />
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Đăng nhập tài khoản</h2>
                <p className="text-xs sm:text-sm text-slate-400 font-medium">Chào mừng trở lại! Vui lòng nhập thông tin của bạn.</p>
              </div>

              <div className="relative grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-slate-950/60 p-1" role="tablist" aria-label="Chọn vai trò đăng nhập">
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-7px)] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_6px_20px_rgba(16,185,129,0.38)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    role === 'teacher' ? 'translate-x-[calc(100%+6px)]' : 'translate-x-0'
                  }`}
                />
                {[
                  { value: 'student', label: 'Học viên', icon: GraduationCap },
                  { value: 'teacher', label: 'Giảng viên', icon: User },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={role === item.value}
                    onClick={() => setRole(item.value)}
                    className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-extrabold transition-colors duration-200 cursor-pointer ${
                      role === item.value
                        ? 'text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <item.icon size={15} aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLogin} className="space-y-3" noValidate>
                {inactivityMsg && (
                  <div role="status" className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs font-bold">
                    <Clock size={16} aria-hidden="true" className="shrink-0" /> Phiên làm việc đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.
                  </div>
                )}
                {sessionReplacedMsg && (
                  <div role="alert" className="bg-amber-500/15 border border-amber-400/35 p-3 rounded-xl flex items-start gap-2.5 text-amber-200 text-xs font-bold leading-relaxed">
                    <MonitorX size={16} aria-hidden="true" className="shrink-0 mt-0.5 text-amber-400" />
                    <span>Phiên đăng nhập đã kết thúc do tài khoản vừa được đăng nhập ở trình duyệt hoặc thiết bị khác.</span>
                  </div>
                )}
                {error && (
                  <div role="alert" className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex flex-col gap-1.5 text-red-400 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
                      <span>{error}</span>
                    </div>
                    {notFoundError && role === 'student' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const contactVal = String(phone || '').trim();
                          navigate(`/DANGNHAPMIENPHI?mode=register${contactVal ? `&contact=${encodeURIComponent(contactVal)}` : ''}`);
                        }}
                        className="mt-1 w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-black tracking-wide hover:bg-emerald-500 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={14} aria-hidden="true" />
                        Đăng ký tài khoản ngay
                        <NavArrow size={14} className="text-white" />
                      </button>
                    ) : reEnrollError && (
                      <button
                        type="button"
                        onClick={() => {
                          const q = new URLSearchParams({ reEnroll: '1' });
                          if (phone) q.set('phone', normalizePhone(phone) || phone);
                          navigate(`/dangkykhoahoc?${q.toString()}`);
                        }}
                        className="mt-1 w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-black tracking-wide hover:bg-emerald-500 transition inline-flex items-center justify-center gap-1"
                      >
                        Đăng ký / thanh toán khóa học
                        <NavArrow size={14} className="text-white" />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label htmlFor="login-identifier" className="text-[11px] font-bold text-slate-400 block ml-1">Số điện thoại hoặc Gmail</label>
                    <div className="cms-login-field !min-h-[44px] sm:!min-h-[46px] !px-3.5 !rounded-xl group">
                      <User size={16} className="shrink-0 text-slate-400 group-focus-within:text-emerald-400 transition-colors" aria-hidden="true" />
                      <input id="login-identifier" type="text" inputMode="email" required value={phone} onChange={(e) => { setPhone(e.target.value); setNotFoundError(false); }} autoComplete="username"
                        className="cms-login-input !py-2 text-sm"
                        placeholder="0912345678 hoặc ten@gmail.com" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="login-password" className="text-[11px] font-bold text-slate-400 block ml-1">Mật khẩu</label>
                    <div className="cms-login-field !min-h-[44px] sm:!min-h-[46px] !px-3.5 !rounded-xl group">
                      <Lock size={16} className="shrink-0 text-slate-400 group-focus-within:text-emerald-400 transition-colors" aria-hidden="true" />
                      <input id="login-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                        className="cms-login-input !py-2 text-sm"
                        placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="shrink-0 text-slate-400 hover:text-white transition-colors">
                        {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end -mt-1">
                  <button type="button" onClick={() => { setShowForgot(true); setForgotRole(role); }}
                    className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer">
                    <KeyRound size={12} aria-hidden="true" /> Quên mật khẩu?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="cms-login-btn-sheen relative overflow-hidden mx-auto min-w-[200px] px-8 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 text-white text-sm font-black shadow-[0_5px_0_#065f46,0_12px_26px_rgba(16,185,129,0.4),inset_0_1.5px_1px_rgba(255,255,255,0.45)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_7px_0_#065f46,0_16px_32px_rgba(16,185,129,0.5),inset_0_1.5px_1px_rgba(255,255,255,0.5)] active:translate-y-[4px] active:shadow-[0_1px_0_#065f46,0_4px_12px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.35)] transition-all duration-150 disabled:opacity-60 cursor-pointer"
                >
                  {loading
                    ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    : <><LogIn size={16} aria-hidden="true" /> Đăng nhập ngay</>}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-3 gap-2 md:hidden">
              {LOGIN_HIGHLIGHTS.map((item) => (
                <div key={item.label} className="cms-login-highlight">
                  <span className="cms-login-highlight__icon"><item.icon size={14} aria-hidden="true" /></span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="text-center animate-in fade-in duration-1000 delay-500 pt-0.5">
              <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px]">
                <span className="font-black text-slate-500 tracking-wider">Hỗ trợ kỹ thuật:</span>
                <span className="font-bold">Hotline 093 5758 462</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL: QUÊN MẬT KHẨU QUA OTP EMAIL / SMS ═══ */}
      <ForgotPasswordModal
        open={showForgot}
        initialRole={forgotRole}
        onClose={() => setShowForgot(false)}
        onRecovered={handleRecoveredSession}
        onSwitchToRegister={(val) => {
          setShowForgot(false);
          navigate(`/DANGNHAPMIENPHI?mode=register${val ? `&contact=${encodeURIComponent(val)}` : ''}`);
        }}
      />

      {/* ═══ DIALOG: CẢNH BÁO THIẾT BỊ KHÁC ═══ */}
      {deviceConflict && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] rounded-3xl w-full max-w-sm border border-amber-500/30 shadow-2xl overflow-hidden">
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
                  ⚠️ Tài khoản <strong className="text-white">{phone}</strong> hiện đang đăng nhập trên một máy tính khác.
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Nếu bạn tiếp tục, phiên đăng nhập trên máy kia sẽ bị đăng xuất ngay lập tức.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeviceConflict(false); pendingLoginRef.current = null; }}
                  className="flex-1 py-3 border-2 border-white/10 text-gray-400 font-bold rounded-xl hover:border-white/20 transition text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleForceLogin}
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

export default LoginPage;
