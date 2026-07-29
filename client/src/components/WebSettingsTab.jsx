/**
 * WebSettingsTab.jsx — Cài đặt Web (Logo, Favicon, Loading Screen)
 * Bố cục gọn: 1 card nhận diện + 1 card loading.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Upload, Loader2, Save, Image, Monitor,
  Check, X, Eye, Shield,
} from 'lucide-react';
import api, { resolveMediaUrl } from '../services/api';
import { useToast } from '../utils/toast';

function LoadingPreview({ style }) {
  const previewStyles = {
    1: (
      <div className="flex items-center justify-center h-full">
        <div className="w-7 h-7 rounded-full border-2 border-sky-200 border-t-red-600 animate-spin" />
      </div>
    ),
    2: (
      <div className="flex items-center justify-center h-full">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-red-500 to-red-600 animate-pulse shadow" />
      </div>
    ),
    3: (
      <div className="flex items-center justify-center h-full">
        <p className="text-[10px] font-mono text-gray-600 typing-text">Đang tải...</p>
      </div>
    ),
    4: (
      <div className="flex items-center justify-center h-full" style={{ perspective: '200px' }}>
        <div
          className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-red-600 rounded-md shadow"
          style={{ animation: 'cube3d 2s infinite linear', transformStyle: 'preserve-3d' }}
        />
      </div>
    ),
  };
  return previewStyles[style] || previewStyles[1];
}

function FaviconRow({
  label,
  tone = 'slate',
  value,
  onChange,
  onClear,
  inputRef,
  uploading,
  onUpload,
  fallbackSrc,
}) {
  const isRose = tone === 'rose';
  return (
    <div className={`rounded-xl border p-3 ${isRose ? 'border-rose-100 bg-rose-50/40' : 'border-slate-100 bg-slate-50/60'}`}>
      <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${isRose ? 'text-rose-700' : 'text-slate-500'}`}>
        {label}
      </p>
      <div className="flex items-center gap-2.5">
        <div className={`w-10 h-10 rounded-lg border bg-white flex items-center justify-center overflow-hidden flex-shrink-0 ${isRose ? 'border-rose-100' : 'border-slate-200'}`}>
          <img
            src={resolveMediaUrl(value) || value || fallbackSrc}
            alt=""
            className="w-6 h-6 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.ico,.svg"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed text-[11px] font-semibold transition disabled:opacity-50 whitespace-nowrap ${
              isRose
                ? 'border-rose-300 text-rose-700 hover:bg-white'
                : 'border-slate-300 text-slate-600 hover:bg-white'
            }`}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Upload…' : 'Tải lên'}
          </button>
          <input
            type="url"
            value={value}
            onChange={onChange}
            className={`flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-[11px] font-mono outline-none bg-white ${
              isRose ? 'border-rose-100 focus:border-rose-400' : 'border-slate-200 focus:border-blue-400'
            }`}
            placeholder="URL…"
          />
          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5 flex-shrink-0"
              title="Xóa — dùng mặc định"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function WebSettingsTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(null);
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

  useEffect(() => {
    setLoading(true);
    api.settings.getWeb()
      .then((res) => {
        if (res.success && res.data) {
          setConfig((prev) => ({
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

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.settings.uploadLogo(file);
      if (res.success) {
        setConfig((prev) => ({ ...prev, logoUrl: res.logoUrl }));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.settings.updateWeb(config);
      if (res.success) {
        toast.success('Đã lưu cấu hình Web');
        if (res.data) {
          setConfig((prev) => ({
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

  const handlePreview = () => {
    setPreviewLoading(true);
    setTimeout(() => setPreviewLoading(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" /> Đang tải cấu hình...
      </div>
    );
  }

  const LOADING_STYLES = [
    { id: 1, name: 'Tối giản', emoji: '⭕' },
    { id: 2, name: 'Thương hiệu', emoji: '💓' },
    { id: 3, name: 'Giáo dục', emoji: '⌨️' },
    { id: 4, name: 'Công nghệ', emoji: '🧊' },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
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
          max-width: 72px;
        }
        @keyframes typing { 0% { width: 0; } 50% { width: 72px; } 100% { width: 0; } }
        @keyframes blink { 50% { border-color: transparent; } }
      `}</style>

      {/* Nhận diện: Logo + Favicon */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Image size={14} className="text-blue-600" /> Nhận diện thương hiệu
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Logo (sidebar / login) · Favicon tab trình duyệt
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cms-btn cms-btn-primary !py-2 !px-3 !text-xs !rounded-lg disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>

        {/* Logo row */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {config.logoUrl ? (
              <img
                src={resolveMediaUrl(config.logoUrl) || config.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Image size={18} className="text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-1.5">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 text-[11px] font-semibold hover:bg-blue-50 transition disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Upload…' : 'Tải logo'}
            </button>
            <input
              type="url"
              value={config.logoUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, logoUrl: e.target.value }))}
              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-mono focus:border-blue-400 outline-none"
              placeholder="URL logo…"
            />
            {config.logoUrl ? (
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, logoUrl: '' }))}
                className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5 flex-shrink-0"
              >
                <X size={12} /> Xóa
              </button>
            ) : null}
          </div>
        </div>

        {/* Favicons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 md:col-span-2">
            <Shield size={11} className="text-rose-500" />
            Favicon · PNG / SVG / ICO / WEBP · tối đa 2MB
          </div>
          <FaviconRow
            label="Chung (HV / GV / Public)"
            tone="slate"
            value={config.faviconUrl}
            onChange={(e) => setConfig((prev) => ({ ...prev, faviconUrl: e.target.value }))}
            onClear={() => setConfig((prev) => ({ ...prev, faviconUrl: '' }))}
            inputRef={faviconPublicRef}
            uploading={uploadingFavicon === 'public'}
            onUpload={(file) => handleFaviconUpload(file, 'public')}
            fallbackSrc="/favicon.svg"
          />
          <FaviconRow
            label="Admin"
            tone="rose"
            value={config.faviconAdminUrl}
            onChange={(e) => setConfig((prev) => ({ ...prev, faviconAdminUrl: e.target.value }))}
            onClear={() => setConfig((prev) => ({ ...prev, faviconAdminUrl: '' }))}
            inputRef={faviconAdminRef}
            uploading={uploadingFavicon === 'admin'}
            onUpload={(file) => handleFaviconUpload(file, 'admin')}
            fallbackSrc="/favicon-admin.svg"
          />
        </div>
      </div>

      {/* Loading */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Monitor size={14} className="text-red-600" /> Hiệu ứng Loading
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Chọn 1 kiểu khi khởi động hệ thống</p>
          </div>
          <button
            type="button"
            onClick={handlePreview}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold hover:bg-red-100 transition"
          >
            <Eye size={12} /> Xem 3s
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {LOADING_STYLES.map((ls) => (
            <button
              key={ls.id}
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, loadingStyle: ls.id }))}
              className={`relative rounded-xl border p-2.5 text-left transition-all ${
                config.loadingStyle === ls.id
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {config.loadingStyle === ls.id && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              )}
              <div className="w-full h-12 bg-gray-50 rounded-lg mb-1.5 overflow-hidden">
                <LoadingPreview style={ls.id} />
              </div>
              <p className="text-[11px] font-bold text-gray-700">{ls.emoji} {ls.name}</p>
            </button>
          ))}
        </div>
      </div>

      {previewLoading && (
        <div
          className="fixed inset-0 bg-gray-900/90 flex flex-col items-center justify-center z-[200] animate-in fade-in duration-300"
          onClick={() => setPreviewLoading(false)}
          role="presentation"
        >
          <div className="mb-6 transform scale-150">
            <LoadingPreview style={config.loadingStyle} />
          </div>
          <p className="text-white/60 text-sm mt-4">Nhấn bất kỳ để đóng</p>
          <p className="text-white/30 text-xs mt-1">
            Kiểu {config.loadingStyle}: {LOADING_STYLES[config.loadingStyle - 1]?.name}
          </p>
        </div>
      )}
    </div>
  );
}
