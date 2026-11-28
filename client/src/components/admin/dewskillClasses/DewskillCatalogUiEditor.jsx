import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import CmsSelect from '../../ui/CmsSelect';
import { resolveMediaUrl } from '../../../services/api';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { cmsConfirmAction } from '../../../utils/cmsDialog';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-slate-600';

const FALLBACK_GRADIENTS = [
  { id: 'dew-emerald', label: 'Xanh Ngọc DewSkill', value: 'linear-gradient(120deg, #16C172 0%, #0EA885 52%, #08949E 100%)' },
  { id: 'dew-mos-blue', label: 'Xanh Dương MOS', value: 'linear-gradient(120deg, #2563EB 0%, #0EA5E9 56%, #0D9488 100%)' },
  { id: 'dew-school-green', label: 'Xanh Lá Học Đường', value: 'linear-gradient(120deg, #10B981 0%, #059669 52%, #0284C7 100%)' },
  { id: 'dew-orange-excel', label: 'Cam Thực Chiến Excel', value: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 58%, #FBBF24 100%)' },
  { id: 'dew-deep-blue', label: 'Xanh Lam Sâu', value: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 54%, #60A5FA 100%)' },
  { id: 'dew-violet', label: 'Tím Học Thuật', value: 'linear-gradient(120deg, #6366F1 0%, #4F46E5 52%, #7C3AED 100%)' },
  { id: 'dew-rose', label: 'Hồng Nổi Bật', value: 'linear-gradient(120deg, #F43F5E 0%, #E11D48 54%, #FB7185 100%)' },
];

const FALLBACK_MASCOTS = [
  { label: 'Mascot Office W/X/P', url: '/mascot/wor-excel-powerpoint-mascot.gif' },
  { label: 'Mascot Tốt nghiệp MOS', url: '/mascot/tot-nghiep-vui-ve.gif' },
  { label: 'Mascot Năng động', url: '/mascot/nang-dong.gif' },
  { label: 'Mascot Vui vẻ', url: '/mascot/cam-xuc-vui.gif' },
  { label: 'Mascot Học bài', url: '/mascot/cam-xuc-hoc-bai.gif' },
  { label: 'Mascot Đọc sách', url: '/mascot/doc-sach.gif' },
];

const FALLBACK_TIERS = [
  { id: 'all', label: 'Tất cả khóa học' },
  { id: 'my-courses', label: 'Khóa của tôi' },
  { id: 'cap-1', label: 'Tiểu học (1–5)' },
  { id: 'cap-2', label: 'THCS (6–9)' },
  { id: 'cap-3', label: 'THPT (10–12)' },
  { id: 'mos', label: 'MOS' },
  { id: 'hs-sv', label: 'HS – Sinh viên' },
  { id: 'nguoi-di-lam', label: 'Người đi làm' },
  { id: 'chung-chi', label: 'Chứng chỉ khác' },
];

const CTA_PATH_OPTIONS = [
  { id: '/student/support', label: 'Trung tâm Hỗ trợ & Tư vấn (/student/support)' },
  { id: '/student/ai-packages', label: 'Trang Gói hỗ trợ AI (/student/ai-packages)' },
  { id: '/student/daily-practice', label: 'Phòng Luyện tập (/student/daily-practice)' },
  { id: '/student/cert-prep', label: 'Phòng Luyện thi chứng chỉ (/student/cert-prep)' },
];

function previewImgSrc(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('/mascot/')) return s;
  return resolveMediaUrl(s) || s;
}

function GradientPicker({ value, onChange, presets }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((g) => {
          const picked = value === g.value;
          return (
            <button
              key={g.id}
              type="button"
              title={g.label}
              onClick={() => onChange(g.value)}
              className={`relative h-7 w-10 rounded-lg border transition cursor-pointer ${
                picked ? 'border-slate-900 ring-2 ring-emerald-400 scale-105' : 'border-white/80 shadow-xs hover:scale-105'
              }`}
              style={{ background: g.value }}
              aria-label={g.label}
            >
              {picked ? (
                <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="linear-gradient(120deg, #16C172 0%, #0EA885 100%)"
        className={`${INPUT_CLASS} font-mono text-xs`}
      />
    </div>
  );
}

function ImageUploadButton({ onUploaded, toast, label = 'Tải ảnh từ máy' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await dewskillClassApi.uploadCatalogImage(file);
      const url = res?.data?.url;
      if (!url) throw new Error('Không nhận được đường dẫn ảnh');
      onUploaded(url);
      toast?.success('Đã tải ảnh lên thành công');
    } catch (err) {
      toast?.error(dewskillClassErrorMessage(err, 'Tải ảnh thất bại'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        <span>{uploading ? 'Đang tải...' : label}</span>
      </button>
    </>
  );
}

function LiveCatalogPreview({ config, activeSlideIndex }) {
  const slides = config.heroSlides || [];
  const activeSlide = slides[activeSlideIndex] || slides[0];
  const visibleMinis = (config.miniBanners || []).filter((m) => m.isActive !== false);
  const featured = config.featuredBanner || {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-emerald-600" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Xem trước bố cục trang Danh mục học viên
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          Nhấn &ldquo;Lưu giao diện Danh mục&rdquo; để áp dụng ngay cho học viên
        </span>
      </div>

      {/* Preview Tầng 1 */}
      {config.showHeroSection !== false ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {activeSlide ? (
            <div
              className={`relative flex min-h-[150px] items-center justify-between gap-4 overflow-hidden rounded-2xl p-4 text-white shadow-sm ${
                visibleMinis.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'
              }`}
              style={{ background: activeSlide.gradient }}
            >
              {activeSlide.imageMode === 'cover' && activeSlide.mascotUrl ? (
                <>
                  <img
                    src={previewImgSrc(activeSlide.mascotUrl)}
                    alt={activeSlide.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-900/45 to-transparent" />
                </>
              ) : null}

              <div className="relative z-10 flex w-full items-center gap-4">
                {activeSlide.imageMode !== 'cover' && activeSlide.mascotUrl ? (
                  <img
                    src={previewImgSrc(activeSlide.mascotUrl)}
                    alt={activeSlide.title}
                    className="h-20 w-20 shrink-0 object-contain drop-shadow-md"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      Slide {activeSlideIndex + 1}/{slides.length}
                      {activeSlide.isActive === false ? ' (Đang ẩn)' : ''}
                    </span>
                  </div>
                  <div className="truncate text-base font-black">{activeSlide.title}</div>
                  <div className="line-clamp-2 text-[11px] text-white/90">{activeSlide.description}</div>
                  <span className="mt-1 inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-emerald-700 shadow-xs">
                    {activeSlide.ctaLabel} →
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {visibleMinis.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
              {visibleMinis.map((mini) => (
                <div
                  key={mini.id}
                  className="flex items-center justify-between gap-2 rounded-2xl p-3 text-white shadow-sm"
                  style={{ background: mini.gradient }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-black">{mini.title}</div>
                    <div className="truncate text-[10px] text-white/90">{mini.subtitle}</div>
                  </div>
                  {mini.customImageUrl ? (
                    <img
                      src={previewImgSrc(mini.customImageUrl)}
                      alt={mini.title}
                      className="h-9 w-9 shrink-0 rounded-xl object-cover border border-white/50"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-[10px] font-black">
                      {mini.visual === 'trophy' ? 'MOS' : 'Ex='}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-center text-xs font-semibold text-slate-500">
          Cụm Banner quảng cáo đang bị ẩn
        </div>
      )}

      {/* Preview Tầng 2 + Tầng 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
            {config.showFilterBar !== false ? 'Thanh bộ lọc: Đang hiện' : 'Thanh bộ lọc: Đang ẩn'}
          </span>
          <span className="uppercase tracking-wide text-slate-900">
            Tiêu đề: {config.sectionTitle || 'KHÓA HỌC PHÙ HỢP'}
          </span>
        </div>

        {config.showFeaturedBanner !== false ? (
          <div
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1 text-white shadow-xs"
            style={{ background: featured.gradient }}
          >
            <span className="text-[11px] font-black">
              {featured.titleLine1} {featured.titleLine2}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {featured.ctaLabel}
            </span>
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400">Thẻ dọc chọn lọc: Đang ẩn</span>
        )}
      </div>
    </div>
  );
}

export default function DewskillCatalogUiEditor({ toast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState(null);
  const [presets, setPresets] = useState({
    gradients: FALLBACK_GRADIENTS,
    mascots: FALLBACK_MASCOTS,
    tiers: FALLBACK_TIERS,
  });
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dewskillClassApi.getCatalogUi();
      setConfig(res.data || null);
      if (res.presets) {
        setPresets({
          gradients: res.presets.gradients?.length ? res.presets.gradients : FALLBACK_GRADIENTS,
          mascots: res.presets.mascots?.length ? res.presets.mascots : FALLBACK_MASCOTS,
          tiers: res.presets.tiers?.length ? res.presets.tiers : FALLBACK_TIERS,
        });
      }
      setActiveSlideIdx(0);
    } catch (err) {
      toast?.error(dewskillClassErrorMessage(err, 'Không tải được cấu hình giao diện Danh mục'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await dewskillClassApi.updateCatalogUi(config);
      setConfig(res.data || config);
      toast?.success(res.message || 'Đã lưu giao diện Danh mục khóa học');
    } catch (err) {
      toast?.error(dewskillClassErrorMessage(err, 'Lưu cấu hình thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await cmsConfirmAction(
      'Khôi phục toàn bộ Banner, Mini Banner, Thẻ dọc DewSkill Chọn lọc và tiêu đề về cấu hình mặc định ban đầu?',
      {
        title: 'Khôi phục giao diện mặc định',
        type: 'warning',
        confirmText: 'Khôi phục',
      }
    );
    if (!ok) return;

    setResetting(true);
    try {
      const res = await dewskillClassApi.resetCatalogUi();
      setConfig(res.data || null);
      setActiveSlideIdx(0);
      toast?.success(res.message || 'Đã khôi phục giao diện mặc định');
    } catch (err) {
      toast?.error(dewskillClassErrorMessage(err, 'Không khôi phục được mặc định'));
    } finally {
      setResetting(false);
    }
  };

  const updateSlide = (idx, patch) => {
    setConfig((prev) => {
      const nextSlides = [...(prev.heroSlides || [])];
      nextSlides[idx] = { ...nextSlides[idx], ...patch };
      return { ...prev, heroSlides: nextSlides };
    });
  };

  const addSlide = () => {
    if (!config) return;
    const slides = config.heroSlides || [];
    if (slides.length >= 6) {
      toast?.warning('Tối đa 6 slide banner chính.');
      return;
    }
    const newSlide = {
      id: `slide-${Date.now()}`,
      title: `Banner mới ${slides.length + 1}`,
      description: 'Mô tả ngắn gọn điểm nổi bật của lộ trình hoặc ưu đãi học thử.',
      ctaLabel: 'Khám phá ngay',
      mascotUrl: presets.mascots[0]?.url || '/mascot/nang-dong.gif',
      imageMode: 'mascot',
      showOfficeBadges: false,
      gradient: presets.gradients[slides.length % presets.gradients.length]?.value || FALLBACK_GRADIENTS[0].value,
      action: { type: 'scroll', tier: '' },
      isActive: true,
    };
    setConfig((prev) => ({
      ...prev,
      heroSlides: [...(prev.heroSlides || []), newSlide],
    }));
    setActiveSlideIdx(slides.length);
  };

  const removeSlide = (idx) => {
    const slides = config?.heroSlides || [];
    if (slides.length <= 1) {
      toast?.warning('Cần giữ lại ít nhất 1 slide banner chính.');
      return;
    }
    const nextSlides = slides.filter((_, i) => i !== idx);
    setConfig((prev) => ({ ...prev, heroSlides: nextSlides }));
    setActiveSlideIdx((prevIdx) => Math.max(0, Math.min(prevIdx, nextSlides.length - 1)));
  };

  const moveSlide = (idx, dir) => {
    const slides = [...(config?.heroSlides || [])];
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    [slides[idx], slides[target]] = [slides[target], slides[idx]];
    setConfig((prev) => ({ ...prev, heroSlides: slides }));
    setActiveSlideIdx(target);
  };

  const updateMiniBanner = (idx, patch) => {
    setConfig((prev) => {
      const next = [...(prev.miniBanners || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, miniBanners: next };
    });
  };

  const updateFeatured = (patch) => {
    setConfig((prev) => ({
      ...prev,
      featuredBanner: { ...(prev.featuredBanner || {}), ...patch },
    }));
  };

  if (loading || !config) {
    return (
      <div className="cms-card flex min-h-[240px] items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 size={20} className="animate-spin text-emerald-600" />
        <span>Đang tải cấu hình giao diện Danh mục DewSkill...</span>
      </div>
    );
  }

  const slides = config.heroSlides || [];
  const safeIdx = Math.min(activeSlideIdx, Math.max(0, slides.length - 1));
  const currentSlide = slides[safeIdx] || slides[0];
  const minis = config.miniBanners || [];
  const featured = config.featuredBanner || {};

  return (
    <div className="space-y-5">
      {/* Thanh lưu & khôi phục */}
      <div className="cms-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Palette size={17} className="text-emerald-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Trình chỉnh sửa Giao diện Danh mục khóa học DewSkill
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Tuỳ biến Banner Carousel, 2 Mini Banner, thẻ dọc DewSkill Chọn lọc, bật/tắt khu vực và tải ảnh riêng.
            {config.updatedAt ? (
              <span className="ml-2 font-semibold text-emerald-700">
                · Cập nhật lúc {new Date(config.updatedAt).toLocaleString('vi-VN')}
                {config.updatedBy ? ` (${config.updatedBy})` : ''}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={resetting || saving}
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            <span>Khôi phục mặc định</span>
          </button>

          <button
            type="button"
            disabled={saving || resetting}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Lưu giao diện Danh mục</span>
          </button>
        </div>
      </div>

      {/* Xem trước */}
      <LiveCatalogPreview config={config} activeSlideIndex={safeIdx} />

      {/* Cài đặt hiển thị & Tiêu đề chung */}
      <div className="cms-card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <LayoutTemplate size={16} className="text-emerald-600" />
          <h4 className="text-sm font-extrabold text-slate-900">1. Cài đặt hiển thị &amp; Tiêu đề khu vực</h4>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label className={LABEL_CLASS} htmlFor="cat-ui-section-title">
              Tiêu đề lưới khóa học (Tầng 3)
            </label>
            <input
              id="cat-ui-section-title"
              type="text"
              value={config.sectionTitle || ''}
              onChange={(e) => setConfig((p) => ({ ...p, sectionTitle: e.target.value }))}
              placeholder="KHÓA HỌC PHÙ HỢP"
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-3">
            <label className={LABEL_CLASS} htmlFor="cat-ui-autoplay">
              Tự chuyển slide (giây)
            </label>
            <input
              id="cat-ui-autoplay"
              type="number"
              min={2}
              max={20}
              step={0.5}
              value={config.autoPlaySeconds ?? 5.5}
              onChange={(e) => setConfig((p) => ({ ...p, autoPlaySeconds: Number(e.target.value) || 5.5 }))}
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-12 flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showHeroSection !== false}
                onChange={(e) => setConfig((p) => ({ ...p, showHeroSection: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Hiện cụm Banner quảng cáo (Tầng 1)
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showFilterBar !== false}
                onChange={(e) => setConfig((p) => ({ ...p, showFilterBar: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Hiện thanh Bộ lọc cấp học &amp; trình độ (Tầng 2)
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showFeaturedBanner !== false}
                onChange={(e) => setConfig((p) => ({ ...p, showFeaturedBanner: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Hiện thẻ dọc DEWSKILL CHỌN LỌC ở lưới mặc định
            </label>
          </div>
        </div>
      </div>

      {/* 2. Banner Carousel chính */}
      <div className="cms-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-600" />
            <h4 className="text-sm font-extrabold text-slate-900">
              2. Banner Carousel chính ({slides.length}/6 slide)
            </h4>
          </div>

          <button
            type="button"
            onClick={addSlide}
            disabled={slides.length >= 6}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm slide</span>
          </button>
        </div>

        {/* Tab chọn slide */}
        <div className="flex flex-wrap items-center gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.id || idx}
              type="button"
              onClick={() => setActiveSlideIdx(idx)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                idx === safeIdx
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Slide {idx + 1}</span>
              {s.isActive === false ? (
                <span className="rounded bg-amber-400/20 px-1 text-[10px] text-amber-300">Ẩn</span>
              ) : null}
            </button>
          ))}
        </div>

        {currentSlide ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSlide.isActive !== false}
                  onChange={(e) => updateSlide(safeIdx, { isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Hiển thị slide này ngoài trang học viên
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeIdx === 0}
                  onClick={() => moveSlide(safeIdx, -1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  title="Đưa slide lên trước"
                >
                  <ArrowLeft size={13} />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  disabled={safeIdx >= slides.length - 1}
                  onClick={() => moveSlide(safeIdx, 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  title="Đưa slide ra sau"
                >
                  <span>Sau</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  disabled={slides.length <= 1}
                  onClick={() => removeSlide(safeIdx)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Xóa</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <label className={LABEL_CLASS}>Tiêu đề chính *</label>
                <input
                  type="text"
                  value={currentSlide.title || ''}
                  onChange={(e) => updateSlide(safeIdx, { title: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-5">
                <label className={LABEL_CLASS}>Nhãn nút bấm (CTA)</label>
                <input
                  type="text"
                  value={currentSlide.ctaLabel || ''}
                  onChange={(e) => updateSlide(safeIdx, { ctaLabel: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-12">
                <label className={LABEL_CLASS}>Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={currentSlide.description || ''}
                  onChange={(e) => updateSlide(safeIdx, { description: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-4">
                <span className={LABEL_CLASS}>Hành động khi bấm nút CTA</span>
                <CmsSelect
                  value={currentSlide.action?.type || 'scroll'}
                  onChange={(e) =>
                    updateSlide(safeIdx, {
                      action: {
                        type: e.target.value,
                        tier: e.target.value === 'tier' ? (currentSlide.action?.tier || 'mos') : '',
                      },
                    })
                  }
                >
                  <option value="scroll">Cuộn xuống lưới khóa học</option>
                  <option value="tier">Lọc nhanh theo nhóm lớp</option>
                </CmsSelect>
              </div>

              {currentSlide.action?.type === 'tier' ? (
                <div className="sm:col-span-4">
                  <span className={LABEL_CLASS}>Nhóm lớp mục tiêu</span>
                  <CmsSelect
                    value={currentSlide.action?.tier || 'mos'}
                    onChange={(e) =>
                      updateSlide(safeIdx, {
                        action: { type: 'tier', tier: e.target.value },
                      })
                    }
                  >
                    {presets.tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </CmsSelect>
                </div>
              ) : null}

              <div className={currentSlide.action?.type === 'tier' ? 'sm:col-span-4' : 'sm:col-span-8'}>
                <span className={LABEL_CLASS}>Kiểu hiển thị hình ảnh</span>
                <CmsSelect
                  value={currentSlide.imageMode || 'mascot'}
                  onChange={(e) => updateSlide(safeIdx, { imageMode: e.target.value })}
                >
                  <option value="mascot">Mascot / Ảnh minh hoạ bên trái</option>
                  <option value="cover">Ảnh nền phủ toàn Banner</option>
                </CmsSelect>
              </div>

              <div className="sm:col-span-6">
                <span className={LABEL_CLASS}>Màu nền Gradient</span>
                <GradientPicker
                  value={currentSlide.gradient}
                  presets={presets.gradients}
                  onChange={(gradient) => updateSlide(safeIdx, { gradient })}
                />
              </div>

              <div className="sm:col-span-6 space-y-2">
                <span className={LABEL_CLASS}>Hình Mascot / Ảnh Banner riêng</span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[180px] flex-1">
                    <CmsSelect
                      value={
                        presets.mascots.some((m) => m.url === currentSlide.mascotUrl)
                          ? currentSlide.mascotUrl
                          : '__custom__'
                      }
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          updateSlide(safeIdx, { mascotUrl: e.target.value });
                        }
                      }}
                    >
                      {presets.mascots.map((m) => (
                        <option key={m.url} value={m.url}>
                          {m.label}
                        </option>
                      ))}
                      {!presets.mascots.some((m) => m.url === currentSlide.mascotUrl) ? (
                        <option value="__custom__">Ảnh tải lên tuỳ chỉnh</option>
                      ) : null}
                    </CmsSelect>
                  </div>
                  <ImageUploadButton
                    toast={toast}
                    label="Tải ảnh lên"
                    onUploaded={(url) => updateSlide(safeIdx, { mascotUrl: url })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  {currentSlide.mascotUrl ? (
                    <img
                      src={previewImgSrc(currentSlide.mascotUrl)}
                      alt="Xem trước ảnh slide"
                      className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1"
                    />
                  ) : null}
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(currentSlide.showOfficeBadges)}
                      onChange={(e) => updateSlide(safeIdx, { showOfficeBadges: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Hiện badge bay W / X / P quanh Mascot
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. 2 Mini Banner bên phải */}
      <div className="cms-card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <ImagePlus size={16} className="text-emerald-600" />
          <h4 className="text-sm font-extrabold text-slate-900">3. Hai Mini Banner bên phải</h4>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {minis.map((mini, idx) => (
            <div key={mini.id || idx} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-800">
                  Mini Banner #{idx + 1}
                </span>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mini.isActive !== false}
                    onChange={(e) => updateMiniBanner(idx, { isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Hiển thị
                </label>
              </div>

              <div>
                <label className={LABEL_CLASS}>Tiêu đề</label>
                <input
                  type="text"
                  value={mini.title || ''}
                  onChange={(e) => updateMiniBanner(idx, { title: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Phụ đề</label>
                <input
                  type="text"
                  value={mini.subtitle || ''}
                  onChange={(e) => updateMiniBanner(idx, { subtitle: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className={LABEL_CLASS}>Khi bấm sẽ lọc nhóm</span>
                  <CmsSelect
                    value={mini.targetTier || 'mos'}
                    onChange={(e) => updateMiniBanner(idx, { targetTier: e.target.value })}
                  >
                    {presets.tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </CmsSelect>
                </div>

                <div>
                  <span className={LABEL_CLASS}>Biểu tượng mặc định</span>
                  <CmsSelect
                    value={mini.visual || 'trophy'}
                    onChange={(e) => updateMiniBanner(idx, { visual: e.target.value })}
                  >
                    <option value="trophy">Cúp MOS 3D</option>
                    <option value="excel-chart">Biểu đồ Excel</option>
                  </CmsSelect>
                </div>
              </div>

              <div>
                <span className={LABEL_CLASS}>Màu nền Gradient</span>
                <GradientPicker
                  value={mini.gradient}
                  presets={presets.gradients}
                  onChange={(gradient) => updateMiniBanner(idx, { gradient })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ImageUploadButton
                  toast={toast}
                  label="Tải ảnh riêng (thay icon)"
                  onUploaded={(url) => updateMiniBanner(idx, { customImageUrl: url })}
                />
                {mini.customImageUrl ? (
                  <>
                    <img
                      src={previewImgSrc(mini.customImageUrl)}
                      alt={mini.title}
                      className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateMiniBanner(idx, { customImageUrl: '' })}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Dùng lại icon SVG
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Thẻ dọc DewSkill Chọn lọc */}
      <div className="cms-card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Sparkles size={16} className="text-emerald-600" />
          <h4 className="text-sm font-extrabold text-slate-900">
            4. Thẻ dọc nổi bật trong lưới khóa học ({featured.titleLine1 || 'DEWSKILL'} {featured.titleLine2 || 'CHỌN LỌC'})
          </h4>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <label className={LABEL_CLASS}>Dòng tiêu đề 1</label>
            <input
              type="text"
              value={featured.titleLine1 || ''}
              onChange={(e) => updateFeatured({ titleLine1: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-3">
            <label className={LABEL_CLASS}>Dòng tiêu đề 2</label>
            <input
              type="text"
              value={featured.titleLine2 || ''}
              onChange={(e) => updateFeatured({ titleLine2: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-3">
            <label className={LABEL_CLASS}>Nhãn nút bấm</label>
            <input
              type="text"
              value={featured.ctaLabel || ''}
              onChange={(e) => updateFeatured({ ctaLabel: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-3">
            <span className={LABEL_CLASS}>Trang đích khi bấm</span>
            <CmsSelect
              value={
                CTA_PATH_OPTIONS.some((o) => o.id === featured.ctaPath)
                  ? featured.ctaPath
                  : '/student/support'
              }
              onChange={(e) => updateFeatured({ ctaPath: e.target.value })}
            >
              {CTA_PATH_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </CmsSelect>
          </div>

          <div className="sm:col-span-12">
            <label className={LABEL_CLASS}>Mô tả ngắn</label>
            <input
              type="text"
              value={featured.subtitle || ''}
              onChange={(e) => updateFeatured({ subtitle: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-6">
            <span className={LABEL_CLASS}>Màu nền Gradient</span>
            <GradientPicker
              value={featured.gradient}
              presets={presets.gradients}
              onChange={(gradient) => updateFeatured({ gradient })}
            />
          </div>

          <div className="sm:col-span-6 space-y-2">
            <span className={LABEL_CLASS}>Mascot / Ảnh thẻ dọc</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[180px] flex-1">
                <CmsSelect
                  value={
                    presets.mascots.some((m) => m.url === featured.mascotUrl)
                      ? featured.mascotUrl
                      : '__custom__'
                  }
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      updateFeatured({ mascotUrl: e.target.value });
                    }
                  }}
                >
                  {presets.mascots.map((m) => (
                    <option key={m.url} value={m.url}>
                      {m.label}
                    </option>
                  ))}
                  {!presets.mascots.some((m) => m.url === featured.mascotUrl) ? (
                    <option value="__custom__">Ảnh tải lên tuỳ chỉnh</option>
                  ) : null}
                </CmsSelect>
              </div>
              <ImageUploadButton
                toast={toast}
                label="Tải ảnh lên"
                onUploaded={(url) => updateFeatured({ mascotUrl: url })}
              />
              {featured.mascotUrl ? (
                <img
                  src={previewImgSrc(featured.mascotUrl)}
                  alt="Mascot thẻ dọc"
                  className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
