/**
 * WebSettingsTab.jsx — Cài đặt Web (Logo, Favicon, Loading Screen)
 * Chỉ Super Admin truy cập. Nằm trong SystemSettingsTab.
 * Thông báo Nhân viên: dùng tab Popup thông báo (đối tượng = Nhân viên).
 */
import { useState, useEffect, useRef } from 'react';
import {
  Globe, Upload, Loader2, Save, Image, Monitor,
  Check, X, Eye, Shield,
} from 'lucide-react';
import api, { resolveMediaUrl } from '../services/api';
import { useToast } from '../utils/toast';

// ── Loading Preview Mini ─────────────────────────────────────────────────────
function LoadingPreview({ style }) {
  const previewStyles = {
    1: (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 rounded-full border-3 border-sky-200 border-t-red-600 animate-spin" />
      </div>
    ),
    2: (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 animate-pulse shadow-lg" />
      </div>
    ),
    3: (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs font-mono text-gray-600 typing-text">Đang tải...</p>
      </div>
    ),
    4: (
      <div className="flex items-center justify-center h-full" style={{ perspective: '200px' }}>
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-red-600 rounded-lg shadow-lg"
          style={{ animation: 'cube3d 2s infinite linear', transformStyle: 'preserve-3d' }} />
      </div>
    ),
  };
  return previewStyles[style] || previewStyles[1];
}

export default function WebSettingsTab() {
  const toast = useToast();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(null); // 'public' | 'admin' | null
  const logoInputRef = useRef(null);
  const faviconPublicRef = useRef(null);
  const faviconAdminRef = useRef(null);

  const [config, setConfig] = useState({
    logoUrl: '',
    faviconUrl: '',
    faviconAdminUrl: '',
    loadingStyle: 1,
  });

  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch web settings
  useEffect(() => {
    setLoading(true);
    api.settings.getWeb()
      .then(res => {
        if (res.success && res.data) {
          setConfig(prev => ({
            ...prev,
            logoUrl: res.data.logoUrl || '',
            faviconUrl: res.data.faviconUrl || '',
            faviconAdminUrl: res.data.faviconAdminUrl || '',
            loadingStyle: res.data.loadingStyle || 1,
          }));
        }
      })
      .catch(() => toast.error('Không tải được cài đặt Web'))
      .finally(() => setLoading(false));
  }, []);

  // Upload logo
  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.settings.uploadLogo(file);
      if (res.success) {
        setConfig(prev => ({ ...prev, logoUrl: res.logoUrl }));
        toast.success('Upload logo thành công');
      } else {
        toast.error(res.message || 'Upload logo thất bại');
      }
    } catch {
      toast.error('Lỗi upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleFaviconUpload = async (file, kind) => {
    if (!file) return;
    setUploadingFavicon(kind);
    try {
      const res = await api.settings.uploadFavicon(file, kind);
      if (res.success) {
        const url = res.faviconUrl || res.faviconAdminUrl || '';
        setConfig((prev) => ({
          ...prev,
          ...(kind === 'admin' ? { faviconAdminUrl: url } : { faviconUrl: url }),
        }));
        toast.success(kind === 'admin' ? 'Upload favicon Admin thành công' : 'Upload favicon thành công');
        window.dispatchEvent(new Event('web-settings-changed'));
      } else {
        toast.error(res.message || 'Upload favicon thất bại');
      }
    } catch {
      toast.error('Lỗi upload favicon');
    } finally {
      setUploadingFavicon(null);
    }
  };

  // Save all web settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.settings.updateWeb(config);
      if (res.success) {
        toast.success('Đã lưu cấu hình Web');
        if (res.data) {
          setConfig(prev => ({
            ...prev,
            logoUrl: res.data.logoUrl ?? prev.logoUrl,
            faviconUrl: res.data.faviconUrl ?? prev.faviconUrl,
            faviconAdminUrl: res.data.faviconAdminUrl ?? prev.faviconAdminUrl,
            loadingStyle: res.data.loadingStyle ?? prev.loadingStyle,
          }));
        }
        window.dispatchEvent(new Event('web-settings-changed'));
      } else {
        toast.error(res.message || 'Lưu thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  // Preview loading effect
  const handlePreview = () => {
    setPreviewLoading(true);
    setTimeout(() => setPreviewLoading(false), 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
      <Loader2 size={20} className="animate-spin" /> Đang tải cấu hình...
    </div>
  );

  const LOADING_STYLES = [
    { id: 1, name: 'Tối giản',    desc: 'Vòng xoay vệt sáng gradient',     emoji: '⭕' },
    { id: 2, name: 'Thương hiệu', desc: 'Logo nhịp đập (Pulse Effect)',     emoji: '💓' },
    { id: 3, name: 'Giáo dục',    desc: 'Hiệu ứng gõ chữ (Typewriter)',    emoji: '⌨️' },
    { id: 4, name: 'Công nghệ',   desc: 'Khối 3D xoay lơ lửng',           emoji: '🧊' },
  ];

  return (
    <div className="space-y-8">
      <style>{`
        @keyframes cube3d {
          0%   { transform: rotateX(0deg) rotateY(0deg); }
          25%  { transform: rotateX(90deg) rotateY(0deg); }
          50%  { transform: rotateX(90deg) rotateY(90deg); }
          75%  { transform: rotateX(0deg) rotateY(90deg); }
          100% { transform: rotateX(0deg) rotateY(0deg); }
        }
        .typing-text {
          overflow: hidden;
          white-space: nowrap;
          border-right: 2px solid #666;
          animation: typing 2s steps(12) infinite, blink 0.5s step-end infinite alternate;
          width: 0;
          max-width: 80px;
        }
        @keyframes typing { 0% { width: 0; } 50% { width: 80px; } 100% { width: 0; } }
        @keyframes blink { 50% { border-color: transparent; } }
      `}</style>

      {/* ══════════════ PHẦN 1: LOGO ══════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Image size={16} className="text-blue-600" />
          <h3 className="font-bold text-gray-800">Logo thương hiệu</h3>
        </div>
        <p className="text-xs text-gray-400">
          Logo hiển thị trên: Sidebar, Trang đăng nhập Public, Trang đăng nhập Admin.
        </p>

        <div className="flex items-start gap-6">
          {/* Preview */}
          <div className="w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {config.logoUrl ? (
              <img
                src={resolveMediaUrl(config.logoUrl) || config.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="text-center text-gray-300">
                <Image size={28} className="mx-auto mb-1" />
                <p className="text-[10px]">Chưa có logo</p>
              </div>
            )}
          </div>

          {/* Upload controls */}
          <div className="flex-1 space-y-3">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleLogoUpload(e.target.files?.[0])} />
            <button onClick={() => logoInputRef.current?.click()} disabled={uploading}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl py-3 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 font-medium text-sm transition disabled:opacity-50">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Đang upload...' : 'Tải ảnh logo lên'}
            </button>

            {/* URL fallback */}
            <input type="url" value={config.logoUrl}
              onChange={e => setConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-400 outline-none"
              placeholder="Hoặc nhập URL logo trực tiếp..." />

            {config.logoUrl && (
              <button onClick={() => setConfig(prev => ({ ...prev, logoUrl: '' }))}
                className="text-xs text-red-500 hover:underline flex items-center gap-1">
                <X size={12} /> Xóa logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ PHẦN 1b: FAVICON ══════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-rose-600" />
          <h3 className="font-bold text-gray-800">Favicon (icon tab trình duyệt)</h3>
        </div>
        <p className="text-xs text-gray-400">
          Tải ảnh PNG / SVG / ICO / WEBP (tối đa 2MB). Để trống sẽ dùng icon mặc định của hệ thống.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Favicon public */}
          <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Favicon chung (HV / GV / Public)</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                <img
                  src={resolveMediaUrl(config.faviconUrl) || config.faviconUrl || '/favicon.svg'}
                  alt="Favicon"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  ref={faviconPublicRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="hidden"
                  onChange={(e) => handleFaviconUpload(e.target.files?.[0], 'public')}
                />
                <button
                  type="button"
                  onClick={() => faviconPublicRef.current?.click()}
                  disabled={uploadingFavicon === 'public'}
                  className="w-full border-2 border-dashed border-slate-300 rounded-xl py-2.5 text-slate-600 hover:bg-white flex items-center justify-center gap-2 font-medium text-xs transition disabled:opacity-50"
                >
                  {uploadingFavicon === 'public' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingFavicon === 'public' ? 'Đang upload...' : 'Tải favicon lên'}
                </button>
              </div>
            </div>
            <input
              type="url"
              value={config.faviconUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, faviconUrl: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-400 outline-none bg-white"
              placeholder="Hoặc nhập URL favicon..."
            />
            {config.faviconUrl && (
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, faviconUrl: '' }))}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <X size={12} /> Xóa — dùng mặc định
              </button>
            )}
          </div>

          {/* Favicon admin */}
          <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-xs font-black text-rose-700 uppercase tracking-widest">Favicon Admin</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-xl border border-rose-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                <img
                  src={resolveMediaUrl(config.faviconAdminUrl) || config.faviconAdminUrl || '/favicon-admin.svg'}
                  alt="Favicon Admin"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  ref={faviconAdminRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="hidden"
                  onChange={(e) => handleFaviconUpload(e.target.files?.[0], 'admin')}
                />
                <button
                  type="button"
                  onClick={() => faviconAdminRef.current?.click()}
                  disabled={uploadingFavicon === 'admin'}
                  className="w-full border-2 border-dashed border-rose-300 rounded-xl py-2.5 text-rose-700 hover:bg-white flex items-center justify-center gap-2 font-medium text-xs transition disabled:opacity-50"
                >
                  {uploadingFavicon === 'admin' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingFavicon === 'admin' ? 'Đang upload...' : 'Tải favicon Admin lên'}
                </button>
              </div>
            </div>
            <input
              type="url"
              value={config.faviconAdminUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, faviconAdminUrl: e.target.value }))}
              className="w-full border-2 border-rose-100 rounded-xl px-3 py-2 text-xs font-mono focus:border-rose-400 outline-none bg-white"
              placeholder="Hoặc nhập URL favicon Admin..."
            />
            {config.faviconAdminUrl && (
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, faviconAdminUrl: '' }))}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <X size={12} /> Xóa — dùng mặc định Admin
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ PHẦN 2: LOADING SCREEN ══════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-red-600" />
            <h3 className="font-bold text-gray-800">Hiệu ứng Loading</h3>
          </div>
          <button onClick={handlePreview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition">
            <Eye size={13} /> Xem trước 3s
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Chọn 1 trong 4 kiểu loading hiển thị khi khởi động hệ thống.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LOADING_STYLES.map(ls => (
            <button key={ls.id}
              onClick={() => setConfig(prev => ({ ...prev, loadingStyle: ls.id }))}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                config.loadingStyle === ls.id
                  ? 'border-red-500 bg-red-50 shadow-md shadow-red-100'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {config.loadingStyle === ls.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
              <div className="w-full h-20 bg-gray-50 rounded-xl mb-3 overflow-hidden">
                <LoadingPreview style={ls.id} />
              </div>
              <p className="text-xs font-black text-gray-700">{ls.emoji} {ls.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{ls.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ NÚT LƯU ══════════════ */}
      <button onClick={handleSave} disabled={saving}
        className="cms-btn cms-btn-primary w-full max-w-2xl py-3.5 text-[15px] font-bold rounded-xl disabled:opacity-40 mx-auto">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Đang lưu...' : 'Lưu toàn bộ cài đặt Web'}
      </button>

      {/* ══════════════ MODAL PREVIEW LOADING ══════════════ */}
      {previewLoading && (
        <div className="fixed inset-0 bg-gray-900/90 flex flex-col items-center justify-center z-[200] animate-in fade-in duration-300"
          onClick={() => setPreviewLoading(false)}>
          <div className="mb-6 transform scale-150">
            <LoadingPreview style={config.loadingStyle} />
          </div>
          <p className="text-white/60 text-sm mt-4">Nhấn bất kỳ để đóng</p>
          <p className="text-white/30 text-xs mt-1">Kiểu {config.loadingStyle}: {LOADING_STYLES[config.loadingStyle - 1]?.name}</p>
        </div>
      )}
    </div>
  );
}
