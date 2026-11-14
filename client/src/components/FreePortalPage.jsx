import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Phone,
  Zap,
  Flame,
  BookOpen,
  Star,
  Trophy,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { ensureCsrfToken, API_BASE, setTokens, clearOtherRoleSessions } from '../services/api';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, isValidEmail, limitPhoneInput, normalizePhone } from '../utils/validators';
import { unlockAudio } from '../utils/sound';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23.1 10.1 24v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8v2.2h3.3l-.5 3.5h-2.8V24C19.6 23.1 24 18.1 24 12.1z" />
    </svg>
  );
}

/* Floating badges & decorative elements on hero panel */
function HeroDecorations() {
  return (
    <>
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-64 w-64 rounded-full opacity-60"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.3) 0%, transparent 70%)', animation: 'float1 9s ease-in-out infinite' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-12 -left-16 h-72 w-72 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)', animation: 'float2 11s ease-in-out infinite' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/3 h-40 w-40 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)', animation: 'float3 8s ease-in-out infinite' }}
        aria-hidden="true"
      />

      {/* Floating XP badge */}
      <div
        className="pointer-events-none absolute right-8 top-28 z-20 hidden xl:block"
        style={{ animation: 'float1 6s ease-in-out infinite', animationDelay: '0.4s' }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-white backdrop-blur-md border border-white/25 shadow-lg">
          <Zap size={13} className="text-amber-300 fill-amber-300" />
          <span className="text-xs font-black tracking-wide">+60 XP</span>
        </div>
      </div>

      {/* Floating streak badge */}
      <div
        className="pointer-events-none absolute right-16 top-1/2 z-20 hidden xl:block"
        style={{ animation: 'float2 7s ease-in-out infinite', animationDelay: '1.2s' }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-white backdrop-blur-md border border-white/25 shadow-lg">
          <Flame size={13} className="text-orange-400 fill-orange-400" />
          <span className="text-xs font-black tracking-wide">Streak 🔥</span>
        </div>
      </div>

      {/* Floating trophy */}
      <div
        className="pointer-events-none absolute right-10 bottom-24 z-20 hidden xl:block"
        style={{ animation: 'float3 8s ease-in-out infinite', animationDelay: '0.8s' }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-white backdrop-blur-md border border-white/25 shadow-lg">
          <Trophy size={13} className="text-yellow-300" />
          <span className="text-xs font-black tracking-wide">Top 10 BXH</span>
        </div>
      </div>
    </>
  );
}

/* Compact reusable input field */
function CompactField({ label, icon: Icon, type = 'text', value, onChange, placeholder, inputMode, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10.5px] sm:text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</label>
      <div className="group relative flex items-center">
        <Icon size={15} className="pointer-events-none absolute left-3.5 text-slate-500 transition group-focus-within:text-emerald-400" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputMode={inputMode}
          className="dewskill-input w-full rounded-xl border border-white/10 bg-[#0B1322]/90 py-2.5 pl-10 pr-10 text-xs sm:text-sm font-medium text-white placeholder:text-slate-500 outline-none ring-0 transition-all duration-150 focus:border-emerald-500 focus:bg-[#0E1729] focus:ring-4 focus:ring-emerald-500/15"
        />
        {children}
      </div>
    </div>
  );
}

export default function FreePortalPage({ onLogin }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialMode = searchParams.get('mode') === 'login' || searchParams.get('dangnhap') !== null ? 'login' : 'register';
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age] = useState('18');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceConflict, setDeviceConflict] = useState(false);
  const [socialReady, setSocialReady] = useState({ google: false, facebook: false });
  const [pending, setPending] = useState(null);
  const [flyInReady, setFlyInReady] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devOtpNotice, setDevOtpNotice] = useState('');
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('mode');
    if (m === 'login' || m === 'dangnhap') {
      setMode('login');
    } else if (m === 'register' || m === 'dangky') {
      setMode('register');
    }
  }, [location.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFlyInReady(true);
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.title = 'Vào luyện tập | DewSkill';
    const oldFavicon = document.getElementById('app-favicon')?.getAttribute('href') || '/favicon.svg';
    const favLink = document.getElementById('app-favicon') || document.querySelector("link[rel*='icon']");
    if (favLink) {
      favLink.setAttribute('type', 'image/png');
      favLink.setAttribute('href', `/brand/favicon.png?v=${Date.now()}`);
    }
    return () => {
      if (favLink) {
        favLink.setAttribute('type', 'image/svg+xml');
        favLink.setAttribute('href', oldFavicon);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/free-portal/social/status`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.success) setSocialReady(d.data || {}); })
      .catch(() => { });
    const params = new URLSearchParams(window.location.search);
    const socialError = params.get('socialError');
    const ticket = params.get('socialTicket');
    if (socialError) setError(socialError);
    if (ticket || socialError) window.history.replaceState({}, '', window.location.pathname);
    if (!ticket) return () => { cancelled = true; };
    setLoading(true);
    ensureCsrfToken().then(async (csrf) => {
      const response = await fetch(`${API_BASE}/auth/free-portal/social/exchange`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({ ticket, deviceFingerprint: getDeviceFingerprint() }),
      });
      const data = await response.json();
      if (cancelled) return;
      if (!data.success) { setError(data.message || 'Phiên mạng xã hội hết hạn'); return; }
      if (data.needsProfile) {
        setPending({ ticket: data.ticket, provider: data.provider });
        setName(data.name || '');
        if (data.email) setEmail(data.email);
        setMode('register');
        return;
      }
      acceptSession(data.data);
    }).catch(() => { if (!cancelled) setError('Không kết nối được máy chủ'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const acceptSession = (data) => {
    const user = data.user ? { ...data.user } : { ...data };
    const accessToken = data.accessToken || user.accessToken;
    const refreshToken = data.refreshToken || user.refreshToken;
    user.accessToken = accessToken;
    user.token = accessToken;
    user.refreshToken = refreshToken;
    if (!user.id && user._id) user.id = user._id;
    clearOtherRoleSessions('student');
    localStorage.setItem('student_user', JSON.stringify(user));
    setTokens(accessToken, refreshToken, 'student');
    unlockAudio();
    onLogin(user);
  };

  const login = async (forceDevice = false) => {
    const isForce = forceDevice === true;
    const rawContact = String(phone || '').trim();
    const normalized = normalizePhone(rawContact);
    const trimmedEmail = rawContact.toLowerCase();
    const isPhoneOk = Boolean(normalized && isValidVNPhone(normalized));
    const isEmailOk = isValidEmail(trimmedEmail);
    if (!isPhoneOk && !isEmailOk) { setError('Số điện thoại hoặc Gmail không hợp lệ'); return; }
    if (!password) { setError('Hãy nhập mật khẩu'); return; }
    const loginId = isPhoneOk ? normalized : trimmedEmail;
    setLoading(true); setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/login/public`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({ identifier: loginId, phone: loginId, password, role: 'student', deviceFingerprint: getDeviceFingerprint(), force: isForce }),
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'DEVICE_CONFLICT') { setDeviceConflict(true); return; }
      if (!data.success) { setError(data.message || 'Số điện thoại/Gmail hoặc mật khẩu không đúng'); return; }
      acceptSession(data.data);
    } catch { setError('Không kết nối được máy chủ'); } finally { setLoading(false); }
  };

  const handleLoginSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    login(false);
  };

  const finishSocial = async (event) => {
    event.preventDefault();
    const id = normalizePhone(phone);
    const parsedAge = Number(age);
    const trimmedEmail = email.trim().toLowerCase();
    if (name.trim().length < 2) { setError('Hãy nhập họ tên'); return; }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) { setError('Địa chỉ email không đúng định dạng'); return; }
    if (!Number.isInteger(parsedAge) || parsedAge < 10 || parsedAge > 80) { setError('Tuổi từ 10 đến 80'); return; }
    if (!id || !isValidVNPhone(id)) { setError('Số điện thoại không hợp lệ'); return; }
    setLoading(true); setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/free-portal/social/complete`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({ ticket: pending.ticket, name: name.trim(), age: parsedAge, phone: id, email: trimmedEmail || undefined, deviceFingerprint: getDeviceFingerprint() }),
      });
      const data = await response.json();
      if (!data.success) { setError(data.message || 'Chưa hoàn tất đăng ký'); return; }
      acceptSession(data.data);
    } catch { setError('Không kết nối được máy chủ'); } finally { setLoading(false); }
  };

  const handleRequestOtp = async (event) => {
    if (event) event.preventDefault();
    if (pending) { await finishSocial(event); return; }
    if (mode === 'login') { await login(false); return; }

    const rawContact = String(phone || '').trim();
    const id = normalizePhone(rawContact);
    const isPhoneOk = Boolean(id && isValidVNPhone(id));
    const trimmedEmail = rawContact.toLowerCase();
    const isEmailOk = isValidEmail(trimmedEmail);

    if (name.trim().length < 2) { setError('Hãy nhập họ và tên'); return; }
    if (!isPhoneOk && !isEmailOk) {
      setError('Hãy nhập số điện thoại hoặc Gmail hợp lệ (VD: 0912345678 hoặc vidu@gmail.com)');
      return;
    }
    if (password.length < 6) { setError('Mật khẩu cần ít nhất 6 ký tự'); return; }

    setLoading(true); setError(''); setDevOtpNotice(''); setOtpSuccessMsg('');
    try {
      const csrf = await ensureCsrfToken();

      if (isEmailOk) {
        setEmail(trimmedEmail);
        const response = await fetch(`${API_BASE}/auth/free-portal/send-otp`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
          body: JSON.stringify({ name: name.trim(), email: trimmedEmail, password }),
        });
        const data = await response.json();
        if (!data.success) {
          if (response.status === 409) {
            setMode('login');
            setPhone(trimmedEmail);
            setOtpStep(false);
          }
          setError(data.message || 'Chưa gửi được mã xác thực');
          return;
        }
        setOtpStep(true);
        setCountdown(45);
        if (data.devOtp) setDevOtpNotice(data.devOtp);
        setOtpSuccessMsg(data.message || `Mã xác thực đã được gửi tới ${trimmedEmail}`);
        return;
      }

      const regRes = await fetch(`${API_BASE}/auth/register-free`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({ name: name.trim(), age: 18, phone: id, password }),
      });
      const regData = await regRes.json();
      if (!regData.success) {
        if (regRes.status === 409) {
          setMode('login');
          setPhone(id);
          setOtpStep(false);
        }
        setError(regData.message || 'Không thể tạo tài khoản');
        return;
      }

      const loginRes = await fetch(`${API_BASE}/auth/login/public`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({ identifier: id, phone: id, password, role: 'student', deviceFingerprint: getDeviceFingerprint(), force: false }),
      });
      const loginData = await loginRes.json();
      if (!loginData.success) { setError(loginData.message || 'Đăng ký thành công, vui lòng đăng nhập.'); return; }
      acceptSession(loginData.data);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    const trimmedEmail = email.trim().toLowerCase();
    setLoading(true); setError(''); setDevOtpNotice(''); setOtpSuccessMsg('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/free-portal/resend-otp`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await response.json();
      if (!data.success) { setError(data.message || 'Chưa gửi lại được mã'); setLoading(false); return; }
      setCountdown(45);
      if (data.devOtp) setDevOtpNotice(data.devOtp);
      setOtpSuccessMsg(data.message || `Đã gửi lại mã mới tới ${trimmedEmail}`);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    if (event) event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim().replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Vui lòng nhập đủ 6 chữ số mã xác thực');
      return;
    }
    setLoading(true); setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/free-portal/verify-otp`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: JSON.stringify({
          email: trimmedEmail,
          otp: cleanOtp,
          deviceFingerprint: getDeviceFingerprint()
        }),
      });
      const data = await response.json();
      if (!data.success) { setError(data.message || 'Mã xác thực không chính xác'); setLoading(false); return; }
      acceptSession(data.data);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const startSocial = (provider) => {
    if (!socialReady[provider]) {
      setError(provider === 'google' ? 'Chưa cấu hình đăng nhập Google.' : 'Chưa cấu hình đăng nhập Facebook.');
      return;
    }
    const origin = API_BASE.startsWith('http')
      ? API_BASE.replace(/\/api$/, '')
      : (window.location.port === '5173' ? 'http://127.0.0.1:5000' : window.location.origin);
    window.location.href = `${origin}/api/auth/free-portal/${provider}`;
  };

  const landingUrl = window.location.port === '5173' ? 'http://localhost:3100' : 'https://giasutinhoc24h.com';
  const isRegister = mode === 'register';

  return (
    <>
      {/* Refined fly-in & floating keyframes */}
      <style>{`
        .panel-slide {
          transition: transform 0.95s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s ease-out;
          will-change: transform, opacity;
        }
        @keyframes float1 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-14px) rotate(2.5deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-10px) rotate(-2deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0px) rotate(0deg)} 33%{transform:translateY(-8px) rotate(1.5deg)} 66%{transform:translateY(6px) rotate(-1deg)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        
        .btn-shimmer:not(:disabled):hover {
          box-shadow: 0 10px 28px -4px rgba(16,185,129,0.5);
        }
        .dewskill-input:-webkit-autofill,
        .dewskill-input:-webkit-autofill:hover,
        .dewskill-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0b1322 inset !important;
          -webkit-text-fill-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .dewskill-tab:focus,
        .dewskill-tab:focus-visible {
          outline: none !important;
        }
      `}</style>

      {/* Main container: Unified deep navy + emerald aurora canvas, fit 100dvh */}
      <div
        className="relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden font-sans text-white selection:bg-emerald-400/20"
        style={{
          background:
            'radial-gradient(circle at 18% 20%, rgba(16, 185, 129, 0.20) 0%, transparent 45%), radial-gradient(circle at 85% 82%, rgba(14, 165, 233, 0.16) 0%, transparent 45%), linear-gradient(155deg, #09111E 0%, #0F172A 55%, #0B192C 100%)',
        }}
      >
        {/* Subtle unified tech dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.26) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
          aria-hidden="true"
        />
        {/* Subtle orbital rings */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full border border-emerald-400/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-[28rem] w-[28rem] rounded-full border border-cyan-400/10" aria-hidden="true" />

        {/* Global top-left Back to Home button */}
        <a
          href={landingUrl}
          className="absolute left-4 top-4 sm:left-6 sm:top-6 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-emerald-200 backdrop-blur-md transition hover:bg-white/15 hover:text-white active:scale-95 cursor-pointer outline-none"
        >
          <ArrowLeft size={13} />
          <span>Trang chủ</span>
        </a>

        {/* Two-panel split layout: 50% / 50% */}
        <div className="relative z-10 flex h-full flex-col lg:flex-row">

          {/* ═══════════════════════════════════════════════════
              LEFT HERO PANEL (Minimal, clean, desktop only)
          ═══════════════════════════════════════════════════ */}
          <div
            className={`panel-slide relative hidden lg:flex flex-col justify-between overflow-hidden lg:h-full lg:w-[50%] lg:px-12 xl:px-16 lg:py-8 ${flyInReady ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
              }`}
          >
            {/* Spacer for top-left Back to Home button */}
            <div className="h-8" />

            {/* 2. Clean Hero Content (Center) */}
            <div className="relative z-10 my-auto max-w-lg py-4 free-portal-autoscale-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                DewSkill • Học thử miễn phí
              </div>

              <h1 className="mb-4 text-[34px] xl:text-[40px] font-black leading-[1.24] tracking-tight text-white">
                Luyện tin học mỗi ngày,{' '}
                <span className="text-emerald-400">nâng trình vượt bậc.</span>
              </h1>

              <p className="mb-7 text-sm font-medium leading-relaxed text-slate-300">
                Chỉ 5–10 phút mỗi ngày với bài tập tình huống Word, Excel, PowerPoint thực tế để tích lũy XP và làm chủ kỹ năng văn phòng.
              </p>

              <div className="space-y-3">
                {[
                  'Bài tập tình huống thực tế chuẩn văn phòng',
                  'Tích lũy XP, giữ chuỗi Streak & thi thử chứng chỉ',
                  'Miễn phí 100%, bắt đầu học ngay trong 60 giây',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30">
                      <CheckCircle2 size={14} />
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Footer inside Left Panel */}
            <div className="relative z-10 pt-2 text-[11px] text-slate-400/80">
              © 2026 DewSkill • Phát triển bởi Thắng Tin Học
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              RIGHT FORM PANEL (Sleek dark glass card)
          ═══════════════════════════════════════════════════ */}
          <div
            className={`panel-slide relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-3 sm:px-6 sm:py-5 lg:h-full lg:w-[50%] lg:px-8 xl:px-12 ${flyInReady ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
              }`}
          >
            {/* Anchored DewSkill Logo directly above the Form Card (Desktop & Mobile) */}
            <div className="relative z-10 mb-3 flex w-full max-w-[420px] items-center justify-center">
              <a
                href={landingUrl}
                className="inline-flex items-center rounded-2xl bg-white px-5 py-2 shadow-lg shadow-black/30 transition hover:scale-[1.02]"
                title="Về trang chủ DewSkill"
              >
                <img
                  src="/brand/logo.webp"
                  alt="DewSkill"
                  className="h-8 sm:h-9 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/brand/favicon.png';
                  }}
                />
              </a>
            </div>

            {/* Form Card Container */}
            <div
              ref={formRef}
              className={`free-portal-autoscale-right relative z-10 w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#131E33]/90 backdrop-blur-xl p-4 sm:p-6 shadow-[0_25px_65px_-15px_rgba(0,0,0,0.55)] transition-all duration-700 ease-out delay-100 ${flyInReady ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'
                }`}
            >
              {/* Header */}
              <div className="mb-3 text-center">
                <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-300 ring-1 ring-emerald-400/25">
                  <Sparkles size={11} className="text-emerald-400" />
                  {otpStep ? 'Bảo mật tài khoản' : pending ? 'Bước cuối cùng' : 'Tài khoản học thử miễn phí'}
                </div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {otpStep
                    ? 'Nhập mã xác thực'
                    : pending
                      ? 'Hoàn tất hồ sơ'
                      : isRegister
                        ? 'Tạo tài khoản ngay'
                        : 'Đăng nhập học tập'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {otpStep
                    ? 'Mã bảo mật 6 chữ số đã được gửi về Gmail của bạn'
                    : pending
                      ? 'Liên kết mạng xã hội thành công! Vui lòng bổ sung thông tin.'
                      : isRegister
                        ? 'Đăng ký miễn phí nhanh trong 60 giây'
                        : 'Tiếp tục chuỗi học tập và luyện thi của bạn'}
                </p>
              </div>

              {/* Social Login Buttons (Google / Facebook) - Ẩn khi đang xác thực OTP */}
              {!pending && !otpStep && (
                <div className="mb-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => startSocial('google')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98] cursor-pointer outline-none"
                    >
                      <GoogleIcon />
                      <span>Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startSocial('facebook')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98] cursor-pointer outline-none"
                    >
                      <FacebookIcon />
                      <span>Facebook</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="font-semibold">hoặc dùng số điện thoại / Gmail</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </div>
              )}

              {/* Mode switch tabs: Đăng ký / Đăng nhập - Ẩn khi đang xác thực OTP */}
              {!pending && !otpStep && (
                <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-[#0B1322] p-1 border border-white/10">
                  {[
                    { id: 'register', label: 'Đăng ký mới' },
                    { id: 'login', label: 'Đăng nhập' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { setMode(tab.id); setError(''); }}
                      className={`dewskill-tab rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${mode === tab.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════
                  MÀN HÌNH NHẬP MÃ OTP GMAIL (Xác minh người dùng thật)
              ═══════════════════════════════════════════════════ */}
              {otpStep ? (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  {/* Hộp thông báo email nhận mã */}
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-center">
                    <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                      <Mail size={18} />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-300">
                      Mã xác thực 6 chữ số đã được gửi tới:
                    </p>
                    <p className="mt-0.5 text-xs sm:text-sm font-black text-emerald-300 break-all">
                      {email}
                    </p>
                  </div>

                  {/* Banner mã thử nghiệm trong môi trường DEV (Click để điền tự động) */}
                  {devOtpNotice && (
                    <div
                      onClick={() => setOtpCode(devOtpNotice)}
                      className="group flex items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 cursor-pointer transition hover:bg-amber-500/15"
                      title="Nhấn để tự động điền mã thử nghiệm"
                    >
                      <span>Mã thử nghiệm (Dev): <strong className="font-mono text-sm tracking-widest text-amber-300">{devOtpNotice}</strong></span>
                      <span className="text-[10px] font-bold text-amber-300 underline group-hover:text-amber-200">Điền nhanh</span>
                    </div>
                  )}

                  {/* Ô nhập mã OTP 6 số */}
                  <div className="space-y-1">
                    <label className="block text-center text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                      Nhập mã 6 chữ số
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound size={16} className="pointer-events-none absolute left-3.5 text-slate-500" />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        className="w-full rounded-2xl border-2 border-emerald-500/40 bg-[#0B1322] py-2 pl-9 pr-3 text-center font-mono text-2xl font-black tracking-[0.4em] text-white outline-none ring-0 transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Thông báo thành công khi gửi lại mã */}
                  {otpSuccessMsg && !error && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      <span>{otpSuccessMsg}</span>
                    </div>
                  )}

                  {/* Thông báo lỗi */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-rose-300">
                      <span className="shrink-0 text-rose-400 font-bold">⚠</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Nút bấm xác nhận */}
                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="btn-shimmer relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                    style={{
                      background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                    }}
                  >
                    <Lock size={14} />
                    <span>{loading ? 'Đang xác thực…' : 'Xác nhận & Vào học ngay'}</span>
                  </button>

                  {/* Thao tác phụ: Gửi lại mã / Đổi email khác */}
                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => { setOtpStep(false); setError(''); }}
                      className="font-bold text-slate-500 hover:text-slate-800 hover:underline transition cursor-pointer"
                    >
                      ← Đổi email khác
                    </button>

                    <button
                      type="button"
                      disabled={countdown > 0 || loading}
                      onClick={handleResendOtp}
                      className="inline-flex items-center gap-1 font-extrabold text-emerald-700 hover:text-emerald-800 hover:underline transition disabled:opacity-50 disabled:no-underline cursor-pointer"
                    >
                      {countdown > 0 ? (
                        <span>Gửi lại sau ({countdown}s)</span>
                      ) : (
                        <>
                          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                          <span>Gửi lại mã</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Form Body thông thường */
                <form onSubmit={isRegister ? handleRequestOtp : handleLoginSubmit} className="space-y-2 sm:space-y-2.5">
                  {(isRegister || pending) && (
                    <CompactField
                      label="Họ và tên"
                      icon={User}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                    />
                  )}

                  {pending && (
                    <CompactField
                      label="Gmail / Email"
                      icon={Mail}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vidu@gmail.com"
                    />
                  )}

                  <CompactField
                    label={pending ? 'Số điện thoại' : 'Số điện thoại hoặc Gmail'}
                    icon={Phone}
                    inputMode={pending ? 'numeric' : 'email'}
                    value={phone}
                    onChange={(e) => setPhone(pending ? limitPhoneInput(e.target.value) : e.target.value)}
                    placeholder={pending ? '0912 345 678' : '0912345678 hoặc vidu@gmail.com'}
                  />

                  {!pending && (
                    <CompactField
                      label="Mật khẩu"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                    >
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 text-slate-400 transition hover:text-white cursor-pointer"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </CompactField>
                  )}

                  {/* Error message */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-rose-300">
                      <span className="shrink-0 text-rose-400 font-bold">⚠</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Device conflict alert */}
                  {deviceConflict && (
                    <button
                      type="button"
                      onClick={() => login(true)}
                      className="w-full rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
                    >
                      Tài khoản mở ở máy khác — đăng nhập tại đây
                    </button>
                  )}

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-shimmer relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md transition-all duration-200 disabled:opacity-60 cursor-pointer active:scale-[0.98]"
                    style={{
                      background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                        backgroundSize: '200% auto',
                        animation: loading ? 'none' : 'shimmer 2.2s linear infinite',
                      }}
                      aria-hidden="true"
                    />
                    <Lock size={14} />
                    <span>
                      {loading
                        ? 'Đang gửi mã…'
                        : pending
                          ? 'Hoàn tất hồ sơ'
                          : isRegister
                            ? 'Tạo tài khoản miễn phí'
                            : 'Đăng nhập ngay'}
                    </span>
                  </button>
                </form>
              )}

              {/* Bottom Assurance */}
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                <span>Bảo mật an toàn 100% • Không yêu cầu thẻ ngân hàng</span>
              </div>
            </div>

            {/* Lối tắt dành cho học viên đăng ký theo khóa chính thức */}
            <div className="relative z-10 mt-2.5 text-center text-xs text-slate-300">
              <span>Học viên học theo khóa? </span>
              <a
                href="/login"
                className="font-extrabold text-emerald-400 hover:text-emerald-300 hover:underline transition inline-flex items-center gap-1"
              >
                Đăng nhập LMS tại đây →
              </a>
            </div>
            <div className="relative z-10 mt-1 text-center text-[11px] text-slate-400/80 lg:hidden">
              © 2026 DewSkill • Phát triển bởi Thắng Tin Học
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
