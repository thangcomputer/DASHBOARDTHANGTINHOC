import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Calendar,
  Flame,
  Route,
  Zap,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Phone,
} from 'lucide-react';
import { ensureCsrfToken, API_BASE, setTokens, clearOtherRoleSessions } from '../services/api';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, limitPhoneInput, normalizePhone } from '../utils/validators';
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

export default function FreePortalPage({ onLogin }) {
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceConflict, setDeviceConflict] = useState(false);
  const [socialReady, setSocialReady] = useState({ google: false, facebook: false });
  const [pending, setPending] = useState(null);

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

  useEffect(() => {
    document.title = 'Vào luyện tập | DewSkill';
    let cancelled = false;
    fetch(`${API_BASE}/auth/free-portal/social/status`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.success) setSocialReady(data.data || {});
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const socialError = params.get('socialError');
    const ticket = params.get('socialTicket');
    if (socialError) setError(socialError);
    if (ticket || socialError) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (!ticket) return undefined;
    setLoading(true);
    ensureCsrfToken().then(async (csrf) => {
      const response = await fetch(`${API_BASE}/auth/free-portal/social/exchange`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ ticket, deviceFingerprint: getDeviceFingerprint() }),
      });
      const data = await response.json();
      if (cancelled) return;
      if (!data.success) {
        setError(data.message || 'Phiên mạng xã hội hết hạn');
        return;
      }
      if (data.needsProfile) {
        setPending({ ticket: data.ticket, provider: data.provider });
        setName(data.name || '');
        setMode('register');
        return;
      }
      acceptSession(data.data);
    }).catch(() => {
      if (!cancelled) setError('Không kết nối được máy chủ');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const login = async (forceDevice = false) => {
    const id = normalizePhone(phone);
    if (!id || !isValidVNPhone(id)) {
      setError('Số điện thoại không hợp lệ');
      return;
    }
    if (!password) {
      setError('Hãy nhập mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/login/public`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          phone: id,
          password,
          role: 'student',
          deviceFingerprint: getDeviceFingerprint(),
          force: forceDevice,
        }),
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'DEVICE_CONFLICT') {
        setDeviceConflict(true);
        return;
      }
      if (!data.success) {
        setError(data.message || 'Số điện thoại hoặc mật khẩu không đúng');
        return;
      }
      acceptSession(data.data);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const finishSocial = async (event) => {
    event.preventDefault();
    const id = normalizePhone(phone);
    const parsedAge = Number(age);
    if (name.trim().length < 2) {
      setError('Hãy nhập họ tên');
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < 10 || parsedAge > 80) {
      setError('Tuổi từ 10 đến 80');
      return;
    }
    if (!id || !isValidVNPhone(id)) {
      setError('Số điện thoại không hợp lệ');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/free-portal/social/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          ticket: pending.ticket,
          name: name.trim(),
          age: parsedAge,
          phone: id,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || 'Chưa hoàn tất đăng ký');
        return;
      }
      acceptSession(data.data);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const register = async (event) => {
    event.preventDefault();
    if (pending) {
      await finishSocial(event);
      return;
    }
    if (mode === 'login') {
      await login(false);
      return;
    }
    const id = normalizePhone(phone);
    const parsedAge = Number(age);
    if (name.trim().length < 2) {
      setError('Hãy nhập họ tên');
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < 10 || parsedAge > 80) {
      setError('Tuổi từ 10 đến 80');
      return;
    }
    if (!id || !isValidVNPhone(id)) {
      setError('Số điện thoại không hợp lệ');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/register-free`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ name: name.trim(), age: parsedAge, phone: id, password }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || 'Chưa tạo được tài khoản');
        setLoading(false);
        return;
      }
    } catch {
      setError('Không kết nối được máy chủ');
      setLoading(false);
      return;
    }
    setLoading(false);
    await login(false);
  };

  const startSocial = (provider) => {
    if (!socialReady[provider]) {
      setError(provider === 'google'
        ? 'Chưa cấu hình đăng nhập Google. Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.'
        : 'Chưa cấu hình đăng nhập Facebook. Thêm FACEBOOK_APP_ID và FACEBOOK_APP_SECRET.');
      return;
    }
    const origin = API_BASE.startsWith('http') ? API_BASE.replace(/\/api$/, '') : 'http://127.0.0.1:5000';
    window.location.href = `${origin}/api/auth/free-portal/${provider}`;
  };

  const landingUrl = window.location.port === '5173' ? 'http://localhost:3100' : '/';

  return (
    <div className="relative min-h-[100dvh] bg-[#f4fbf8] text-slate-900 font-sans selection:bg-emerald-500/20 flex flex-col justify-between overflow-x-clip">
      {/* Background ambient lighting matching DewSkill landing theme */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-teal-200/35 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl" aria-hidden="true" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full border-b border-emerald-100/70 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <a href={landingUrl} className="flex items-center gap-2 group transition" title="Trang chủ DewSkill">
            <img
              src="/brand/logo-horizontal.png"
              alt="DewSkill"
              className="h-8 sm:h-9 w-auto max-w-[150px] sm:max-w-[180px] object-contain transition group-hover:opacity-90"
              onError={(e) => {
                // If horizontal logo fails, show fallback badge & text
                e.target.style.display = 'none';
                const sibling = e.target.nextElementSibling;
                if (sibling) sibling.style.display = 'flex';
              }}
            />
            <span style={{ display: 'none' }} className="items-center gap-1.5 text-xl font-black tracking-tight text-slate-800">
              <span className="text-emerald-600">💧</span> Dew<span className="text-emerald-600">Skill</span>
            </span>
          </a>

          <a
            href={landingUrl}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-50 hover:text-emerald-900 active:scale-95"
          >
            <ArrowLeft size={16} />
            <span>Về trang chủ</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:gap-14 lg:px-8 lg:py-10">
        {/* Left Column: Brand & Gamified Learning Pitch (order-2 on mobile, order-1 on desktop) */}
        <section className="order-2 lg:order-1 flex flex-1 flex-col justify-center space-y-5 lg:max-w-xl">
          {/* Badge */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3.5 py-1.5 text-xs font-black text-emerald-800 shadow-xs backdrop-blur-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            <span>DewSkill • Cổng luyện tập hằng ngày</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Luyện tin học mỗi ngày,{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
              nâng trình vượt bậc
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base font-medium leading-relaxed text-slate-600">
            Học tập theo mô hình game hóa: 5-10 phút mỗi ngày, thực hành bài tập tình huống thực tế, duy trì chuỗi ngọn lửa Streak và tích lũy XP thăng cấp.
          </p>

          {/* Mascot Companion Box */}
          <div className="flex items-center gap-3.5 rounded-3xl border border-emerald-100 bg-white/80 p-3.5 sm:p-4 shadow-sm backdrop-blur-xs">
            <img
              src="/mascot/tot-nghiep-vui-ve.gif"
              alt="Mascot DewSkill"
              className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 object-contain drop-shadow-sm"
              onError={(e) => {
                e.target.src = '/brand/favicon.png';
              }}
            />
            <div className="text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 font-black text-emerald-800">
                <Sparkles size={14} className="text-emerald-600 shrink-0" />
                <span>Trợ lý học tập Dewy</span>
              </div>
              <p className="mt-0.5 text-slate-600">
                Đăng ký tài khoản miễn phí để nhận ngay <strong className="text-emerald-700 font-black">+60 XP</strong> chào mừng và mở khóa các chặng học tin học đầu tiên!
              </p>
            </div>
          </div>

          {/* 3 Feature Value Props */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/70 bg-white/70 p-3.5 shadow-xs backdrop-blur-xs transition hover:border-emerald-200 hover:bg-white">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Zap size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Mỗi ngày 1 lượt</h4>
                <p className="text-[11px] leading-tight text-slate-500 mt-0.5">Lý thuyết ngắn gọn, làm bài trắc nghiệm & AI chấm ngay</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/70 bg-white/70 p-3.5 shadow-xs backdrop-blur-xs transition hover:border-emerald-200 hover:bg-white">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Flame size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Giữ chuỗi Streak</h4>
                <p className="text-[11px] leading-tight text-slate-500 mt-0.5">Duy trì phản xạ tin học hằng ngày không lo ngắt quãng</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/70 bg-white/70 p-3.5 shadow-xs backdrop-blur-xs transition hover:border-emerald-200 hover:bg-white">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Route size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Lộ trình bài bản</h4>
                <p className="text-[11px] leading-tight text-slate-500 mt-0.5">Word, Excel, PowerPoint chuẩn công sở thực chiến</p>
              </div>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs font-semibold text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              100% tài khoản học thử miễn phí
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              Không cần thẻ ngân hàng
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              Bảo mật tài khoản an toàn
            </span>
          </div>
        </section>

        {/* Right Column: Clean, Professional Auth Card (order-1 on mobile, order-2 on desktop) */}
        <section className="order-1 lg:order-2 w-full max-w-md lg:max-w-[430px]">
          <div className="relative rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur-md sm:p-7">
            {/* Card Brand Header */}
            <div className="text-center space-y-1.5 mb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                <Sparkles size={13} className="text-emerald-600 shrink-0" />
                <span>{pending ? 'Bước cuối cùng' : 'Tài khoản miễn phí'}</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {pending ? 'Hoàn tất hồ sơ' : mode === 'register' ? 'Vào luyện tập ngay' : 'Đăng nhập học tập'}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                {pending
                  ? 'Liên kết mạng xã hội thành công! Nhập thông tin để hoàn tất.'
                  : mode === 'register'
                  ? 'Đăng ký nhanh bằng số điện thoại hoặc mạng xã hội'
                  : 'Nhập số điện thoại và mật khẩu để tiếp tục chặng học'}
              </p>
            </div>

            {/* Social Logins */}
            {!pending && (
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => startSocial('google')}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50/30 active:scale-95 cursor-pointer"
                  >
                    <GoogleIcon />
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startSocial('facebook')}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50/30 active:scale-95 cursor-pointer"
                  >
                    <FacebookIcon />
                    <span>Facebook</span>
                  </button>
                </div>

                <div className="relative flex items-center justify-center text-xs text-slate-400">
                  <div className="w-full border-t border-slate-200" />
                  <span className="absolute bg-white px-3 font-semibold text-slate-400">
                    hoặc số điện thoại
                  </span>
                </div>
              </div>
            )}

            {/* Segmented Mode Tabs (Register / Login) */}
            {!pending && (
              <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-xs sm:text-sm font-bold" role="tablist">
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); }}
                  className={`rounded-xl py-2 transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Đăng ký mới
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); }}
                  className={`rounded-xl py-2 transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Đăng nhập
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={register} className="space-y-3">
              {(mode === 'register' || pending) && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 ml-1">Họ và tên</label>
                  <div className="relative flex items-center">
                    <User size={18} className="pointer-events-none absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>
              )}

              {(mode === 'register' || pending) && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 ml-1">Tuổi</label>
                  <div className="relative flex items-center">
                    <Calendar size={18} className="pointer-events-none absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={age}
                      onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="Ví dụ: 18"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 ml-1">Số điện thoại</label>
                <div className="relative flex items-center">
                  <Phone size={18} className="pointer-events-none absolute left-3.5 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(limitPhoneInput(e.target.value))}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              {!pending && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 ml-1">Mật khẩu</label>
                  <div className="relative flex items-center">
                    <Lock size={18} className="pointer-events-none absolute left-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-11 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 animate-in fade-in">
                  {error}
                </div>
              )}

              {/* Device Conflict */}
              {deviceConflict && (
                <button
                  type="button"
                  onClick={() => login(true)}
                  className="w-full rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 cursor-pointer"
                >
                  Tài khoản đang mở ở máy khác. Bấm để đăng nhập trên máy này
                </button>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 py-3.5 px-6 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-600/25 transition-all hover:shadow-emerald-600/35 hover:from-emerald-600 hover:to-teal-700 active:scale-98 disabled:opacity-60 cursor-pointer"
              >
                <Lock size={16} />
                <span>
                  {loading
                    ? 'Đang xử lý…'
                    : pending
                    ? 'Hoàn tất đăng ký'
                    : mode === 'register'
                    ? 'Tạo tài khoản miễn phí'
                    : 'Đăng nhập ngay'}
                </span>
              </button>
            </form>

            {/* Card Footer Assurance */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-slate-400">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span>Bảo mật 100% • Không yêu cầu thẻ thanh toán</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-emerald-100/60 py-3.5 text-center text-xs font-medium text-slate-500">
        <p>© 2026 DewSkill - Nền tảng tự học tin học thế hệ mới</p>
      </footer>
    </div>
  );
}
