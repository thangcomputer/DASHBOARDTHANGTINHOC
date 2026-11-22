import React from 'react';
import './AiSearchPillButton.css';

const ICON = '/brand/ai-search/search-ai-icon.svg';
const SPARKLES = '/brand/ai-search/ai-sparkles.svg';
const WAVE = '/brand/ai-search/mint-wave.svg';

const PLACEHOLDER = 'Hỏi Word, Excel, LMS…';

/**
 * Nút mở tìm kiếm AI — kích thước 280×44px desktop, bám mock pixel-perfect.
 */
export default function AiSearchPillButton({
  onClick,
  title = 'Hỏi DewSkill AI: Office, CNTT, LMS (Ctrl+K)',
  ariaLabel = 'Tìm kiếm bằng AI',
  showSearchLabel = true,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ai-search-pill-btn ${className}`.trim()}
      title={title}
      aria-label={ariaLabel}
    >
      <img src={WAVE} alt="" aria-hidden className="ai-search-pill-btn__wave" />
      <img src={ICON} alt="" aria-hidden className="ai-search-pill-btn__icon ai-search-pill-btn__fg" />
      {showSearchLabel ? (
        <>
          <span className="ai-search-pill-btn__divider ai-search-pill-btn__fg" aria-hidden />
          <span className="ai-search-pill-btn__placeholder ai-search-pill-btn__fg">{PLACEHOLDER}</span>
        </>
      ) : null}
      <span className="ai-search-pill-btn__badge-wrap ai-search-pill-btn__fg">
        <span className="ai-search-pill-btn__badge">AI</span>
        <img src={SPARKLES} alt="" aria-hidden className="ai-search-pill-btn__sparkles" />
      </span>
    </button>
  );
}