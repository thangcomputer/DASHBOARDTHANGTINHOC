import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, Crop, Loader2, Monitor } from 'lucide-react';
import {
  captureDisplayFrame,
  captureFullScreenFile,
  cropCanvasToPngFile,
  isScreenCaptureSupported,
} from '../utils/screenCapture';
import ScreenCaptureRegionOverlay from './ScreenCaptureRegionOverlay';
import ScreenCaptureGuideModal from './ScreenCaptureGuideModal';

const GUIDE_SKIP_KEY = 'cms_screen_capture_guide_skip';

function readGuideSkip() {
  try {
    return localStorage.getItem(GUIDE_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Nút chụp màn hình:
 * - Bấm Camera = chụp toàn màn (picker → chọn màn nào chụp luôn màn đó).
 * - Mũi tên = thêm «Chụp một phần».
 * onCaptured(File) — gắn pending, không gửi ngay.
 */
export default function ScreenCaptureButton({
  onCaptured,
  onError,
  disabled = false,
  className = '',
  buttonClassName = '',
  title = 'Chụp màn hình (chọn màn › chụp ngay)',
  size = 16,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regionJob, setRegionJob] = useState(null);
  const [guideMode, setGuideMode] = useState(null);
  const [skipGuideNext, setSkipGuideNext] = useState(false);
  const rootRef = useRef(null);
  const supported = isScreenCaptureSupported();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const clearRegionJob = useCallback(() => {
    setRegionJob((job) => {
      if (job?.url) URL.revokeObjectURL(job.url);
      return null;
    });
  }, []);

  useEffect(() => () => {
    setRegionJob((job) => {
      if (job?.url) URL.revokeObjectURL(job.url);
      return null;
    });
  }, []);

  const reportError = (e) => {
    if (e?.code === 'SCREEN_CAPTURE_DENIED') return;
    const msg = e?.message || 'Không chụp được màn hình';
    if (typeof onError === 'function') onError(msg);
  };

  const requestCapture = (mode) => {
    if (busy || disabled) return;
    setMenuOpen(false);
    if (readGuideSkip()) {
      if (mode === 'region') runRegion();
      else runFull();
      return;
    }
    setSkipGuideNext(false);
    setGuideMode(mode);
  };

  const confirmGuideAndCapture = () => {
    const mode = guideMode || 'full';
    setGuideMode(null);
    if (skipGuideNext) {
      try { localStorage.setItem(GUIDE_SKIP_KEY, '1'); } catch { /* ignore */ }
    }
    if (mode === 'region') runRegion();
    else runFull();
  };

  const runFull = async () => {
    if (busy || disabled) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      const file = await captureFullScreenFile();
      await onCaptured?.(file);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const runRegion = async () => {
    if (busy || disabled) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      const { canvas, width, height } = await captureDisplayFrame({ preferMonitor: true });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh xem trước'))),
          'image/png',
        );
      });
      const url = URL.createObjectURL(blob);
      setRegionJob({ canvas, url, width, height });
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const onRegionConfirm = async (region) => {
    if (!regionJob?.canvas) return;
    setBusy(true);
    try {
      const file = await cropCanvasToPngFile(regionJob.canvas, region);
      clearRegionJob();
      await onCaptured?.(file);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => { requestCapture('full'); }}
        className={buttonClassName}
        title={title}
        aria-label={title}
      >
        {busy ? <Loader2 size={size} className="animate-spin" /> : <Camera size={size} />}
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setMenuOpen((o) => !o)}
        className={`${buttonClassName} !px-0.5 -ml-0.5`}
        title="Thêm tùy chọn chụp"
        aria-label="Thêm tùy chọn chụp"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <ChevronDown size={Math.max(12, size - 4)} />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[12rem] rounded-xl border border-slate-200 bg-white shadow-lg py-1 overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => { requestCapture('full'); }}
          >
            <Monitor size={14} className="text-slate-500 shrink-0" />
            Chụp toàn màn hình
            <span className="ml-auto text-[10px] font-medium text-slate-400">chọn màn › chụp</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => { requestCapture('region'); }}
          >
            <Crop size={14} className="text-slate-500 shrink-0" />
            Chụp một phần
          </button>
        </div>
      ) : null}

      <ScreenCaptureGuideModal
        open={!!guideMode}
        mode={guideMode || 'full'}
        skipNext={skipGuideNext}
        onSkipNextChange={setSkipGuideNext}
        onCancel={() => setGuideMode(null)}
        onContinue={confirmGuideAndCapture}
      />

      <ScreenCaptureRegionOverlay
        open={!!regionJob}
        imageUrl={regionJob?.url}
        naturalWidth={regionJob?.width}
        naturalHeight={regionJob?.height}
        onCancel={clearRegionJob}
        onConfirm={onRegionConfirm}
      />
    </div>
  );
}
