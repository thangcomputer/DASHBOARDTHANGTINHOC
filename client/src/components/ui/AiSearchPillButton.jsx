import React from 'react';

const ICON = '/brand/ai-search/search-ai-icon.svg';
const SPARKLES = '/brand/ai-search/ai-sparkles.svg';
const WAVE = '/brand/ai-search/mint-wave.svg';

/**
 * Nút "Tìm kiếm AI" — bám mock: viền gradient, icon SVG trái, chữ, nhãn AI, sóng & sao trang trí.
 */
export default function AiSearchPillButton({
  onClick,
  title = 'Tìm kiếm AI (Ctrl+K)',
  ariaLabel = 'Tìm kiếm bằng AI',
  showSearchLabel = true,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group inline-flex h-10 sm:h-11 shrink-0 cursor-pointer items-center rounded-full',
        'bg-gradient-to-r from-[#6EE7B7] via-[#34D399] to-[#4ADE80] p-[1.5px]',
        'shadow-[0_4px_12px_rgba(16,185,129,0.16)] transition duration-200',
        'hover:brightness-[1.03] hover:shadow-[0_6px_16px_rgba(16,185,129,0.26)]',
        'active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2',
        'motion-reduce:transition-none',
        className,
      ].join(' ')}
      title={title}
      aria-label={ariaLabel}
    >
      <span className="relative inline-flex h-full min-w-0 items-center gap-2 overflow-hidden rounded-full bg-[#F4FBF9] pl-1 pr-2.5 dark:bg-slate-900 sm:gap-2.5 sm:pr-3">
        <img
          src={WAVE}
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 z-0 h-[72%] w-[min(52%,7.5rem)] object-cover object-right-bottom select-none"
        />
        <img
          src={ICON}
          alt=""
          aria-hidden
          className="relative z-[1] h-[30px] w-[30px] shrink-0 select-none drop-shadow-sm sm:h-8 sm:w-8"
        />
        {showSearchLabel ? (
          <>
            <span
              className="relative z-[1] hidden h-[22px] w-px shrink-0 bg-[#C5DED8] dark:bg-emerald-900/60 sm:block"
              aria-hidden
            />
            <span className="relative z-[1] hidden whitespace-nowrap text-[13px] font-bold leading-none text-[#233238] dark:text-slate-100 sm:inline">
              Tìm kiếm
            </span>
          </>
        ) : null}
        <span className="relative z-[1] inline-flex shrink-0 items-center pr-0.5">
          <span className="rounded-md bg-gradient-to-br from-[#34D399] via-[#10B981] to-[#059669] px-2 py-[5px] text-[11px] font-extrabold leading-none tracking-wide text-white shadow-[0_1px_3px_rgba(5,150,105,0.35)] sm:text-xs sm:px-2.5 sm:py-1.5">
            AI
          </span>
          <img
            src={SPARKLES}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-2.5 -top-2.5 z-[2] h-[18px] w-[22px] select-none"
          />
        </span>
      </span>
    </button>
  );
}