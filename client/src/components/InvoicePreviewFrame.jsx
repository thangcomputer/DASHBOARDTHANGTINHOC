import React, { useEffect, useRef, useState } from 'react';
import InvoiceTemplate from './InvoiceTemplate';

/** A5 ngang (mm → px @96dpi) — khớp InvoiceTemplate */
const A5_W = Math.round(210 * 3.7795275591);
const A5_H = Math.round(148 * 3.7795275591);

/**
 * Preview hóa đơn scale theo chiều rộng container (desktop lớn rõ, mobile vừa khung).
 * Bản in/PDF vẫn lấy #invoice-template gốc (không bị scale).
 */
export default function InvoicePreviewFrame({ data, className = '' }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.85);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / A5_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className={`w-full max-w-[900px] mx-auto ${className}`}>
      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
        style={{ width: '100%', height: Math.max(1, Math.round(A5_H * scale)) }}
      >
        <div
          className="origin-top-left"
          style={{
            width: A5_W,
            height: A5_H,
            transform: `scale(${scale})`,
          }}
        >
          <InvoiceTemplate data={data} />
        </div>
      </div>
    </div>
  );
}
