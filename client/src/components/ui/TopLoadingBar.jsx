import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * TopLoadingBar.jsx - Thanh tiến trình loading xịn xò ở cạnh trên màn hình
 * Kích hoạt tự động khi có API request đang tải dữ liệu hoặc khi chuyển trang.
 */
export default function TopLoadingBar() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const location = useLocation();
  const timerRef = useRef(null);
  const resetTimerRef = useRef(null);

  // Kích hoạt nhẹ khi chuyển trang (route change)
  useEffect(() => {
    startProgress(true);
    const t = setTimeout(() => {
      completeProgress();
    }, 280);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const startProgress = (fast = false) => {
    clearTimeout(resetTimerRef.current);
    clearInterval(timerRef.current);
    setVisible(true);
    setProgress((prev) => (prev > 0 && prev < 80 ? prev : 18));

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const inc = prev < 50 ? (fast ? 14 : 9) : (fast ? 6 : 2.5);
        return Math.min(90, prev + inc);
      });
    }, 120);
  };

  const completeProgress = () => {
    clearInterval(timerRef.current);
    setProgress(100);
    resetTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
  };

  // Lắng nghe sự kiện từ api.js (cms:api-loading)
  useEffect(() => {
    const handleLoading = (e) => {
      const active = Boolean(e?.detail?.active);
      if (active) {
        startProgress(false);
      } else {
        completeProgress();
      }
    };

    window.addEventListener('cms:api-loading', handleLoading);
    return () => {
      window.removeEventListener('cms:api-loading', handleLoading);
      clearInterval(timerRef.current);
      clearTimeout(resetTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] pointer-events-none z-[999999] overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.25s ease-out',
      }}
    >
      {/* Background track mờ nhẹ */}
      <div className="absolute inset-0 bg-emerald-500/10" />

      {/* Dải sáng gradient chính */}
      <div
        className="h-full rounded-r-full"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? 'width 0.18s ease-out'
            : 'width 0.22s cubic-bezier(0.2, 0.8, 0.4, 1)',
          background: 'linear-gradient(90deg, #10b981 0%, #059669 40%, #10b981 75%, #34d399 100%)',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.75), 0 0 4px rgba(52, 211, 153, 0.9)',
        }}
      />

      {/* Điểm sáng laser dẫn đầu */}
      {visible && progress < 100 && (
        <div
          className="absolute top-0 bottom-0 w-24 pointer-events-none"
          style={{
            left: `calc(${progress}% - 96px)`,
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent)',
            transition: 'left 0.22s cubic-bezier(0.2, 0.8, 0.4, 1)',
          }}
        />
      )}
    </div>
  );
}

