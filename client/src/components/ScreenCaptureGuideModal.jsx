import { createPortal } from 'react-dom';
import { Camera, X } from 'lucide-react';

/**
 * Hướng dẫn trước khi mở hộp thoại chia sẻ màn hình của trình duyệt.
 * Hình ví dụ đã có mũi tên — chỉ giữ chú thích 3 bước.
 */
export default function ScreenCaptureGuideModal({
  open,
  mode = 'full',
  skipNext,
  onSkipNextChange,
  onCancel,
  onContinue,
}) {
  if (!open || typeof document === 'undefined') return null;

  const isRegion = mode === 'region';

  const node = (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-capture-guide-title"
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" aria-hidden="true" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-[0_25px_80px_-12px_rgba(0,0,0,0.5)]">
        <div className="relative bg-gradient-to-r from-red-700 via-red-600 to-red-500 px-5 pt-6 pb-5 text-white">
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Camera size={22} />
            </span>
            <div>
              <p id="screen-capture-guide-title" className="text-base font-black">
                Hướng dẫn chụp màn hình
              </p>
              <p className="text-xs text-red-100/90 mt-0.5">
                {isRegion ? 'Làm theo số đỏ trên hình — rồi kéo chọn vùng' : 'Làm theo số đỏ trên hình, rất nhanh'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
            Cửa sổ kế tiếp do <strong>trình duyệt</strong> hiện (không đổi được). Bấm đúng vị trí số đỏ là chụp xong.
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner">
            <img
              src="/guides/chrome-share-picker.png?v=4"
              alt="Ví dụ cửa sổ chọn màn hình của trình duyệt"
              className="block w-full h-auto select-none"
              draggable={false}
            />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
              Window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
              Bấm màn / cửa sổ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
              {isRegion ? 'Share, rồi kéo vùng' : 'Bấm Share'}
            </span>
          </div>

          <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!skipNext}
              onChange={(e) => onSkipNextChange?.(e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-xs font-semibold text-slate-600">Không hiện hướng dẫn lần sau</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700 transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="flex-[1.4] min-h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-600/25 transition"
            >
              Tiếp tục chụp
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
