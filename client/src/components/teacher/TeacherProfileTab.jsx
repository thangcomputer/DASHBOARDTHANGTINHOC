import React, { useState, useEffect } from 'react';
import {
  User, Phone, Mail, Building2, CreditCard, Landmark, Copy, Edit3, Shield, MapPin, Save, X, CheckCircle,
  Calendar, Award, AlertCircle, Clock,
} from 'lucide-react';
import { BankSelect } from '../BankSelect';
import { teachersAPI, csrfFetch, resolveMediaUrl } from '../../services/api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../utils/toast';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import { showGlossyAlert } from './TeacherShared';

export const TeacherProfileSection = ({ teacherId, currentTeacher }) => {
  const { updateTeacher } = useData();
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankCode: '',       // bin từ VietQR API
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
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [editingBank, setEditingBank] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  // Load data from currentTeacher
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
      });
    }
  }, [currentTeacher]);

  const handleSaveBank = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const result = await updateTeacher(teacherId, {
        bankAccount: {
          bankName: bankForm.bankName,
          bankCode: bankForm.bankCode,   // lưu mã BIN cho VietQR
          accountNumber: bankForm.accountNumber,
          accountName: bankForm.accountName.toUpperCase(),
          accountHolder: bankForm.accountName.toUpperCase(), // alias
          bankBranch: bankForm.bankBranch,
        },
      });
      if (result && result.success) {
        setSaveMsg('✅ Đã lưu thông tin thanh toán!');
        setEditingBank(false);
      } else {
        setSaveMsg('❌ ' + (result?.message || 'Lỗi khi lưu'));
      }
    } catch (err) {
      setSaveMsg('❌ Lỗi kết nối server');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const result = await updateTeacher(teacherId, profileForm);
      if (result && result.success) {
        setSaveMsg('✅ Đã cập nhật thông tin cá nhân!');
        setEditingProfile(false);
      } else {
        setSaveMsg('❌ ' + (result?.message || 'Lỗi khi lưu'));
      }
    } catch (err) {
      setSaveMsg('❌ Lỗi kết nối server');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 1500);
  };

  const initials = currentTeacher?.name
    ? currentTeacher.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : 'GV';

  const bankFilled = bankForm.bankName && bankForm.accountNumber && bankForm.accountName;
  const teacherAvatarUrl = resolveAvatarUrl({
    avatar: currentTeacher?.avatar,
    role: 'teacher',
  });

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <img
          src={teacherAvatarUrl}
          alt={currentTeacher?.name || 'GV'}
          className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-lg shadow-blue-200 bg-white"
        />
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            Hồ sơ cá nhân
          </h2>
          <p className="text-xs text-gray-400">Quản lý thông tin cá nhân và tài khoản ngân hàng</p>
        </div>
      </div>

      {/* Save message toast */}
      {saveMsg && (
        <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-right duration-300 ${
          saveMsg.startsWith('✅') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── CARD 1: Thông tin cá nhân ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <User size={18} className="text-blue-600" /> Thông tin cá nhân
            </h3>
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                editingProfile
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
            >
              <Edit3 size={12} /> {editingProfile ? 'Huỷ' : 'Chỉnh sửa'}
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Name - Read only */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Họ và tên</label>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <User size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm font-bold text-gray-800">{currentTeacher?.name || '—'}</span>
                <Shield size={12} className="text-blue-400 ml-auto flex-shrink-0" title="Chỉ Admin có thể thay đổi" />
              </div>
            </div>

            {/* Phone - Read only */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Số điện thoại</label>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <Phone size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm font-bold text-gray-800">{currentTeacher?.phone || '—'}</span>
                <Shield size={12} className="text-blue-400 ml-auto flex-shrink-0" title="Chỉ Admin có thể thay đổi" />
              </div>
              <p className="text-xs cms-min-text-xs text-red-500 mt-1 pl-1 italic">* Liên hệ Admin để đổi SĐT.</p>
            </div>

            {/* Zalo - Editable */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Zalo</label>
              {editingProfile ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-blue-200 focus-within:border-blue-400 transition">
                  <Phone size={16} className="text-blue-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={profileForm.zalo}
                    onChange={e => setProfileForm({...profileForm, zalo: e.target.value})}
                    placeholder="Nhập số Zalo của bạn..."
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Phone size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{profileForm.zalo || '—'}</span>
                </div>
              )}
            </div>

            {/* Start Date - Read only */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Ngày vào làm</label>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm font-bold text-gray-800">
                  {currentTeacher?.startDate ? new Date(currentTeacher.startDate).toLocaleDateString('vi-VN') : '—'}
                </span>
                <Shield size={12} className="text-blue-400 ml-auto flex-shrink-0" title="Chỉ Admin có thể thay đổi" />
              </div>
            </div>

            {/* Branch - Read only */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Chi nhánh làm việc</label>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm font-bold text-gray-800">
                  {currentTeacher?.branchCode ? `Cơ sở ${currentTeacher.branchCode}` : 'Chưa phân chi nhánh'}
                </span>
                <Shield size={12} className="text-blue-400 ml-auto flex-shrink-0" title="Chỉ Admin có thể thay đổi" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
              {editingProfile ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-blue-200 focus-within:border-blue-400 transition">
                  <Mail size={16} className="text-blue-400 flex-shrink-0" />
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                    placeholder="email@example.com"
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Mail size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{profileForm.email || '—'}</span>
                </div>
              )}
            </div>


            {/* Address */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Địa chỉ (Thường trú/Tạm trú)</label>
              {editingProfile ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-blue-200 focus-within:border-blue-400 transition">
                  <MapPin size={16} className="text-blue-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={profileForm.address || ''}
                    onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                    placeholder="Nhập địa chỉ của bạn..."
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{profileForm.address || '—'}</span>
                </div>
              )}
            </div>

            {/* Specialty */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Chuyên môn</label>
              {editingProfile ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-blue-200 focus-within:border-blue-400 transition">
                  <Award size={16} className="text-blue-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={profileForm.specialty}
                    onChange={e => setProfileForm({...profileForm, specialty: e.target.value})}
                    placeholder="VD: THVP, Excel nâng cao, ..."
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Award size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{profileForm.specialty || '—'}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Giới thiệu bản thân</label>
              {editingProfile ? (
                <textarea
                  value={profileForm.bio}
                  onChange={e => setProfileForm({...profileForm, bio: e.target.value})}
                  placeholder="Chia sẻ đôi dòng về bản thân..."
                  rows={3}
                  className="w-full text-sm bg-white rounded-xl px-4 py-3 border-2 border-blue-200 focus:border-blue-400 outline-none resize-none transition"
                />
              ) : (
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 text-sm text-gray-700 min-h-[60px]">
                  {profileForm.bio || <span className="text-gray-400 italic">Chưa có thông tin</span>}
                </div>
              )}
            </div>

            {editingProfile && (
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Clock size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}
              </button>
            )}
          </div>
        </div>

        {/* ── CARD 2: Thông tin thanh toán ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-600" /> Thông tin thanh toán
            </h3>
            <button
              onClick={() => setEditingBank(!editingBank)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                editingBank
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
              }`}
            >
              <Edit3 size={12} /> {editingBank ? 'Huỷ' : 'Chỉnh sửa'}
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Status indicator */}
            {!bankFilled && !editingBank && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Chưa có thông tin thanh toán</p>
                  <p className="text-xs text-amber-600 mt-1">Vui lòng cập nhật tài khoản ngân hàng để Admin có thể chuyển lương cho bạn.</p>
                </div>
              </div>
            )}

            {bankFilled && !editingBank && (
              <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Landmark size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{bankForm.bankName}</span>
                  </div>
                  <p className="text-xl font-mono font-bold tracking-[0.15em] mb-1">{bankForm.accountNumber.replace(/(.{4})/g, '$1  ').trim()}</p>
                  <p className="text-sm font-bold text-white/80 uppercase">{bankForm.accountName}</p>
                  {bankForm.bankBranch && (
                    <p className="text-xs text-white/40 mt-2">Chi nhánh: {bankForm.bankBranch}</p>
                  )}
                  {/* Copy buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => copyToClipboard(bankForm.accountNumber, 'number')}
                      className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                      <Copy size={10} /> {copiedField === 'number' ? 'Đã copy!' : 'Copy STK'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(bankForm.accountName, 'name')}
                      className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                      <Copy size={10} /> {copiedField === 'name' ? 'Đã copy!' : 'Copy tên'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Name - Dropdown from VietQR API */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Ngân hàng</label>
              {editingBank ? (
                <BankSelect
                  value={bankForm.bankCode}
                  onChange={bank => setBankForm(prev => ({
                    ...prev,
                    bankCode: bank.bin,        // lưu BIN cho VietQR URL
                    bankName: bank.shortName,  // lưu tên hiển thị
                  }))}
                />
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Landmark size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{bankForm.bankName || <span className="text-gray-400 italic">Chưa chọn</span>}</span>
                </div>
              )}
            </div>

            {/* Account Number */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Số tài khoản</label>
              {editingBank ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-emerald-200 focus-within:border-emerald-400 transition">
                  <CreditCard size={16} className="text-emerald-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={bankForm.accountNumber}
                    onChange={e => setBankForm({...bankForm, accountNumber: e.target.value.replace(/\D/g, '')})}
                    placeholder="Nhập số tài khoản"
                    className="flex-1 text-sm outline-none bg-transparent font-mono tracking-wider"
                    maxLength={20}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <CreditCard size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-mono tracking-wider">{bankForm.accountNumber || '—'}</span>
                </div>
              )}
            </div>

            {/* Account Name */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Tên chủ tài khoản</label>
              {editingBank ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-emerald-200 focus-within:border-emerald-400 transition">
                  <User size={16} className="text-emerald-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={bankForm.accountName}
                    onChange={e => setBankForm({...bankForm, accountName: e.target.value.toUpperCase()})}
                    placeholder="VD: NGUYEN VAN A"
                    className="flex-1 text-sm outline-none bg-transparent uppercase font-bold"
                  />
                </div>
                ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <User size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-bold uppercase">{bankForm.accountName || '—'}</span>
                </div>
              )}
            </div>

            {/* Bank Branch */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Chi nhánh <span className="text-gray-300">(Tùy chọn)</span></label>
              {editingBank ? (
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-emerald-200 focus-within:border-emerald-400 transition">
                  <Building2 size={16} className="text-emerald-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={bankForm.bankBranch}
                    onChange={e => setBankForm({...bankForm, bankBranch: e.target.value})}
                    placeholder="VD: Chi nhánh Hồ Chí Minh"
                    className="flex-1 text-sm outline-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{bankForm.bankBranch || <span className="text-gray-400 italic">Không bắt buộc</span>}</span>
                </div>
              )}
            </div>

            {editingBank && (
              <button
                onClick={handleSaveBank}
                disabled={saving || !bankForm.bankName || !bankForm.accountNumber || !bankForm.accountName}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <Clock size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Đang lưu...' : 'Lưu thông tin thanh toán'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-violet-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Shield size={18} className="text-purple-600" /> Trạng thái tài khoản
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Trạng thái',
                value: String(currentTeacher?.status).toLowerCase() === 'active' ? 'Đang hoạt động' : String(currentTeacher?.status).toLowerCase() === 'pending' ? 'Cấp quyền thi' : String(currentTeacher?.status).toLowerCase() === 'inactive' ? 'Chưa cấp quyền' : String(currentTeacher?.status).toLowerCase() === 'locked' ? 'Đã khóa' : currentTeacher?.status || 'N/A',
                color: String(currentTeacher?.status).toLowerCase() === 'active' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50',
                icon: Shield,
              },
              {
                label: 'Điểm test',
                value: currentTeacher?.testScore != null ? `${currentTeacher.testScore}/100` : 'Chưa thi',
                color: (currentTeacher?.testScore || 0) >= 80 ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50',
                icon: Award,
              },
              {
                label: 'Lương/buổi',
                value: currentTeacher?.baseSalaryPerSession ? `${Number(currentTeacher.baseSalaryPerSession).toLocaleString('vi-VN')}đ` : 'Chưa cấu hình',
                color: 'text-blue-600 bg-blue-50',
                icon: DollarSign,
              },
              {
                label: 'Ngày tham gia',
                value: currentTeacher?.createdAt ? new Date(currentTeacher.createdAt).toLocaleDateString('vi-VN') : '—',
                color: 'text-purple-600 bg-purple-50',
                icon: Calendar,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className={`w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center ${color}`}>
                  <Icon size={20} />
                </div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</p>
                <p className={`text-sm font-black mt-1 ${color.split(' ')[0]}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default TeacherProfileSection;
