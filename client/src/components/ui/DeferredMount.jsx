import { Suspense, useEffect, useState } from 'react';

/**
 * DeferredMount – chỉ tải & gắn component lazy khi `when` lần đầu = true.
 * Sau khi đã mở 1 lần sẽ giữ lại để hiệu ứng đóng/mở các lần sau vẫn mượt.
 * Dùng cho popup/overlay hiếm khi xuất hiện -> không làm nặng bundle khởi động.
 */
export default function DeferredMount({ when, children, fallback = null }) {
  const [mounted, setMounted] = useState(Boolean(when));

  useEffect(() => {
    if (when) setMounted(true);
  }, [when]);

  if (!mounted) return null;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

/**
 * IdleMount – gắn component lazy sau khi trình duyệt rảnh (sau lần vẽ đầu),
 * dành cho các "host" luôn chạy nền (chat nổi, nhắc lịch Meet...).
 */
export function IdleMount({ children, timeout = 1500 }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = () => { if (!cancelled) setReady(true); };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout });
      return () => { cancelled = true; window.cancelIdleCallback?.(id); };
    }
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [timeout]);

  if (!ready) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}

