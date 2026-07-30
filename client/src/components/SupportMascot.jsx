/**
 * Nhân vật hỗ trợ hoạt hình (Bảng tin — Hỗ trợ nhanh).
 */
import React, { useId } from 'react';

export default function SupportMascot({ size = 56, className = '', waving = true }) {
  const s = Number(size) || 56;
  const uid = useId().replace(/:/g, '');
  const glowId = `cmsSupportGlow_${uid}`;

  return (
    <span
      className={`cms-support-mascot ${waving ? 'is-waving' : ''} ${className}`.trim()}
      style={{ width: s, height: s, minWidth: s, minHeight: s }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={s} height={s} fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill="#DC2626" />
        <circle cx="32" cy="32" r="30" fill={`url(#${glowId})`} fillOpacity="0.35" />
        <circle cx="32" cy="26" r="11" fill="#FFE4C8" />
        <path d="M22 24c1-8 7-12 10-12s9 4 10 12c-3-2-7-3-10-3s-7 1-10 3z" fill="#1E293B" />
        <circle cx="28" cy="26" r="1.6" fill="#0F172A" className="cms-support-mascot__eye" />
        <circle cx="36" cy="26" r="1.6" fill="#0F172A" className="cms-support-mascot__eye" />
        <circle cx="25.5" cy="29.5" r="1.8" fill="#FB7185" fillOpacity="0.55" />
        <circle cx="38.5" cy="29.5" r="1.8" fill="#FB7185" fillOpacity="0.55" />
        <path d="M28 31.5c1.2 1.6 3.2 2.2 4 2.2s2.8-.6 4-2.2" stroke="#BE123C" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M18 26c0-8 6.5-14 14-14s14 6 14 14" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
        <rect x="15" y="24" width="6" height="9" rx="3" fill="#F8FAFC" />
        <rect x="43" y="24" width="6" height="9" rx="3" fill="#F8FAFC" />
        <path d="M18 30h-3c-1.5 0-2.5 1-2.5 2.5V36c0 2 1.5 3.5 3.5 3.5H21" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 44c2.5-5 7-8 10-8s7.5 3 10 8v6H22v-6z" fill="#FEF2F2" />
        <g className="cms-support-mascot__arm">
          <path d="M44 42c4-1 8 1 9 4" stroke="#FFE4C8" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="54" cy="47" r="3.2" fill="#FFE4C8" />
        </g>
        <defs>
          <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(22 18) rotate(55) scale(40)">
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#DC2626" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}
