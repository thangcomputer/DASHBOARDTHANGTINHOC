import React, { useState, useEffect } from 'react';
import {
  User, Phone, Mail, Building2, CreditCard, Landmark, Edit3, Shield, MapPin, Save, X, CheckCircle,
  Calendar, Award, Clock, DollarSign, ChevronDown, ChevronRight, KeyRound, Camera, Bell, LogOut,
  Users, Sparkles,
} from 'lucide-react';
import { BankSelect } from '../BankSelect';
import { openPinLockSettings } from '../../utils/pinLock';
import { useData } from '../../context/DataContext';
import { useToast } from '../../utils/useToast';
import EditableAvatar from '../EditableAvatar';
import CmsSelect from '../ui/CmsSelect';
import { VOICE_REGION_OPTIONS, voiceRegionLabel } from '../../constants/voiceRegions';

function openChangePassword() {
  window.dispatchEvent(new CustomEvent('open-change-password-modal'));
}

export const TeacherProfileSection = ({ teacherId, currentTeacher }) => {
  const toast = useToast();
  const { updateTeacher, onLogout } = useData();
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
    bankBranch: '',
  });
  const [profileForm, setProfileForm] = useState({
    email: '',
    bio: '',
    specialty: '',
    address: '',
    zalo: '',
    voiceRegion: '',
    age: '',
  });
  const [saving, setSaving] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [openSections, setOpenSections] = useState({
    personalInfo: true,
    bank: true,
    teaching: true,
  });

  useEffect(() => {
    if (currentTeacher) {
      setBankForm({
        bankName: currentTeacher.bankAccount?.bankName || '',
        bankCode: currentTeacher.bankAccount?.bankCode || '',
        accountNumber: currentTeacher.bankAccount?.accountNumber || '',
        accountName: currentTeacher.bankAccount?.accountName || currentTeacher.bankAccount?.accountHolder || '',
        bankBranch: currentTeacher.bankAccount?.bankBranch || '',
      });
      setProfileForm({
        email: currentTeacher.email || '',
        bio: currentTeacher.bio || '',
        specialty: currentTeacher.specialty || '',
        address: currentTeacher.address || '',
        zalo: currentTeacher.zalo || '',
        voiceRegion: currentTeacher.voiceRegion || '',
        age: currentTeacher.age ?? '',
      });
    }
  }, [currentTeacher]);

  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSaveBank = async () => {
    setSaving(true);
    try {
      const result = await updateTeacher(teacherId, {
        bankAccount: {
          bankName: bankForm.bankName,
          bankCode: bankForm.bankCode,
          accountNumber: bankForm.accountNumber,
          accountName: bankForm.accountName.toUpperCase(),
          accountHolder: bankForm.accountName.toUpperCase(),
          bankBranch: bankForm.bankBranch,
        },
      });
      if (result && result.success) {
        toast.success('Đã lưu thông tin thanh toán!');
        setEditingBank(false);
      } else {
        toast.error(result?.message || 'Lỗi khi lưu thông tin ngân hàng');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const result = await updateTeacher(teacherId, {
        zalo: profileForm.zalo,
        email: profileForm.email,
        bio: profileForm.bio,
        address: profileForm.address,
        voiceRegion: profileForm.voiceRegion || '',
        age: profileForm.age === '' ? null : Number(profileForm.age),
      });
      if (result && result.success) {
        toast.success('Đã cập nhật thông tin cá nhân!');
        setEditingProfile(false);
      } else {
        toast.error(result?.message || 'Lỗi khi lưu');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const handleEnableNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo.');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        toast.success('Đã bật quyền thông báo cho trình duyệt này!');
      } else if (res === 'denied') {
        toast.error('Quyền thông báo đang bị chặn trong trình duyệt.');
      } else {
        toast.info('Bạn chưa xác nhận quyền thông báo.');
      }
    } catch {
      toast.error('Không thể yêu cầu quyền thông báo.');
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  const teacherStatus = (() => {
    const s = String(currentTeacher?.status || '').toLowerCase();
    if (['active', 'đang hoạt động'].includes(s)) return 'Đang hoạt động';
    if (['pending', 'chờ duyệt'].includes(s)) return 'Chờ duyệt';
    if (['suspended', 'tạm khóa'].includes(s)) return 'Tạm khóa';
    if (['inactive', 'ngừng hoạt động'].includes(s)) return 'Ngừng hoạt động';
    return currentTeacher?.status || 'Đang hoạt động';
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-3.5 sm:space-y-4 py-3 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* ── 1. Thẻ Hero hồ sơ cá nhân giảng viên (Đồng bộ chuẩn Mobile App) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c6b5b] via-[#0a584b] to-[#073d34] text-white p-5 sm:p-6 shadow-md relative overflow-hidden">
        {/* Họa tiết trang trí mờ phía sau */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -right-4 -top-8 w-28 h-28 rounded-full bg-emerald-400/10 pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative shrink-0">
            <EditableAvatar
              avatar={currentTeacher?.avatar}
              name={currentTeacher?.name}
              role="teacher"
              gender={currentTeacher?.gender}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl border-2 border-white/20 bg-white/10 shadow-lg cursor-pointer"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0FAF9F] border-2 border-[#0a584b] flex items-center justify-center text-white shadow pointer-events-none">
              <Camera size={12} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide truncate">
              {currentTeacher?.name || 'GIẢNG VIÊN'}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-emerald-100/90 truncate mt-0.5">
              {[currentTeacher?.branchCode ? `Cơ sở ${currentTeacher.branchCode}` : '', currentTeacher?.phone].filter(Boolean).join(' · ') || 'Thông tin giảng viên'}
            </p>
            <div className="mt-1.5">
              <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white border border-white/10">
                Trạng thái: {teacherStatus}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Chỉ số KPI chuẩn Mobile */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/15 text-center relative z-10">
          <div>
            <p className="text-lg sm:text-2xl font-black text-white leading-tight">
              {currentTeacher?.testScore != null ? `${currentTeacher.testScore}/100` : '-'}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-100/75 font-medium mt-0.5">
              Điểm test
            </p>
          </div>
          <div className="border-x border-white/10">
            <p className="text-lg sm:text-2xl font-black text-white leading-tight">
              {currentTeacher?.baseSalaryPerSession ? `${Number(currentTeacher.baseSalaryPerSession).toLocaleString('vi-VN')}đ` : '-'}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-100/75 font-medium mt-0.5">
              Lương/buổi
            </p>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-black text-white leading-tight">
              {currentTeacher?.activeStudentsCount ?? '-'}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-100/75 font-medium mt-0.5">
              Học viên
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Menu Bảo mật & Tiện ích (Ngay dưới Hero theo đúng Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={openChangePassword}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shrink-0">
            <Shield size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Đổi mật khẩu</p>
            <p className="text-xs text-slate-500 mt-0.5">Bảo mật tài khoản đăng nhập</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={openPinLockSettings}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <KeyRound size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Khóa mã PIN</p>
            <p className="text-xs text-slate-500 mt-0.5">Tự khóa màn hình khi không thao tác</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => { window.location.hash = 'center-info'; }}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Users size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Thông tin Trung tâm</p>
            <p className="text-xs text-slate-500 mt-0.5">Quy định và thông tin hỗ trợ giảng viên</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
      </div>

      {/* ── 3. Thông tin cá nhân (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User size={18} className="text-[#0FAF9F]" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Thông tin cá nhân</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingProfile(!editingProfile)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                editingProfile
                  ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Edit3 size={13} />
              <span>{editingProfile ? 'Hủy' : 'Chỉnh sửa'}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSection('personalInfo')}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Thu gọn thông tin cá nhân"
            >
              <ChevronDown size={18} className={`transition-transform duration-200 ${openSections.personalInfo ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {openSections.personalInfo && (
          editingProfile ? (
            <div className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Số Zalo</label>
                  <input
                    type="text"
                    value={profileForm.zalo}
                    onChange={(e) => setProfileForm({ ...profileForm, zalo: e.target.value })}
                    placeholder="Nhập số Zalo..."
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="Nhập email..."
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Tuổi</label>
                  <input
                    type="number"
                    min="18"
                    max="80"
                    value={profileForm.age}
                    onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                    placeholder="VD: 25"
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Vùng giọng</label>
                  <CmsSelect
                    value={profileForm.voiceRegion}
                    onChange={(v) => setProfileForm({ ...profileForm, voiceRegion: v })}
                    options={VOICE_REGION_OPTIONS}
                    placeholder="-- Chọn vùng giọng --"
                    className="w-full"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Địa chỉ</label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Địa chỉ cư trú..."
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Giới thiệu ngắn (Bio)</label>
                  <textarea
                    rows={2}
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Kinh nghiệm, thế mạnh giảng dạy..."
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50/50 resize-none"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Clock size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Lưu thông tin</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Số điện thoại</p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono">{currentTeacher?.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Zalo</p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono">{currentTeacher?.zalo || currentTeacher?.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Email</p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{currentTeacher?.email || 'Chưa cập nhật'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <User size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Tuổi / Giọng</p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                    {[currentTeacher?.age ? `${currentTeacher.age} tuổi` : '', voiceRegionLabel(currentTeacher?.voiceRegion)].filter(Boolean).join(' · ') || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 sm:col-span-2">
                <MapPin size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Địa chỉ</p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{currentTeacher?.address || 'Chưa cập nhật'}</p>
                </div>
              </div>
              {currentTeacher?.bio && (
                <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 sm:col-span-2">
                  <p className="text-[11px] font-bold text-slate-400 mb-1">Giới thiệu</p>
                  <p className="text-xs sm:text-sm text-slate-700 italic">{currentTeacher.bio}</p>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ── 4. Thông tin ngân hàng (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-blue-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Thông tin ngân hàng</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingBank(!editingBank)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                editingBank
                  ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <CreditCard size={13} />
              <span>{editingBank ? 'Hủy' : 'Chỉnh sửa'}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSection('bank')}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Thu gọn thông tin ngân hàng"
            >
              <ChevronDown size={18} className={`transition-transform duration-200 ${openSections.bank ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {openSections.bank && (
          editingBank ? (
            <div className="space-y-3 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Ngân hàng</label>
                <BankSelect
                  value={bankForm.bankCode}
                  onChange={(bank) => setBankForm({ ...bankForm, bankName: bank.shortName, bankCode: bank.code })}
                  placeholder="Chọn ngân hàng thụ hưởng..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Số tài khoản</label>
                  <input
                    type="text"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="Nhập số tài khoản..."
                    maxLength={20}
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-blue-500 focus:outline-none bg-slate-50/50 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={bankForm.accountName}
                    onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value.toUpperCase() })}
                    placeholder="VD: NGUYEN VAN A"
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-blue-500 focus:outline-none bg-slate-50/50 font-bold uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Chi nhánh (tùy chọn)</label>
                  <input
                    type="text"
                    value={bankForm.bankBranch}
                    onChange={(e) => setBankForm({ ...bankForm, bankBranch: e.target.value })}
                    placeholder="VD: Chi nhánh Hồ Chí Minh"
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-blue-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBank(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveBank}
                  disabled={saving || !bankForm.bankName || !bankForm.accountNumber || !bankForm.accountName}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Clock size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Lưu tài khoản</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 sm:col-span-2">
                <Landmark size={16} className="text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Ngân hàng</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{bankForm.bankName || 'Chưa thiết lập'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <CreditCard size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Số tài khoản</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 font-mono tracking-wider">{bankForm.accountNumber || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <User size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400">Chủ tài khoản</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 uppercase truncate">{bankForm.accountName || '-'}</p>
                </div>
              </div>
              {bankForm.bankBranch && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 sm:col-span-2">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-400">Chi nhánh</p>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{bankForm.bankBranch}</p>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ── 5. Thông tin giảng dạy & Trạng thái (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <button
          type="button"
          onClick={() => toggleSection('teaching')}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Thông tin giảng dạy</h3>
          </div>
          <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openSections.teaching ? 'rotate-180' : ''}`} />
        </button>
        {openSections.teaching && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 mt-2 border-t border-slate-100">
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-center">
              <p className="text-[11px] font-bold text-slate-400">Điểm test</p>
              <p className="text-base font-extrabold text-emerald-600 mt-0.5">
                {currentTeacher?.testScore != null ? `${currentTeacher.testScore}/100` : 'Chưa thi'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-center">
              <p className="text-[11px] font-bold text-slate-400">Lương/buổi</p>
              <p className="text-sm sm:text-base font-extrabold text-blue-600 mt-0.5">
                {currentTeacher?.baseSalaryPerSession ? `${Number(currentTeacher.baseSalaryPerSession).toLocaleString('vi-VN')}đ` : 'Chưa đặt'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-center">
              <p className="text-[11px] font-bold text-slate-400">Trạng thái</p>
              <p className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">{teacherStatus}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-center">
              <p className="text-[11px] font-bold text-slate-400">Tham gia</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                {currentTeacher?.createdAt ? new Date(currentTeacher.createdAt).toLocaleDateString('vi-VN') : '-'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Cài đặt và hỗ trợ (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-slate-800 mb-3">Cài đặt và hỗ trợ</h4>
        <button
          type="button"
          onClick={handleEnableNotification}
          className="w-full flex items-center gap-3.5 text-left hover:bg-slate-50 p-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Bell size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Bật thông báo trên thiết bị</p>
            <p className="text-xs text-slate-500 mt-0.5">Bật quyền thông báo cho trình duyệt này</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
        <p className="text-xs text-slate-400 italic mt-3 pt-3 border-t border-slate-100">
          Liên kết quyền riêng tư, điều khoản và hỗ trợ đang chờ Trung tâm cấu hình.
        </p>
      </div>

      {/* ── 7. Nút Đăng xuất (Chuẩn Mobile) ── */}
      <div className="pt-2 pb-6 flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="min-w-[180px] py-2.5 px-6 rounded-full border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};

export default TeacherProfileSection;
