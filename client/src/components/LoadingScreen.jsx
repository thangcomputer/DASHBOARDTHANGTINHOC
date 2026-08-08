/**
 * LoadingScreen.jsx — splash khi khởi tạo app (tuỳ loadingStyle từ API).
 * Không được chặn login lâu: delay ngắn, abort fetch nhanh.
 */
import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';
/** Dev: gần như bỏ splash. Prod: tối đa 400ms sau khi settings về (trước đây cố định 1500ms). */
const SPLASH_MS = import.meta.env.DEV ? 0 : 400;

export default function LoadingScreen({ onReady }) {
  const [style, setStyle] = useState(1);
  const [logoUrl, setLogoUrl] = useState('');
  const [show, setShow] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const kill = setTimeout(() => ctrl?.abort(), 2500);

    const finish = () => {
      if (cancelled) return;
      const hide = () => {
        if (cancelled) return;
        setShow(false);
        onReady?.();
      };
      if (SPLASH_MS <= 0) hide();
      else setTimeout(hide, SPLASH_MS);
    };

    // Trang login: bỏ splash ngay — không chờ settings
    try {
      const path = window.location.pathname || '';
      if (/\/(login|admin\/login|dangkykhoahoc)(\/|$)/i.test(path) || path === '/') {
        clearTimeout(kill);
        finish();
        return () => {
          cancelled = true;
          clearTimeout(kill);
          ctrl?.abort();
        };
      }
    } catch { /* ignore */ }

    fetch(`${API}/api/settings/web`, { signal: ctrl?.signal, credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setStyle(res.data.loadingStyle || 1);
          setLogoUrl(res.data.logoUrl || '');
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(kill);
        finish();
      });

    return () => {
      cancelled = true;
      clearTimeout(kill);
      ctrl?.abort();
    };
  }, [onReady]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 flex flex-col items-center justify-center transition-opacity duration-500">
      <style>{`
        @keyframes gradientSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse3d {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes cube3dFull {
          0%   { transform: rotateX(0deg) rotateY(0deg); }
          25%  { transform: rotateX(90deg) rotateY(0deg); }
          50%  { transform: rotateX(90deg) rotateY(90deg); }
          75%  { transform: rotateX(0deg) rotateY(90deg); }
          100% { transform: rotateX(0deg) rotateY(0deg); }
        }
        @keyframes typewrite {
          0%   { width: 0; }
          50%  { width: 200px; }
          90%  { width: 200px; }
          100% { width: 0; }
        }
        @keyframes blinkCursor {
          50% { border-color: transparent; }
        }
        .loading-gradient-ring {
          width: 56px; height: 56px;
          border-radius: 50%;
          border: 4px solid transparent;
          border-top: 4px solid #818cf8;
          border-right: 4px solid #6366f1;
          animation: gradientSpin 1s linear infinite;
          box-shadow: 0 0 20px rgba(99,102,241,0.3);
        }
        .loading-pulse-logo {
          animation: pulse3d 1.5s ease-in-out infinite;
        }
        .loading-typewriter {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 16px;
          color: #c4b5fd;
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid #818cf8;
          width: 0;
          animation: typewrite 3s steps(18) infinite, blinkCursor 0.5s step-end infinite alternate;
        }
        .loading-cube-3d {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #22d3ee, #6366f1);
          border-radius: 12px;
          animation: cube3dFull 2.5s infinite ease-in-out;
          box-shadow: 0 0 30px rgba(99,102,241,0.4);
        }
      `}</style>

      {style === 1 && (
        <div className="flex flex-col items-center gap-6">
          <div className="loading-gradient-ring" />
          <p className="text-indigo-300 text-sm font-medium tracking-wider animate-pulse">Đang khởi tạo...</p>
        </div>
      )}

      {style === 2 && (
        <div className="flex flex-col items-center gap-6">
          <div className="loading-pulse-logo">
            {logoUrl ? (
              <img src={logoUrl.startsWith('http') ? logoUrl : `${API}${logoUrl}`}
                alt="Logo" className="w-20 h-20 object-contain drop-shadow-2xl" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-red-700 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                <span className="text-white text-2xl font-black">T</span>
              </div>
            )}
          </div>
          <p className="text-indigo-300 text-sm font-medium tracking-wider">Thắng Tin Học</p>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {style === 3 && (
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-2xl mb-2">
            <span className="text-white text-lg">📚</span>
          </div>
          <div className="loading-typewriter">Đang tải dữ liệu...</div>
        </div>
      )}

      {style === 4 && (
        <div className="flex flex-col items-center gap-6" style={{ perspective: '600px' }}>
          <div className="loading-cube-3d" style={{ transformStyle: 'preserve-3d' }} />
          <p className="text-cyan-300 text-sm font-medium tracking-wider animate-pulse">Đang kết nối...</p>
        </div>
      )}
    </div>
  );
}
