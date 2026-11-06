import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, User, Calendar, Flame, Route } from 'lucide-react';
import { ensureCsrfToken, API_BASE, setTokens, clearOtherRoleSessions } from '../services/api';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, limitPhoneInput, normalizePhone } from '../utils/validators';
import { unlockAudio } from '../utils/sound';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
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

  return (
    <div className="cms-login-bg relative min-h-[100dvh] overflow-x-clip overflow-y-auto font-sans">
      <div className="cms-login-aura cms-login-aura--red" aria-hidden="true" />
      <div className="cms-login-aura cms-login-aura--blue" aria-hidden="true" />
      <div className="relative z-10 flex min-h-[100dvh] flex-col md:flex-row">
        <section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-white to-amber-50 px-6 py-8 md:w-1/2 md:px-12 lg:px-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-200/70 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-amber-200/80 blur-3xl" aria-hidden="true" />
          <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
            Luyện tập hằng ngày
          </div>
          <h1 className="mt-6 max-w-xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Luyện tin học mỗi ngày, <span className="text-red-600">chuyên nghiệp hơn</span> mỗi tuần
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
            Dành cho người đi làm và người mới bắt đầu. Mỗi ngày một lượt ngắn: xem bài, trả lời câu hỏi, giữ chuỗi để kiến thức văn phòng nằm lòng.
          </p>
          <div className="mt-6 grid max-w-lg grid-cols-3 gap-3">
            {[
              { icon: Calendar, label: 'Mỗi ngày một lượt' },
              { icon: Flame, label: 'Giữ chuỗi luyện' },
              { icon: Route, label: 'Lộ trình rõ việc' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-red-100 bg-white px-2 py-3 text-center shadow-sm">
                <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600"><item.icon size={16} aria-hidden="true" /></span>
                <span className="block text-[11px] font-bold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-4 py-8 md:w-1/2 md:px-8">
          <form onSubmit={register} className="w-full max-w-md space-y-5">
            <div className="flex justify-center">
              <div className="cms-login-logo">
                <img src="/logo-thang-tin-hoc.svg" alt="Thắng Tin Học" className="h-11 max-w-[200px] object-contain sm:h-12" />
                <span className="cms-login-shine" aria-hidden="true" />
              </div>
            </div>
            <div className="cms-login-card space-y-4 px-5 py-6 sm:px-7 sm:py-8">
              <div className="space-y-2 text-center">
                <div className="cms-login-chip mx-auto">
                  <span>Tài khoản miễn phí</span>
                </div>
                <h2 className="text-2xl font-black text-white">{pending ? 'Hoàn tất đăng ký' : 'Vào luyện tập'}</h2>
                <p className="text-sm font-medium text-slate-400">
                  {pending
                    ? 'Google hoặc Facebook đã xác nhận. Nhập tuổi và số điện thoại để hoàn tất.'
                    : 'Đăng ký bằng họ tên, tuổi, số điện thoại và mật khẩu. Hoặc dùng Google, Facebook.'}
                </p>
              </div>
              {!pending && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => startSocial('google')} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-3 py-2.5 text-sm font-black text-slate-800 !shadow-none">
                    <GoogleIcon /> Google
                  </button>
                  <button type="button" onClick={() => startSocial('facebook')} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-3 py-2.5 text-sm font-black text-slate-800 !shadow-none">
                    <FacebookIcon /> Facebook
                  </button>
                </div>
              )}
              {!pending && (
                <div className="cms-login-roles" role="tablist" aria-label="Đăng ký hoặc đăng nhập">
                  <button type="button" onClick={() => { setMode('register'); setError(''); }} className={`cms-login-role ${mode === 'register' ? 'is-active' : ''}`}>Đăng ký</button>
                  <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`cms-login-role ${mode === 'login' ? 'is-active' : ''}`}>Đăng nhập</button>
                </div>
              )}
              {(mode === 'register' || pending) && (
                <label className="block space-y-1.5">
                  <span className="ml-1 block text-xs font-bold text-slate-400">Họ tên</span>
                  <span className="cms-login-field">
                    <User size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <input value={name} onChange={(e) => setName(e.target.value)} className="cms-login-input" placeholder="Nguyễn Văn A" />
                  </span>
                </label>
              )}
              {(mode === 'register' || pending) && (
                <label className="block space-y-1.5">
                  <span className="ml-1 block text-xs font-bold text-slate-400">Tuổi</span>
                  <span className="cms-login-field">
                    <Calendar size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <input value={age} inputMode="numeric" onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))} className="cms-login-input" placeholder="18" />
                  </span>
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="ml-1 block text-xs font-bold text-slate-400">Số điện thoại</span>
                <span className="cms-login-field">
                  <User size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <input value={phone} inputMode="numeric" onChange={(e) => setPhone(limitPhoneInput(e.target.value))} className="cms-login-input" placeholder="VD: 0912345678" />
                </span>
              </label>
              {!pending && (
                <label className="block space-y-1.5">
                  <span className="ml-1 block text-xs font-bold text-slate-400">Mật khẩu</span>
                  <span className="cms-login-field">
                    <Lock size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="cms-login-input" placeholder="Ít nhất 6 ký tự" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-slate-400 !shadow-none" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              )}
              {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">{error}</p>}
              {deviceConflict && (
                <button type="button" onClick={() => login(true)} className="w-full rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-bold text-amber-200 !shadow-none">
                  Tài khoản đang mở ở máy khác. Đăng nhập trên máy này
                </button>
              )}
              <button type="submit" disabled={loading} className="cms-login-submit">
                <span className="cms-login-shine" aria-hidden="true" />
                <Lock size={16} aria-hidden="true" />
                {loading ? 'Đang xử lý…' : pending ? 'Hoàn tất đăng ký' : mode === 'register' ? 'Tạo tài khoản miễn phí' : 'Đăng nhập ngay'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
