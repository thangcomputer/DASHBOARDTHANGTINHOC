import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle2, AlertCircle, Phone, BookOpen, Lock, User, KeyRound, X, Copy, Check, MonitorX, MessageCircle, Clock,
  GraduationCap, Award, Headphones, LogIn, Monitor,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setTokens, clearOtherRoleSessions, ensureCsrfToken, API_BASE } from '../services/api';
import { unlockAudio } from '../utils/sound';
import NavArrow from './ui/NavArrow';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, limitPhoneInput, normalizePhone, PHONE_MAX_DIGITS } from '../utils/validators';
import {
  ADMIN_ZALO_PHONE,
  buildForgotPasswordZaloMessage,
  copyTextToClipboard,
  openAdminZalo,
} from '../utils/adminZaloContact';

const LOGIN_HIGHLIGHTS = [
  { label: 'Học mọi lúc', icon: BookOpen },
  { label: 'Thi chứng nhận', icon: Award },
  { label: 'Hỗ trợ tận tâm', icon: Headphones },
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
  const [deviceConflict, setDeviceConflict] = useState(false); // cảnh báo máy khác
  const pendingLoginRef = useRef(null); // lưu payload để force login
  const [dynamicLogo, setDynamicLogo] = useState('');

  // Hiển thị thông báo nếu bị đăng xuất do không hoạt động
  const inactivityMsg = new URLSearchParams(location.search).get('msg') === 'inactivity';


  // ── Forgot Password State ──
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1=nhập SĐT, 2=đã copy + mở Zalo
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotRole, setForgotRole] = useState('student');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotContact, setForgotContact] = useState(null); // { name, phone, role, message, copied }
  const [copied, setCopied] = useState(false);

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
    setLoading(true); setError(null);
    const id = normalizePhone(phone);
    if (!id || !isValidVNPhone(id)) {
      setError('Số điện thoại không hợp lệ (hỗ trợ 0... hoặc +84...)'); setLoading(false); return;
    }
    try {
      const fp = getDeviceFingerprint();
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/login/public`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ phone: id, password, role, deviceFingerprint: fp, force: forceDevice }),
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'DEVICE_CONFLICT') {
        // Tài khoản đang dùng ở máy khác → hiện cảnh báo
        pendingLoginRef.current = { phone, password, role };
        setDeviceConflict(true);
        return;
      }
      if (data.success) {
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
        setError(data.message || 'Bạn cần đăng ký và thanh toán khóa học mới để đăng nhập.');
        const q = new URLSearchParams({ reEnroll: '1' });
        if (p) q.set('phone', p);
        // Cho HV bấm ngay sang form đăng ký
        setTimeout(() => navigate(`/dangkykhoahoc?${q.toString()}`), 600);
      } else {
        setError(data.message || 'Số điện thoại hoặc mật khẩu không đúng');
      }
    } catch { setError('Không thể kết nối đến máy chủ'); }
    finally { setLoading(false); }
  };

  const handleLogin = (e) => { e.preventDefault(); doLogin(false); };
  const handleForceLogin = () => { setDeviceConflict(false); doLogin(true); };

  // Bước 1: Xác nhận SĐT → chuẩn bị tin nhắn (không tự mở Zalo)
  const handleCheckPhone = async () => {
    const p = normalizePhone(forgotPhone);
    if (!p) { setForgotError('Vui lòng nhập số điện thoại'); return; }
    if (!isValidVNPhone(p)) { setForgotError('Số điện thoại không hợp lệ'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/auth/forgot-password/request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ phone: p, role: forgotRole }),
      });
      const data = await res.json();

      if (!data.success) {
        setForgotError(data.message || 'Không gửi được yêu cầu. Thử lại sau.');
        return;
      }

      const accountName = '';
      const accountPhone = p;
      const message = buildForgotPasswordZaloMessage({
        name: accountName,
        phone: accountPhone,
        role: forgotRole,
      });
      setForgotContact({
        name: accountName,
        phone: accountPhone,
        role: forgotRole,
        message,
      });
      setForgotStep(2);
      setCopied(false);
      toast.success('Đã ghi nhận yêu cầu');
    } catch {
      setForgotError('Lỗi kết nối máy chủ');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCopyForgotMessage = async () => {
    if (!forgotContact?.message) return;
    const ok = await copyTextToClipboard(forgotContact.message);
    setCopied(ok);
    if (ok) toast.success('Đã copy tin nhắn');
    else toast.error('Không copy được - hãy bôi đen và Ctrl+C');
  };

  const handleOpenForgotZalo = () => {
    if (!forgotContact?.message) {
      openAdminZalo();
      return;
    }
    openAdminZalo(forgotContact.message);
  };

  const closeForgotModal = () => {
    setShowForgot(false);
    setForgotStep(1);
    setForgotPhone('');
    setForgotError('');
    setForgotContact(null);
    setCopied(false);
  };

  const forgotPhoneNormalized = normalizePhone(forgotPhone);
  const forgotConfirmLine = forgotPhoneNormalized && isValidVNPhone(forgotPhoneNormalized)
    ? `Xác nhận: ${forgotRole === 'teacher' ? 'Giảng viên' : 'Học viên'} · SĐT ${forgotPhoneNormalized}`
    : '';

  return (
    <div className="cms-login-bg relative min-h-[100dvh] flex items-center justify-center p-0 font-sans overflow-x-clip overflow-y-auto">
      <div className="cms-login-aura cms-login-aura--red" aria-hidden="true" />
      <div className="cms-login-aura cms-login-aura--blue" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden text-white/[0.05]" aria-hidden="true">
        <GraduationCap size={88} className="absolute left-[5%] top-[9%] -rotate-12" />
        <BookOpen size={72} className="absolute right-[6%] top-[28%] rotate-12" />
        <Award size={64} className="absolute bottom-[18%] left-[4%] rotate-6" />
        <Monitor size={76} className="absolute bottom-[6%] right-[9%] -rotate-6" />
      </div>
      <div className="relative z-10 w-full min-h-[100dvh] md:h-[100dvh] flex flex-col md:flex-row overflow-x-clip md:overflow-hidden">

        {/* CỘT TRÁI */}
        <div className="hidden md:flex md:w-1/2 p-10 lg:p-16 flex-col justify-center relative min-w-0">
          <div className="absolute top-10 left-10">
            <div className="cms-login-chip">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              <span>Hệ thống quản lý trực tuyến</span>
            </div>
          </div>
          <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-left-10 duration-1000">
            <h1 className="text-display font-black text-white break-anywhere">
              Nền tảng <span className="text-red-500 block md:inline">Học Tin Học</span> <br />Văn Phòng Chuyên Nghiệp
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-lg">Tổ chức đào tạo, thi cử và cấp chứng nhận tin học văn phòng với công nghệ hiện đại.</p>
            <div className="grid max-w-lg grid-cols-3 gap-3 pt-4">
              {LOGIN_HIGHLIGHTS.map((item) => (
                <div key={item.label} className="cms-login-highlight">
                  <span className="cms-login-highlight__icon"><item.icon size={17} aria-hidden="true" /></span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI */}
        <div className="w-full md:w-1/2 flex-1 flex flex-col px-[15px] py-6 sm:p-8 lg:py-10 lg:px-16 xl:py-14 xl:px-20 relative min-w-0 overflow-y-auto">
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
                  <GraduationCap size={14} aria-hidden="true" />
                  <span>Nền tảng học Tin học văn phòng</span>
                </div>
                <h2 className="text-fluid-2xl font-black text-white">Đăng nhập tài khoản</h2>
                <p className="text-sm text-slate-400 font-medium">Chào mừng trở lại! Vui lòng nhập thông tin của bạn.</p>
              </div>

              <div className="cms-login-roles" role="tablist" aria-label="Chọn vai trò đăng nhập">
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
                    className={`cms-login-role ${role === item.value ? 'is-active' : ''}`}
                  >
                    <item.icon size={16} aria-hidden="true" />
                    {item.label}
                    {role === item.value && <span className="cms-login-shine" aria-hidden="true" />}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5" noValidate>
                {inactivityMsg && (
                  <div role="status" className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-300 text-sm font-bold">
                    <Clock size={18} aria-hidden="true" /> Phiên làm việc đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.
                  </div>
                )}
                {error && (
                  <div role="alert" className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col gap-2 text-red-400 text-sm font-bold">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
                      <span>{error}</span>
                    </div>
                    {(String(error).includes('đăng ký') || String(error).includes('khóa học')) && (
                      <button
                        type="button"
                        onClick={() => {
                          const q = new URLSearchParams({ reEnroll: '1' });
                          if (phone) q.set('phone', normalizePhone(phone) || phone);
                          navigate(`/dangkykhoahoc?${q.toString()}`);
                        }}
                        className="mt-1 w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-black  tracking-wide hover:bg-red-500 transition inline-flex items-center justify-center gap-1"
                      >
                        Đăng ký / thanh toán khóa học
                        <NavArrow size={14} className="text-white" />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="login-identifier" className="text-xs font-bold text-slate-400 block ml-1">Số điện thoại</label>
                    <div className="cms-login-field group">
                      <User size={18} className="shrink-0 text-slate-400 group-focus-within:text-red-500 transition-colors" aria-hidden="true" />
                      <input id="login-identifier" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(limitPhoneInput(e.target.value))} autoComplete="tel" maxLength={PHONE_MAX_DIGITS + 1}
                        className="cms-login-input"
                        placeholder="VD: 0912345678" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="login-password" className="text-xs font-bold text-slate-400 block ml-1">Mật khẩu</label>
                    <div className="cms-login-field group">
                      <Lock size={18} className="shrink-0 text-slate-400 group-focus-within:text-red-500 transition-colors" aria-hidden="true" />
                      <input id="login-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                        className="cms-login-input"
                        placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="shrink-0 text-slate-400 hover:text-white transition-colors">
                        {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end -mt-2">
                  <button type="button" onClick={() => { setShowForgot(true); setForgotRole(role); setForgotStep(1); }}
                    className="text-xs font-bold text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
                    <KeyRound size={12} aria-hidden="true" /> Quên mật khẩu?
                  </button>
                </div>
                <button type="submit" disabled={loading} className="cms-login-submit">
                  <span className="cms-login-shine" aria-hidden="true" />
                  {loading
                    ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    : <><LogIn size={18} aria-hidden="true" /> Đăng nhập ngay</>}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-3 gap-2 md:hidden">
              {LOGIN_HIGHLIGHTS.map((item) => (
                <div key={item.label} className="cms-login-highlight">
                  <span className="cms-login-highlight__icon"><item.icon size={15} aria-hidden="true" /></span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="text-center animate-in fade-in duration-1000 delay-500">
              <p className="text-slate-400 text-sm font-medium">Chưa có tài khoản? <button type="button" onClick={() => window.open(`https://zalo.me/${ADMIN_ZALO_PHONE}`, '_blank', 'noopener,noreferrer')} className="text-white font-black hover:text-red-500 transition-colors ml-1">Liên hệ Admin</button></p>
              <div className="mt-5 flex flex-col items-center gap-1.5">
                <p className="text-xs font-black text-slate-500 tracking-widest">Hỗ trợ kỹ thuật</p>
                <p className="text-xs font-bold text-slate-400">Hotline: 093 5758 462</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODAL: QUÊN MẬT KHẨU ═══ */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><KeyRound size={20} className="text-white" /></div>
                <div>
                  <h3 className="text-white font-black text-lg">Quên mật khẩu</h3>
                  <p className="text-white/70 text-xs font-medium">
                    {forgotStep === 1 ? 'Nhập SĐT › xác nhận' : 'Tin nhắn đã sẵn - chỉ việc gửi'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeForgotModal} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition" aria-label="Đóng">
                <X size={16} className="text-white" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {forgotStep === 1 && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-400  block mb-2">Vai trò</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setForgotRole('student')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 ${forgotRole === 'student' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>Học viên</button>
                      <button type="button" onClick={() => setForgotRole('teacher')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 ${forgotRole === 'teacher' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>Giảng viên</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400  block mb-1.5">Số điện thoại đăng ký</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input type="tel" inputMode="tel" autoComplete="tel" value={forgotPhone} maxLength={PHONE_MAX_DIGITS + 1} onChange={e => { setForgotPhone(limitPhoneInput(e.target.value)); setForgotError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                        className="w-full bg-[#0f172a] border-2 border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm font-bold outline-none focus:border-red-500 transition placeholder:text-slate-400"
                        placeholder="VD: 0912345678" />
                    </div>
                  </div>

                  {forgotConfirmLine ? (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3">
                      <p className="text-[11px] font-bold text-emerald-400/80  tracking-wide mb-1">Dòng xác nhận</p>
                      <p className="text-sm font-bold text-emerald-200">{forgotConfirmLine}</p>
                      <p className="text-[11px] text-emerald-300/70 mt-1">Kiểm tra đúng vai trò &amp; SĐT rồi bấm Xác nhận.</p>
                    </div>
                  ) : (
                    <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3">
                      <p className="text-sky-300 text-xs font-bold leading-relaxed">
                        Nhập SĐT đăng ký - sẽ hiện dòng xác nhận trước khi tạo tin nhắn gửi Admin.
                      </p>
                    </div>
                  )}

                  {forgotError && <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 text-red-400 text-sm font-bold"><AlertCircle size={14} /> {forgotError}</div>}
                  <button type="button" onClick={handleCheckPhone} disabled={forgotLoading || !forgotConfirmLine}
                    className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black rounded-xl  tracking-wider text-sm hover:from-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {forgotLoading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><CheckCircle2 size={16} /> Xác nhận</>}
                  </button>
                </>
              )}

              {forgotStep === 2 && forgotContact && (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                      <CheckCircle2 size={28} className="text-emerald-400" />
                    </div>
                    <p className="text-white font-bold text-base">Đã ghi nhận yêu cầu</p>
                    <p className="text-gray-400 text-sm">
                      {forgotContact.role === 'teacher' ? 'Giảng viên' : 'Học viên'}:{' '}
                      <strong className="text-white font-mono">{forgotContact.phone}</strong>
                    </p>
                  </div>

                  <div className="bg-[#0f172a] border border-white/10 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-gray-500  mb-1.5">Nội dung tin nhắn</p>
                    <p className="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">{forgotContact.message}</p>
                  </div>

                  <div className={`rounded-xl p-3 text-xs font-bold ${copied ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-sky-500/10 border border-sky-500/20 text-sky-300'}`}>
                    {copied
                      ? '✓ Đã copy - mở Zalo Admin rồi dán (Ctrl+VN? / giữ để dán) và gửi.'
                      : '① Bấm Copy › ② Bấm Zalo Admin › dán tin nhắn và gửi.'}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyForgotMessage}
                      className={`py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${copied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/5 border border-white/15 text-white hover:bg-white/10'
                        }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Đã copy' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenForgotZalo}
                      className="py-3.5 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={16} /> Zalo Admin
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setForgotStep(1); setForgotError(''); setForgotContact(null); setCopied(false); }}
                    className="w-full py-3 border border-white/10 text-gray-400 font-bold rounded-xl hover:border-white/20 transition text-sm inline-flex items-center justify-center gap-1"
                  >
                    <NavArrow size={16} direction="back" className="text-gray-400" />
                    Quay lại
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
