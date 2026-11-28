import { createPortal } from 'react-dom';
import AIPackagesView from '../../ai/AIPackagesView';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

/**
 * Wrapper tương thích chuyển mọi điểm mở modal XP cũ sang màn Gói hỗ trợ AI Không Giới Hạn.
 */
export default function BuyXpModal({ onClose, onPaid }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9800] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/55 p-2.5 sm:p-4 md:p-6 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="my-auto w-full max-w-[94vw] sm:max-w-xl md:max-w-3xl lg:max-w-[880px] xl:max-w-[920px]" onClick={(e) => e.stopPropagation()}>
        <AIPackagesView
          inModal
          onClose={onClose}
          onActivated={(data) => {
            onPaid?.(data);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
