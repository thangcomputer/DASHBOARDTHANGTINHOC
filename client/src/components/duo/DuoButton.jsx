import React from 'react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Nút 3D đồng bộ mobile — bevel + nhấn translateY. */
export function DuoButton({
  children,
  text,
  label,
  icon,
  rightIcon,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
  className,
  onClick,
  ...rest
}) {
  const contentText = label || text;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={cx(
        'duo-btn',
        `duo-btn--${variant}`,
        `duo-btn--${size}`,
        fullWidth && 'duo-btn--full',
        loading && 'duo-btn--loading',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="duo-btn__spinner" aria-hidden="true" />
      ) : (
        <>
          {icon ? <span className="duo-btn__icon duo-btn__icon--left">{icon}</span> : null}
          {contentText ? <span className="duo-btn__label">{contentText}</span> : null}
          {children}
          {rightIcon ? <span className="duo-btn__icon duo-btn__icon--right">{rightIcon}</span> : null}
        </>
      )}
    </button>
  );
}
