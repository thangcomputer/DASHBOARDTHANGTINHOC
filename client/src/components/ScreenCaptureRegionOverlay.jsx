import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Overlay chọn vùng trên ảnh đã capture (kéo chuột / dấu +).
 * onConfirm(regionPx) — tọa độ theo pixel canvas gốc.
 */
export default function ScreenCaptureRegionOverlay({
  open,
  imageUrl,
  naturalWidth,
  naturalHeight,
  onConfirm,
  onCancel,
}) {
  const [drag, setDrag] = useState(null); // { x0, y0, x1, y1 } in display coords relative to img box
  const imgWrapRef = useRef(null);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, imageUrl, measure]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const toLocal = (clientX, clientY) => {
    const el = imgWrapRef.current;
    const r = el ? el.getBoundingClientRect() : null;
    const left = r?.left ?? box.left;
    const top = r?.top ?? box.top;
    const width = r?.width || box.width || 1;
    const height = r?.height || box.height || 1;
    if (r) setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    const x = Math.min(Math.max(0, clientX - left), width);
    const y = Math.min(Math.max(0, clientY - top), height);
    return { x, y, width, height };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const p = toLocal(e.clientX, e.clientY);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    const p = toLocal(e.clientX, e.clientY);
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };

  const finishDrag = () => {
    if (!drag || !naturalWidth || !naturalHeight) {
      setDrag(null);
      return;
    }
    const el = imgWrapRef.current;
    const r = el?.getBoundingClientRect();
    const dispW = r?.width || box.width;
    const dispH = r?.height || box.height;
    if (!dispW || !dispH) {
      setDrag(null);
      return;
    }
    const left = Math.min(drag.x0, drag.x1);
    const top = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < 4 || h < 4) return;
    const scaleX = naturalWidth / dispW;
    const scaleY = naturalHeight / dispH;
    onConfirm?.({
      x: left * scaleX,
      y: top * scaleY,
      w: w * scaleX,
      h: h * scaleY,
    });
  };

  if (!open || !imageUrl) return null;

  const sel = drag
    ? {
      left: Math.min(drag.x0, drag.x1),
      top: Math.min(drag.y0, drag.y1),
      width: Math.abs(drag.x1 - drag.x0),
      height: Math.abs(drag.y1 - drag.y0),
    }
    : null;

  const node = (
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-slate-950/90"
      role="dialog"
      aria-modal="true"
      aria-label="Chọn vùng chụp màn hình"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-white/10 text-white shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-bold">Chụp một phần</p>
          <p className="text-xs text-slate-300">Kéo chuột để chọn vùng · Esc để hủy</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Hủy"
        >
          <X size={18} />
        </button>
      </div>

      <div
        className="flex-1 min-h-0 flex items-center justify-center p-4 cursor-crosshair select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => setDrag(null)}
      >
        <div
          ref={imgWrapRef}
          className="relative max-w-full max-h-full shadow-2xl ring-1 ring-white/20"
          style={{ cursor: 'crosshair' }}
        >
          <img
            src={imageUrl}
            alt="Khung chụp"
            draggable={false}
            onLoad={measure}
            className="block max-w-[min(96vw,1400px)] max-h-[calc(100vh-7rem)] w-auto h-auto object-contain pointer-events-none"
          />
          {/* dim */}
          <div className="absolute inset-0 bg-black/35 pointer-events-none" aria-hidden />
          {sel && sel.width > 0 && sel.height > 0 ? (
            <div
              className="absolute border-2 border-sky-400 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none"
              style={{
                left: sel.left,
                top: sel.top,
                width: sel.width,
                height: sel.height,
              }}
            >
              <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-sky-300" />
              <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-sky-300" />
              <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-sky-300" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-sky-300" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-white/90 text-sm font-semibold bg-black/40 px-3 py-1.5 rounded-lg">
                + Kéo để chọn vùng
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
