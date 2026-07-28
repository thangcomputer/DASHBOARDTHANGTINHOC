import { useEffect, useState } from 'react';

/**
 * Phòng thi chỉ cho phép làm bài trên laptop/desktop.
 * Điện thoại & máy tính bảng: xem điểm được, không vào thi.
 */
export function isDesktopExamDevice() {
  if (typeof window === 'undefined') return true;

  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (mobileUa) return false;

  // iPadOS 13+ often reports as MacIntel but has multi-touch
  const iPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  if (iPad) return false;

  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;
  const wideEnough = window.matchMedia('(min-width: 1024px)').matches;

  if (!finePointer || !canHover) return false;
  if (!wideEnough) return false;

  return true;
}

export function useIsDesktopExamDevice() {
  const [ok, setOk] = useState(() => isDesktopExamDevice());

  useEffect(() => {
    const update = () => setOk(isDesktopExamDevice());
    update();
    const mqWide = window.matchMedia('(min-width: 1024px)');
    const mqPointer = window.matchMedia('(pointer: fine)');
    const mqHover = window.matchMedia('(hover: hover)');
    const add = (mq) => mq.addEventListener?.('change', update) || mq.addListener?.(update);
    const remove = (mq) => mq.removeEventListener?.('change', update) || mq.removeListener?.(update);
    add(mqWide);
    add(mqPointer);
    add(mqHover);
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    return () => {
      remove(mqWide);
      remove(mqPointer);
      remove(mqHover);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return ok;
}
