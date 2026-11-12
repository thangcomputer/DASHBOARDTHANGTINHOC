/**
 * LoadingScreen.jsx - Màn hình và biểu tượng tải dữ liệu xịn xò chuẩn Thắng Tin Học
 * Hỗ trợ 4 phong cách 3D hiện đại, hiệu ứng ánh sáng gradient, vòng quay laser và thanh tiến trình.
 * Dùng cho: Khởi động hệ thống, xác thực tài khoản, tải trang (Suspense), và nạp dữ liệu tab.
 */
import React, { useEffect, useState, useMemo } from 'react';
import KineticDotsLoader from './ui/kinetic-dots-loader';

const API = import.meta.env.VITE_API_URL || '';

// Bộ nhớ cache tạm thời để tránh re-fetch lặp lại khi chuyển trang/tab
let _cachedSettings = null;
let _settingsFetchPromise = null;

async function getCachedWebSettings() {
  if (_cachedSettings) return _cachedSettings;
  if (_settingsFetchPromise) return _settingsFetchPromise;

  _settingsFetchPromise = (async () => {
    try {
      const r = await fetch(`${API}/api/settings/web`);
      const res = await r.json();
      if (res?.success && res?.data) {
        _cachedSettings = {
          loadingStyle: Number(res.data.loadingStyle) || 1,
          logoUrl: res.data.logoUrl || '/brand/logo.webp',
        };
        return _cachedSettings;
      }
    } catch {
      // Fallback mặc định
    }
    _cachedSettings = { loadingStyle: 1, logoUrl: '/brand/logo.webp' };
    return _cachedSettings;
  })();

  try {
    return await _settingsFetchPromise;
  } finally {
    _settingsFetchPromise = null;
  }
}

/**
 * LoadingScreen
 * @param {boolean} splash - Nếu là splash khởi động đầu tiên của app, tự động ẩn sau khi hoàn tất
 * @param {function} onReady - Callback khi splash kết thúc
 * @param {string} mode - 'fullscreen' | 'tab' | 'inline' | 'preview'
 * @param {string} message - Tiêu đề trạng thái (mặc định: 'Đang tải dữ liệu…')
 * @param {string} subtext - Dòng ghi chú nhỏ phía dưới
 * @param {number} style - Ép kiểu hiển thị (1..4) nếu cần
 */
export default function LoadingScreen({
  splash = false,
  onReady,
  mode = 'fullscreen',
  message = 'Đang tải dữ liệu…',
  subtext = 'Vui lòng đợi trong giây lát, hệ thống đang đồng bộ dữ liệu…',
  style: propStyle,
}) {
  const [style, setStyle] = useState(() => propStyle || _cachedSettings?.loadingStyle || 1);
  const [logoUrl, setLogoUrl] = useState(() => _cachedSettings?.logoUrl || '/brand/logo.webp');
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (propStyle) setStyle(propStyle);
  }, [propStyle]);

  useEffect(() => {
    let isMounted = true;
    getCachedWebSettings().then((cfg) => {
      if (!isMounted) return;
      if (!propStyle && cfg.loadingStyle) setStyle(cfg.loadingStyle);
      if (cfg.logoUrl) setLogoUrl(cfg.logoUrl);
    });

    // Nếu là splash khởi động lúc mở website
    if (splash) {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        setFading(true);
        setTimeout(() => {
          if (!isMounted) return;
          setShow(false);
          onReady?.();
        }, 350);
      }, 900); // 900ms đủ êm dịu, không giam người dùng quá lâu
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [splash, propStyle, onReady]);

  const resolvedLogo = useMemo(() => {
    if (!logoUrl) return '/brand/logo.webp';
    if (logoUrl.startsWith('http') || logoUrl.startsWith('/')) return logoUrl;
    return `${API}/${logoUrl}`;
  }, [logoUrl]);

  if (!show && splash) return null;

  // ─── Giao diện TAB COMPACT (khi nạp tab bên trong dashboard) ───
  if (mode === 'tab') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 min-h-[220px] w-full animate-in fade-in duration-300">
        <KineticDotsLoader dots={4} className="min-h-0 p-0" />
        <div className="mt-4 text-center">
          <p className="text-sm font-bold text-slate-700 tracking-wide">{message}</p>
        </div>
      </div>
    );
  }

  // ─── Giao diện INLINE / PREVIEW (nhỏ gọn trong card hoặc modal) ───
  if (mode === 'inline' || mode === 'preview') {
    return (
      <div className="flex flex-col items-center justify-center py-4 px-2 w-full">
        <LoadingIcon3D style={style} logoUrl={resolvedLogo} size="mini" />
        {message && <p className="mt-2 text-xs font-semibold text-slate-600">{message}</p>}
      </div>
    );
  }

  // ─── Giao diện TOÀN MÀN HÌNH (FULLSCREEN - XỊN XÒ) ───
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none transition-all duration-350 ${
        fading ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdf4 45%, #ecfeff 80%, #f1f5f9 100%)',
      }}
    >
      <LoadingStyles />

      {/* Hiệu ứng nền ambient glow mờ ảo phía sau */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[10%] -left-[10%] w-[55vw] h-[55vw] rounded-full blur-3xl opacity-35"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)' }}
        />
      </div>

      {/* Hộp thẻ kính 3D nổi bật ở giữa */}
      <div className="relative z-10 flex flex-col items-center px-8 py-8 md:px-12 md:py-10 rounded-[32px] bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_25px_60px_-15px_rgba(6,182,212,0.22),0_0_0_1px_rgba(6,182,212,0.08),0_8px_20px_rgba(0,0,0,0.04)] max-w-sm md:max-w-md w-[90%] text-center">
        {/* Biểu tượng 3D chính theo phong cách được chọn */}
        <div className="mb-4 relative flex items-center justify-center">
          <LoadingIcon3D style={style} logoUrl={resolvedLogo} size="large" />
        </div>

        {/* Nhãn thương hiệu */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-600">
            Thắng Tin Học
          </span>
        </div>

        {/* Tiêu đề trạng thái với gradient bóng bẩy */}
        <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-snug">
          {message}
        </h2>

        {/* Phụ đề gợi ý */}
        {subtext && (
          <p className="mt-2.5 text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Biểu tượng 3D tương ứng theo 4 kiểu phong cách:
 * Style 1: Tối giản (Luxury Orbital Dual Ring)
 * Style 2: Thương hiệu (Brand 3D Hologram + Radar Sonar Wave)
 * Style 3: Giáo dục (Data Stream / Smart Learning Core)
 * Style 4: Công nghệ (Isometric 3D Cyber Cube)
 */
export function LoadingIcon3D({ style = 1, logoUrl = '/brand/logo.webp', size = 'large' }) {
  const isLarge = size === 'large';
  const isMini = size === 'mini';

  const ringSize = isLarge ? 96 : isMini ? 40 : 64;
  const coreSize = isLarge ? 72 : isMini ? 30 : 48;
  const logoImgSize = isLarge ? 44 : isMini ? 18 : 30;

  // ─── Style 1: Kinetic Dots (Bouncing Liquid Spheres chuẩn chuyên nghiệp) ───
  if (style === 1) {
    return (
      <div className="flex flex-col items-center justify-center">
        <KineticDotsLoader dots={isMini ? 3 : 4} className={isMini ? 'min-h-0 p-0 scale-50' : 'min-h-0 p-0'} />
      </div>
    );
  }

  // ─── Style 2: Thương hiệu (3D Brand Badge + Sóng Radar Sonar) ───
  if (style === 2) {
    return (
      <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        {/* 2 vòng sóng radar lan tỏa */}
        <div className="absolute inset-0 rounded-3xl bg-emerald-400/25 loading-sonar-wave" />
        <div className="absolute inset-0 rounded-3xl bg-teal-400/20 loading-sonar-wave" style={{ animationDelay: '0.7s' }} />

        {/* Khối huy hiệu nổi 3D */}
        <div
          className="relative rounded-2xl bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/50 p-2 flex items-center justify-center shadow-[0_10px_25px_-5px_rgba(16,185,129,0.35),0_0_0_1.5px_rgba(16,185,129,0.3)] loading-badge-float"
          style={{ width: coreSize + 8, height: coreSize + 8 }}
        >
          <img
            src={logoUrl}
            alt="Logo"
            className="object-contain drop-shadow-md"
            style={{ width: logoImgSize + 4, height: logoImgSize + 4 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      </div>
    );
  }

  // ─── Style 3: Giáo dục (Dòng dữ liệu số & Lõi tri thức) ───
  if (style === 3) {
    return (
      <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        {/* Vòng quay tia sáng công nghệ */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 border-r-teal-400 loading-orbital-ring"
          style={{ boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}
        />

        {/* 3 hạt electron quỹ đạo bay quanh */}
        <div className="absolute inset-0 loading-orbital-counter">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] absolute -top-1 left-1/2 -translate-x-1/2" />
        </div>

        {/* Khối trung tâm biểu tượng sách / logo */}
        <div
          className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.4)] loading-core-pulse text-white font-black"
          style={{ width: coreSize, height: coreSize }}
        >
          <img
            src={logoUrl}
            alt="Logo"
            className="object-contain brightness-0 invert"
            style={{ width: logoImgSize, height: logoImgSize }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      </div>
    );
  }

  // ─── Style 4: Công nghệ (Khối lập phương 3D Isometric Neon) ───
  return (
    <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize, perspective: '400px' }}>
      {/* Vòng đĩa phát sáng chân đế */}
      <div
        className="absolute bottom-1 w-14 h-4 rounded-full bg-emerald-400/30 blur-[6px] loading-core-pulse"
      />

      {/* Khối cube xoay 3D */}
      <div
        className="loading-cube-3d-modern"
        style={{
          width: isLarge ? 42 : isMini ? 18 : 28,
          height: isLarge ? 42 : isMini ? 18 : 28,
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="cube-face cube-front" />
        <div className="cube-face cube-back" />
        <div className="cube-face cube-right" />
        <div className="cube-face cube-left" />
        <div className="cube-face cube-top" />
        <div className="cube-face cube-bottom" />
      </div>
    </div>
  );
}

/**
 * Preview nhanh cho màn hình Cài đặt Web (Admin WebSettingsTab)
 */
export function LoadingPreview({ style }) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <LoadingIcon3D style={style} size="mini" />
    </div>
  );
}

/**
 * TabFallback - Dành riêng cho Suspense lazy tab fallback
 */
export function TabFallback({ message = 'Đang tải dữ liệu…' }) {
  return <LoadingScreen mode="tab" message={message} />;
}

/**
 * Toàn bộ CSS Animation độc lập, hiệu năng cao và bóng bẩy
 */
function LoadingStyles() {
  return (
    <style>{`
      @keyframes orbitalSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes orbitalReverse {
        0% { transform: rotate(360deg); }
        100% { transform: rotate(0deg); }
      }
      @keyframes coreBreath {
        0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 12px rgba(16,185,129,0.15)); }
        50% { transform: scale(1.05); filter: drop-shadow(0 6px 20px rgba(16,185,129,0.35)); }
      }
      @keyframes badgeFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-4px) rotate(1deg); }
      }
      @keyframes sonarExpand {
        0% { transform: scale(0.85); opacity: 0.8; }
        100% { transform: scale(1.45); opacity: 0; }
      }
      @keyframes laserSweep {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(50%); }
        100% { transform: translateX(200%); }
      }
      @keyframes cubeIsoSpin {
        0%   { transform: rotateX(-22deg) rotateY(0deg); }
        50%  { transform: rotateX(-22deg) rotateY(180deg); }
        100% { transform: rotateX(-22deg) rotateY(360deg); }
      }

      .loading-orbital-ring {
        animation: orbitalSpin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.45));
      }
      .loading-orbital-counter {
        animation: orbitalReverse 2.4s linear infinite;
      }
      .loading-core-pulse {
        animation: coreBreath 2s ease-in-out infinite;
      }
      .loading-badge-float {
        animation: badgeFloat 2.6s ease-in-out infinite;
      }
      .loading-sonar-wave {
        animation: sonarExpand 1.8s cubic-bezier(0.1, 0.7, 0.3, 1) infinite;
      }
      .loading-laser-beam {
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%);
        border-radius: 999px;
        box-shadow: 0 0 10px #10b981, 0 0 4px #06b6d4;
        animation: laserSweep 1.4s ease-in-out infinite;
      }

      /* 3D Cube faces */
      .loading-cube-3d-modern {
        position: relative;
        animation: cubeIsoSpin 3.5s linear infinite;
        transform-origin: center center;
      }
      .cube-face {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.6);
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.75), rgba(6, 182, 212, 0.85));
        box-shadow: inset 0 0 8px rgba(255, 255, 255, 0.4), 0 0 12px rgba(16, 185, 129, 0.3);
      }
      .cube-front  { transform: translateZ(21px); }
      .cube-back   { transform: rotateY(180deg) translateZ(21px); }
      .cube-right  { transform: rotateY(90deg) translateZ(21px); }
      .cube-left   { transform: rotateY(-90deg) translateZ(21px); }
      .cube-top    { transform: rotateX(90deg) translateZ(21px); background: linear-gradient(135deg, rgba(52, 211, 153, 0.9), rgba(34, 211, 238, 0.9)); }
      .cube-bottom { transform: rotateX(-90deg) translateZ(21px); opacity: 0.6; }
    `}</style>
  );
}
