import React from 'react';

/** Icon Zalo chuẩn (nền xanh + chữ Z) — nút mở zalo.me */
const ZaloIcon = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="48" height="48" rx="12" fill="#0068FF" />
    <path
      fill="#fff"
      d="M14.5 32.5h19.2v-3.6H23.1l9.8-10.9V14.5H14.8v3.6h10.2L15.2 29.1v3.4z"
    />
  </svg>
);

export default ZaloIcon;
