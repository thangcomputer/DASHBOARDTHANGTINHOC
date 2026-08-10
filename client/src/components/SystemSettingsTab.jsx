/**
 * SystemSettingsTab.jsx
 * Trang Cài đặt hệ thống cho Admin — 3 tab:
 *  1. Tài khoản thu học phí (ngân hàng trung tâm)
 *  2. Quản lý Popup thông báo
 *  3. Học phí Khóa học (Price catalog)
 */


import { useState, useEffect, useRef } from 'react';
import {
  Settings, CreditCard, Bell, Save, Loader2, Eye,
  Upload, Users, GraduationCap, ToggleLeft,
  ToggleRight, Landmark, X,
  DollarSign, Building2, Lock, User, KeyRound, EyeOff, CheckCircle2, FileText,
  ShieldCheck, Briefcase,
} from 'lucide-react';
import { BankSelect } from './BankSelect';
import api, { resolveMediaUrl } from '../services/api';
import { useToast } from '../utils/toast';
import CoursePricingTab from './CoursePricingTab';
import BranchManagementTab from './BranchManagementTab';
import WebSettingsTab from './WebSettingsTab';
import SystemResetModal from './SystemResetModal';
import { AlertOctagon } from 'lucide-react';

// ── Tuition QR Preview ────────────────────────────────────────────────────────
function TuitionQRPreview({ settings, compact = false }) {
  const { centerBankCode, centerBankAccountNumber, centerBankAccountName } = settings;
  if (!centerBankCode || !centerBankAccountNumber) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-center px-3 ${compact ? 'min-h-[140px]' : 'min-h-[160px]'}`}>
        <p className="text-[11px] text-slate-400 font-semibold leading-snug">
          Chọn ngân hàng + số TK để xem QR mẫu
        </p>
      </div>
    );
  }
  const params = new URLSearchParams({
    amount: '500000',
    addInfo: 'HV001 Nop hoc phi THVP',
    accountName: centerBankAccountName || '',
  });
  const url = `https://img.vietqr.io/image/${centerBankCode}-${centerBankAccountNumber}-compact2.png?${params}`;
  return (
    <div className={`rounded-xl border border-blue-100 bg-blue-50/70 flex flex-col items-center ${compact ? 'p-2.5 gap-1.5' : 'p-3 gap-2'}`}>
      <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide flex items-center gap-1">
        <Eye size={11} /> QR mẫu · 500.000đ
      </p>
      <img
        src={url}
        alt="QR mẫu"
        className={`object-contain rounded-lg border bg-white p-0.5 ${compact ? 'w-[112px] h-[112px]' : 'w-36 h-36'}`}
      />
    </div>
  );
}

export default function SystemSettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState('bank');
  const [loading, setLoading]   = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef(null);

  // ── Admin Profile State ──
  const [adminName, setAdminName] = useState('');
  const [adminOldPw, setAdminOldPw] = useState('');
  const [adminNewPw, setAdminNewPw] = useState('');
  const [adminNewPw2, setAdminNewPw2] = useState('');
  const [showAdminOldPw, setShowAdminOldPw] = useState(false);
  const [showAdminNewPw, setShowAdminNewPw] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState('');
  // Super Admin MFA (TOTP)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetup, setMfaSetup] = useState(null); // { secret, qrDataUrl }
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisablePw, setMfaDisablePw] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const toast = useToast();

  const [settings, setSettings] = useState({
    // Bank
    centerBankCode: '',
    centerBankName: '',
    centerBankAccountNumber: '',
    centerBankAccountName: '',
    // Popup
    popupIsActive: false,
    popupTitle: '',
    popupContent: '',
    popupImageUrl: '',
    popupTargetRole: 'all',
    // Invoice
    invoiceLogoUrl: '',
    invoiceSignatureUrl: '',
    invoiceStampText: 'ĐÃ THANH TOÁN',
  });

  // Fetch current settings
  useEffect(() => {
    setLoading(true);
    api.settings.getAll()
      .then(res => {
        if (res.success) setSettings(prev => ({ ...prev, ...res.data }));
      })
      .catch(() => toast.error('Không tải được cấu hình'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const sess = JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('staff_user') || '{}');
      if (sess?.name) setAdminName(sess.name);
      setIsSuperAdmin(sess?.id === 'admin' || sess?.adminRole === 'SUPER_ADMIN');
    } catch {
      setIsSuperAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab !== 'account' || !isSuperAdmin) return;
    setMfaLoading(true);
    api.auth.mfaStatus()
      .then((res) => {
        if (res.success) setMfaEnabled(!!res.data?.enabled);
      })
      .catch(() => {})
      .finally(() => setMfaLoading(false));
  }, [activeSubTab, isSuperAdmin]);


  const handleSave = async (fields) => {
    const payload = {};
    for (const f of fields) payload[f] = settings[f];
    setSaving(true);
    try {
      const res = await api.settings.update(payload);
      if (res.success) {
        toast.success('✅ Đã lưu cấu hình thành công');
        setSettings(prev => ({ ...prev, ...res.data }));
      } else {
        toast.error(res.message || 'Lưu thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.settings.uploadPopupImage(file);
      if (res.success) {
        setSettings(prev => ({ ...prev, popupImageUrl: res.imageUrl }));
        toast.success('✅ Upload ảnh thành công');
      } else {
        toast.error(res.message || 'Upload thất bại');
      }
    } catch {
      toast.error('Lỗi upload ảnh');
    } finally {
      setUploading(false);
    }
  };

  const handleResetData = async (data) => {
    try {
      const res = await api.settings.resetData(data);
      if (res.success) {
         toast.success('Hệ thống đã được dọn dẹp sạch sẽ!');
         // Frontend tự động reload để clear trạng thái cũ
         setTimeout(() => {
           localStorage.clear();
           sessionStorage.clear();
           window.location.href = '/login';
         }, 1500);
      } else {
         toast.error(res.message || 'Lỗi khi đặt lại dữ liệu');
      }
    } catch (err) {
      toast.error('Có lỗi xảy ra, thử lại sau');
    }
  };

  const handleSignatureUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.settings.uploadInvoiceSignature(file);
      if (res.success) {
        setSettings(prev => ({ ...prev, invoiceSignatureUrl: res.signatureUrl }));
        toast.success('✅ Cập nhật chữ ký thành công');
      } else {
        toast.error(res.message || 'Upload thất bại');
      }
    } catch {
      toast.error('Lỗi upload chữ ký');
    } finally {
      setUploading(false);
    }
  };

  const handleInvoiceLogoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.settings.uploadInvoiceLogo(file);
      if (res.success) {
        setSettings(prev => ({ ...prev, invoiceLogoUrl: res.logoUrl }));
        toast.success('✅ Cập nhật logo hóa đơn thành công');
      } else {
        toast.error(res.message || 'Upload thất bại');
      }
    } catch {
      toast.error('Lỗi upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleMfaStartSetup = async () => {
    setMfaBusy(true);
    try {
      const res = await api.auth.mfaSetup();
      if (res.success) {
        setMfaSetup(res.data);
        setMfaCode('');
      } else {
        toast.error(res.message || 'Không tạo được mã MFA');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setMfaBusy(false);
    }
  };

  const handleMfaEnable = async () => {
    if (!mfaCode.trim() || mfaCode.trim().length !== 6) {
      toast.error('Nhập mã OTP 6 số từ app Authenticator');
      return;
    }
    setMfaBusy(true);
    try {
      const res = await api.auth.mfaEnable(mfaCode.trim());
      if (res.success) {
        toast.success(res.message || 'Đã bật MFA');
        setMfaEnabled(true);
        setMfaSetup(null);
        setMfaCode('');
      } else {
        toast.error(res.message || 'Bật MFA thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setMfaBusy(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!mfaDisablePw) {
      toast.error('Nhập mật khẩu hiện tại');
      return;
    }
    if (!mfaCode.trim() || mfaCode.trim().length !== 6) {
      toast.error('Nhập mã OTP 6 số hiện tại');
      return;
    }
    setMfaBusy(true);
    try {
      const res = await api.auth.mfaDisable(mfaDisablePw, mfaCode.trim());
      if (res.success) {
        toast.success('Đã tắt MFA');
        setMfaEnabled(false);
        setMfaDisablePw('');
        setMfaCode('');
        setMfaSetup(null);
      } else {
        toast.error(res.message || 'Tắt MFA thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setMfaBusy(false);
    }
  };

  // ── Admin Profile Handler ──
  const handleAdminProfileSave = async () => {
    if (adminNewPw && adminNewPw !== adminNewPw2) {
      toast.error('Mật khẩu mới không khớp nhau');
      return;
    }
    if (adminNewPw && adminNewPw.length < 6) {
      toast.error('Mật khẩu mới phải ít nhất 6 ký tự');
      return;
    }
    if (adminNewPw && !adminOldPw) {
      toast.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    setAdminSaving(true);
    setAdminSuccess('');
    try {
      const payload = {};
      if (adminName.trim()) payload.name = adminName.trim();
      if (adminNewPw) {
        payload.oldPassword = adminOldPw;
        payload.newPassword = adminNewPw;
      }
      if (!payload.name && !payload.newPassword) {
        toast.error('Vui lòng nhập thông tin cần thay đổi');
        setAdminSaving(false);
        return;
      }
      const res = await api.auth.adminUpdateProfile(payload);
      if (res.success) {
        toast.success('✅ Cập nhật thành công!');
        setAdminSuccess('Thông tin đã được cập nhật thành công!');
        setAdminOldPw('');
        setAdminNewPw('');
        setAdminNewPw2('');
        // Update session name
        if (res.data?.name) {
          try {
            const session = JSON.parse(localStorage.getItem('admin_user') || '{}');
            session.name = res.data.name;
            localStorage.setItem('admin_user', JSON.stringify(session));
          } catch {}
        }
      } else {
        toast.error(res.message || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setAdminSaving(false);
    }
  };

  const TABS = [
    { key: 'bank',     label: 'Tài khoản Thu học phí', icon: CreditCard  },
    { key: 'pricing',  label: 'Học phí Khóa học',       icon: DollarSign  },
    { key: 'branches', label: 'Chi nhánh / Cơ sở',      icon: Building2   },
    { key: 'popup',    label: 'Popup Thông báo',         icon: Bell        },
    { key: 'invoice',  label: 'Hóa đơn',                 icon: FileText    },
    { key: 'web',      label: 'Cài đặt Web',             icon: Settings    },
    { key: 'account',  label: 'Tài khoản Admin',         icon: Lock        },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
      <Loader2 size={24} className="animate-spin text-blue-500" />
      <span>Đang tải cấu hình...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-200">
            <Settings size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-gray-900">Cài đặt hệ thống</h2>
            <p className="text-xs text-gray-400">Cấu hình ngân hàng trung tâm và thông báo hiển thị</p>
          </div>
        </div>
        
        {/* DANGER ZONE BUTTON */}
        <button 
          onClick={() => setShowResetModal(true)}
          className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm relative group overflow-hidden w-full sm:w-auto"
        >
           <span className="absolute inset-0 bg-red-600 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300"></span>
           <AlertOctagon size={16} className="relative z-10" /> 
           <span className="relative z-10">Làm mới dữ liệu hệ thống</span>
        </button>
      </div>

      {/* Sub-nav ngang + nội dung */}
      <div className="flex flex-col gap-4">
        <nav
          aria-label="Mục cài đặt"
          className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5"
        >
          <div className="flex flex-wrap gap-1 w-full">
            {TABS.map(t => {
              const active = activeSubTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => setActiveSubTab(t.key)}
                  className={`inline-flex items-center justify-center gap-1.5 flex-1 basis-0 min-w-[2.75rem] px-2 sm:px-3 py-2.5 text-sm font-bold rounded-xl transition ${
                    active
                      ? 'text-red-700 bg-red-50 ring-1 ring-red-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <t.icon size={16} className={`flex-shrink-0 ${active ? 'text-red-600' : 'text-gray-400'}`} aria-hidden="true" />
                  <span className="hidden min-[640px]:inline leading-snug truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
      {/* ── TAB 1: NGÂN HÀNG ───────────────────────────────────────────── */}
      {activeSubTab === 'bank' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 sm:p-4 w-full max-w-full lg:max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Landmark size={15} className="text-emerald-600 shrink-0" />
              <h3 className="font-bold text-sm text-gray-800 truncate">Tài khoản thu học phí</h3>
            </div>
            <p className="text-[10px] text-amber-700/90 font-semibold bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 max-w-full sm:max-w-[min(100%,28rem)] leading-snug">
              TK trung tâm · QR tự tạo khi Admin thu tiền
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:gap-4 items-start">
            <div className="space-y-2.5 min-w-0">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Ngân hàng</label>
                <BankSelect
                  value={settings.centerBankCode}
                  onChange={(bank) => setSettings((prev) => ({
                    ...prev,
                    centerBankCode: bank.bin,
                    centerBankName: bank.shortName,
                  }))}
                />
                {settings.centerBankCode ? (
                  <p className="text-[10px] text-emerald-600 mt-1 font-semibold">
                    ✓ {settings.centerBankName} · BIN {settings.centerBankCode}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Số tài khoản</label>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 focus-within:border-emerald-400 transition">
                  <CreditCard size={14} className="text-emerald-500 shrink-0" />
                  <input
                    type="text"
                    value={settings.centerBankAccountNumber}
                    onChange={(e) => setSettings((prev) => ({ ...prev, centerBankAccountNumber: e.target.value.replace(/\D/g, '') }))}
                    className="flex-1 text-sm font-mono outline-none bg-transparent tracking-wider min-w-0"
                    placeholder="Số TK"
                    maxLength={20}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Chủ tài khoản</label>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 focus-within:border-emerald-400 transition">
                  <Users size={14} className="text-emerald-500 shrink-0" />
                  <input
                    type="text"
                    value={settings.centerBankAccountName}
                    onChange={(e) => setSettings((prev) => ({ ...prev, centerBankAccountName: e.target.value.toUpperCase() }))}
                    className="flex-1 text-xs font-bold outline-none bg-transparent uppercase min-w-0"
                    placeholder="TÊN CHỦ TK"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSave(['centerBankCode', 'centerBankName', 'centerBankAccountNumber', 'centerBankAccountName'])}
                disabled={saving || !settings.centerBankCode || !settings.centerBankAccountNumber}
                className="w-full sm:w-auto sm:min-w-[200px] py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wide rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>

            <div className="w-full md:w-[148px] shrink-0">
              <TuitionQRPreview settings={settings} compact />
            </div>
          </div>
        </div>
      )}


      {/* ── TAB 2: HỌC PHÍ KHÓA HỌC ── CoursePricingTab component ───────────────── */}
      {activeSubTab === 'pricing' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 sm:p-5">
          <CoursePricingTab />
        </div>
      )}

      {/* ── TAB 3: CHI NHÁNH ──────────────────────────────────────────────────── */}
      {activeSubTab === 'branches' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 sm:p-5">
          <BranchManagementTab />
        </div>
      )}

      {activeSubTab === 'popup' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-3 w-full max-w-4xl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Bell size={14} className="text-red-600" /> Popup thông báo
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {settings.popupIsActive
                  ? 'Đang bật — hiện khi đăng nhập theo đối tượng đã chọn'
                  : 'Đang tắt — không hiện khi đăng nhập'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, popupIsActive: !prev.popupIsActive }))}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                  settings.popupIsActive
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {settings.popupIsActive
                  ? <><ToggleRight size={16} className="text-emerald-600" /> Bật</>
                  : <><ToggleLeft size={16} /> Tắt</>
                }
              </button>
              <button
                type="button"
                onClick={() => handleSave(['popupIsActive','popupTitle','popupContent','popupImageUrl','popupTargetRole'])}
                disabled={saving}
                className="cms-btn cms-btn-primary !py-1.5 !px-3 !text-xs !rounded-lg disabled:opacity-40"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? 'Lưu…' : 'Lưu'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Đối tượng</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { v: 'all',     label: 'Tất cả',    Icon: Users },
                { v: 'student', label: 'HV',         Icon: Users },
                { v: 'teacher', label: 'GV',         Icon: GraduationCap },
                { v: 'staff',   label: 'NV',         Icon: Briefcase },
              ].map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, popupTargetRole: v }))}
                  className={`py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition border ${
                    settings.popupTargetRole === v
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  title={v === 'staff' ? 'Thông báo nội bộ Staff khi đăng nhập' : undefined}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tiêu đề</label>
              <input
                type="text"
                value={settings.popupTitle}
                onChange={e => setSettings(prev => ({ ...prev, popupTitle: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] focus:border-red-400 outline-none transition"
                placeholder="VD: Thông báo lịch học tháng 4"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nội dung</label>
              <textarea
                value={settings.popupContent}
                onChange={e => setSettings(prev => ({ ...prev, popupContent: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] focus:border-red-400 outline-none resize-none transition"
                placeholder="Nội dung thông báo…"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Ảnh banner (tuỳ chọn)</label>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleImageUpload(e.target.files?.[0])}
            />
            <div className="flex flex-col sm:flex-row gap-1.5">
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-red-300 text-red-600 text-[11px] font-semibold hover:bg-red-50 transition disabled:opacity-50 whitespace-nowrap"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Upload…' : 'Chọn ảnh'}
              </button>
              <input
                type="url"
                value={settings.popupImageUrl}
                onChange={e => setSettings(prev => ({ ...prev, popupImageUrl: e.target.value }))}
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono focus:border-red-400 outline-none transition"
                placeholder="Hoặc URL ảnh…"
              />
            </div>
            {settings.popupImageUrl && (
              <div className="relative mt-1.5 inline-block max-w-full">
                <img
                  src={resolveMediaUrl(settings.popupImageUrl) || settings.popupImageUrl}
                  alt="Banner preview"
                  className="rounded-lg border max-h-28 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, popupImageUrl: '' }))}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full text-white flex items-center justify-center hover:bg-black/70"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: HÓA ĐƠN (INVOICE) ────────────────────────────────────────── */}
      {activeSubTab === 'invoice' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-3 w-full max-w-4xl">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" /> Cấu hình Hóa đơn
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Logo · chữ ký · dấu mộc trên phiếu thu A5</p>
            </div>
            <button
              type="button"
              onClick={() => handleSave(['invoiceLogoUrl', 'invoiceSignatureUrl', 'invoiceStampText'])}
              disabled={saving}
              className="cms-btn cms-btn-primary !py-1.5 !px-3 !text-xs !rounded-lg disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Lưu…' : 'Lưu'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Logo hóa đơn</label>
              <div className="flex items-center gap-2">
                {settings.invoiceLogoUrl ? (
                  <img
                    src={resolveMediaUrl(settings.invoiceLogoUrl) || settings.invoiceLogoUrl}
                    className="h-11 w-11 object-contain border rounded-md bg-white flex-shrink-0"
                    alt="Logo Invoice"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-md border border-dashed border-slate-200 bg-white flex items-center justify-center text-slate-300 flex-shrink-0">
                    <FileText size={14} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => handleInvoiceLogoUpload(e.target.files[0]);
                    input.click();
                  }}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                >
                  <Upload size={12} /> {settings.invoiceLogoUrl ? 'Đổi' : 'Tải lên'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Chữ ký người nhận</label>
              <div className="flex items-center gap-2">
                {settings.invoiceSignatureUrl ? (
                  <img
                    src={resolveMediaUrl(settings.invoiceSignatureUrl) || settings.invoiceSignatureUrl}
                    className="h-11 w-20 object-contain border rounded-md bg-white flex-shrink-0"
                    alt="Chữ ký"
                  />
                ) : (
                  <div className="h-11 w-20 rounded-md border border-dashed border-slate-200 bg-white flex items-center justify-center text-slate-300 flex-shrink-0 text-[10px]">
                    PNG
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => handleSignatureUpload(e.target.files[0]);
                    input.click();
                  }}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                >
                  <Upload size={12} /> {settings.invoiceSignatureUrl ? 'Đổi' : 'Tải lên'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">Nên dùng PNG nền trong suốt</p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nội dung dấu mộc</label>
            <input
              type="text"
              value={settings.invoiceStampText}
              onChange={e => setSettings(prev => ({ ...prev, invoiceStampText: e.target.value.toUpperCase() }))}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-red-600 focus:border-red-400 outline-none transition"
              placeholder="VD: ĐÃ THANH TOÁN"
            />
          </div>
        </div>
      )}
      {/* ── TAB 5: CÀI ĐẶT WEB ── WebSettingsTab component ──────────────────── */}
      {activeSubTab === 'web' && (
        <WebSettingsTab />
      )}

      {/* ── TAB 6: TÀI KHOẢN ADMIN ──────────────────────────────────────────── */}
      {activeSubTab === 'account' && (
        <div className={`grid grid-cols-1 gap-3 w-full max-w-4xl ${isSuperAdmin ? 'lg:grid-cols-2' : 'lg:max-w-xl'}`}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock size={14} className="text-red-600 shrink-0" /> Thông tin tài khoản đăng nhập
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Đổi tên hiển thị / mật khẩu cho tài khoản đang đăng nhập</p>
              </div>
              <button
                type="button"
                onClick={handleAdminProfileSave}
                disabled={adminSaving || (adminNewPw && adminNewPw !== adminNewPw2)}
                className="cms-btn cms-btn-primary !py-1.5 !px-3 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {adminSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {adminSaving ? 'Lưu…' : 'Lưu'}
              </button>
            </div>

            {adminSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-emerald-700 text-[12px] font-semibold">
                <CheckCircle2 size={13} className="shrink-0" /> {adminSuccess}
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tên hiển thị</label>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 min-h-9 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-500/10 transition">
                <User size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="flex-1 text-[13px] font-medium text-slate-800 outline-none bg-transparent py-1.5"
                  placeholder="Tên hiển thị mới…"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <KeyRound size={12} className="text-slate-400" /> Đổi mật khẩu
              </p>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mật khẩu hiện tại</label>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 min-h-9 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-500/10 transition">
                  <Lock size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    type={showAdminOldPw ? 'text' : 'password'}
                    value={adminOldPw}
                    onChange={e => setAdminOldPw(e.target.value)}
                    className="flex-1 text-[13px] font-medium text-slate-800 outline-none bg-transparent py-1.5"
                    placeholder="Mật khẩu hiện tại…"
                  />
                  <button type="button" onClick={() => setShowAdminOldPw(!showAdminOldPw)} className="text-slate-400 hover:text-slate-600 p-0.5" aria-label="Hiện/ẩn mật khẩu">
                    {showAdminOldPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mật khẩu mới (≥6)</label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 min-h-9 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-500/10 transition">
                    <KeyRound size={14} className="text-slate-400 flex-shrink-0" />
                    <input
                      type={showAdminNewPw ? 'text' : 'password'}
                      value={adminNewPw}
                      onChange={e => setAdminNewPw(e.target.value)}
                      className="flex-1 text-[13px] font-medium text-slate-800 outline-none bg-transparent py-1.5 min-w-0"
                      placeholder="Mật khẩu mới…"
                    />
                    <button type="button" onClick={() => setShowAdminNewPw(!showAdminNewPw)} className="text-slate-400 hover:text-slate-600 p-0.5" aria-label="Hiện/ẩn mật khẩu">
                      {showAdminNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Xác nhận</label>
                  <div className={`flex items-center gap-2 bg-white border rounded-lg px-2.5 min-h-9 transition ${
                    adminNewPw2 && adminNewPw !== adminNewPw2
                      ? 'border-red-300'
                      : 'border-slate-200 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-500/10'
                  }`}>
                    <KeyRound size={14} className="text-slate-400 flex-shrink-0" />
                    <input
                      type="password"
                      value={adminNewPw2}
                      onChange={e => setAdminNewPw2(e.target.value)}
                      className="flex-1 text-[13px] font-medium text-slate-800 outline-none bg-transparent py-1.5 min-w-0"
                      placeholder="Nhập lại…"
                    />
                    {adminNewPw2 && adminNewPw === adminNewPw2 && (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    )}
                  </div>
                  {adminNewPw2 && adminNewPw !== adminNewPw2 && (
                    <p className="text-[10px] text-red-500 mt-0.5">Không khớp</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-2.5 min-w-0 h-fit">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" /> MFA (2 bước)
                </h3>
                {mfaLoading ? (
                  <Loader2 size={13} className="animate-spin text-gray-400" />
                ) : (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    mfaEnabled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                  }`}>
                    {mfaEnabled ? 'Đang bật' : 'Đang tắt'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-800/80 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug">
                Google Authenticator / Authy · đăng nhập nội bộ cần OTP 6 số.
              </p>

              {!mfaEnabled && !mfaSetup && (
                <button
                  type="button"
                  onClick={handleMfaStartSetup}
                  disabled={mfaBusy}
                  className="w-full py-2 bg-emerald-600 text-white text-[13px] font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  {mfaBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Bật MFA
                </button>
              )}

              {!mfaEnabled && mfaSetup && (
                <div className="space-y-2">
                  {mfaSetup.qrDataUrl && (
                    <div className="flex justify-center">
                      <img src={mfaSetup.qrDataUrl} alt="MFA QR" className="w-36 h-36 rounded-lg border bg-white p-1" />
                    </div>
                  )}
                  <p className="text-[10px] text-center text-gray-500 break-all font-mono bg-gray-50 rounded-md px-2 py-1.5">
                    {mfaSetup.secret}
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-center tracking-widest outline-none focus:border-emerald-400"
                    placeholder="OTP 6 số"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setMfaSetup(null); setMfaCode(''); }}
                      className="flex-1 py-2 border border-gray-200 rounded-lg text-[12px] font-bold text-gray-600 hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleMfaEnable}
                      disabled={mfaBusy || mfaCode.length !== 6}
                      className="flex-1 py-2 bg-emerald-600 text-white text-[12px] font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {mfaBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                      Xác nhận
                    </button>
                  </div>
                </div>
              )}

              {mfaEnabled && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={mfaDisablePw}
                    onChange={(e) => setMfaDisablePw(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none focus:border-red-300"
                    placeholder="Mật khẩu hiện tại"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-bold text-center tracking-widest outline-none focus:border-red-300"
                    placeholder="OTP hiện tại"
                  />
                  <button
                    type="button"
                    onClick={handleMfaDisable}
                    disabled={mfaBusy}
                    className="w-full py-2 bg-red-50 text-red-700 border border-red-200 text-[13px] font-bold rounded-lg hover:bg-red-100 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {mfaBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                    Tắt MFA
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

        </div>
      </div>

      {/* DANGER ZONE MODAL */}
      {showResetModal && (
        <SystemResetModal 
          onClose={() => setShowResetModal(false)}
          onSubmit={handleResetData}
        />
      )}
    </div>
  );
}
