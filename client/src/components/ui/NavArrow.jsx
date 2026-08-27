import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Mũi tên điều hướng đồng bộ toàn site (thay ký tự → / ←). */
export default function NavArrow({ size = 14, className = '', direction = 'forward' }) {
  const Icon = direction === 'back' ? ChevronLeft : ChevronRight;
  return (
    <Icon
      size={size}
      strokeWidth={2.5}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}
