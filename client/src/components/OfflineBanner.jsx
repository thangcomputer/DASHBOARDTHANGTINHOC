import { useEffect, useState } from 'react';

/**
 * Banner mỏng khi mất mạng / server unreachable.
 * Lắng nghe navigator.onLine + sự kiện cms:connectivity từ apiFetch/socket.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );

  useEffect(() => {
    const sync = (online) => setOffline(!online);

    const onBrowser = () => sync(navigator.onLine);
    const onCustom = (e) => {
      if (typeof e?.detail?.online === 'boolean') sync(e.detail.online);
    };

    window.addEventListener('online', onBrowser);
    window.addEventListener('offline', onBrowser);
    window.addEventListener('cms:connectivity', onCustom);
    return () => {
      window.removeEventListener('online', onBrowser);
      window.removeEventListener('offline', onBrowser);
      window.removeEventListener('cms:connectivity', onCustom);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        padding: '0.55rem 1rem',
        paddingTop: 'max(0.55rem, env(safe-area-inset-top))',
        background: 'linear-gradient(90deg, #92400e, #b45309)',
        color: '#fffbeb',
        textAlign: 'center',
        fontSize: '0.875rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}
    >
      Mất kết nối máy chủ — đang giữ phiên đăng nhập và tự thử lại…
    </div>
  );
}
