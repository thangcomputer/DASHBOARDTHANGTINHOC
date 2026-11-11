/** Class nút 3D Duo (đồng bộ mobile) cho trang LMS. */
export function lmsBtn(variant = 'danger', options = {}) {
  const { size = 'md', fullWidth = false, className = '' } = options;
  return [
    'duo-btn',
    `duo-btn--${variant}`,
    `duo-btn--${size}`,
    fullWidth && 'duo-btn--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Nút hành động học viên qua cms-btn 3D (emerald / đỏ brand / xanh Meet). */
export function studentCmsBtn(kind = 'primary', extra = '') {
  const map = {
    primary: 'cms-btn cms-btn-primary',
    brand: 'cms-btn cms-btn-primary cms-btn-brand',
    blue: 'cms-btn cms-btn-primary cms-btn-blue',
    outline: 'cms-btn cms-btn-outline',
    success: 'cms-btn cms-btn-success',
  };
  return [map[kind] || map.primary, extra].filter(Boolean).join(' ');
}
