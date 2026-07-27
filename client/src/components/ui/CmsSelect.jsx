import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  Children,
  Fragment,
  isValidElement,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

function flattenOptionElements(children) {
  const opts = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    // React.Fragment / <>...</> — duyệt tiếp children bên trong
    if (child.type === Fragment) {
      flattenOptionElements(child.props?.children).forEach((o) => opts.push(o));
      return;
    }
    if (child.type === 'optgroup') {
      Children.forEach(child.props.children, (inner) => {
        if (!isValidElement(inner) || inner.type !== 'option') return;
        opts.push({
          value: String(inner.props.value ?? ''),
          label: inner.props.children,
          disabled: Boolean(inner.props.disabled),
        });
      });
      return;
    }
    if (child.type !== 'option') return;
    opts.push({
      value: String(child.props.value ?? ''),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    });
  });
  return opts;
}

const VARIANT_TRIGGER = {
  default: '',
  ghost:
    'bg-transparent border-0 shadow-none p-0 min-h-0 h-auto hover:border-transparent focus-visible:ring-0',
};

/** Custom dropdown (rounded panel) - drop-in for native select. */
export default function CmsSelect({
  value,
  onChange,
  name,
  id,
  disabled = false,
  required = false,
  className = '',
  wrapperClassName = '',
  variant = 'default',
  align = 'left',
  onMouseDown,
  onClick,
  'aria-label': ariaLabel,
  title,
  children,
  options: optionsProp,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  const options = useMemo(() => {
    if (optionsProp?.length) return optionsProp;
    return flattenOptionElements(children);
  }, [children, optionsProp]);

  const strValue = value == null ? '' : String(value);
  const selected = options.find((o) => o.value === strValue);
  const displayLabel =
    selected?.label ??
    (strValue === '' ? options.find((o) => o.value === '')?.label : null) ??
    strValue;

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxH = Math.min(280, Math.max(120, window.innerHeight - rect.bottom - gap - 16));
    const minW = 240;
    const maxW = Math.min(360, window.innerWidth - 16);
    const width = Math.min(Math.max(rect.width, minW), maxW);
    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    if (left < 8) left = 8;
    setCoords({
      top: rect.bottom + gap,
      left,
      width,
      maxHeight: maxH,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    const onScrollOrResize = () => updateCoords();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, align, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (e.target.closest?.('[data-cms-select-panel]')) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (nextValue, optDisabled) => {
    if (optDisabled || disabled) return;
    setOpen(false);
    onChange?.({
      target: { value: nextValue, name: name ?? '' },
      currentTarget: { value: nextValue, name: name ?? '' },
      stopPropagation() {},
      preventDefault() {},
    });
  };

  const baseTrigger =
    variant === 'ghost'
      ? 'inline-flex items-center gap-1 min-w-0 flex-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-55'
      : 'w-full flex items-center justify-between gap-2 text-left min-w-0 bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35 focus-visible:border-blue-400 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer';

  const panel =
    open &&
    coords &&
    createPortal(
      <div
        data-cms-select-panel
        role="listbox"
        id={id ? `${id}-listbox` : undefined}
        aria-label={ariaLabel}
        className="fixed z-[10050] rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)] py-1.5 overflow-y-auto overscroll-contain"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
        }}
      >
        {options.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400 text-center">Không có lựa chọn</p>
        )}
        {options.map((opt) => {
          const isSelected = opt.value === strValue;
          return (
            <button
              key={`${opt.value}-${String(opt.label)}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={opt.disabled}
              onClick={() => pick(opt.value, opt.disabled)}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors ${
                opt.disabled
                  ? 'text-gray-300 cursor-not-allowed opacity-70'
                  : isSelected
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-700 font-medium hover:bg-blue-50'
              }`}
            >
              <span className="min-w-0 break-words whitespace-normal leading-snug">{opt.label}</span>
              {isSelected && !opt.disabled && (
                <Check size={14} className="flex-shrink-0 opacity-90" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>,
      document.body,
    );

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${wrapperClassName}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-required={required || undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={title}
        onClick={(e) => {
          onClick?.(e);
          if (!disabled) setOpen((o) => !o);
        }}
        onMouseDown={onMouseDown}
        className={`${baseTrigger} ${VARIANT_TRIGGER[variant] || ''} ${className}`.trim()}
      >
        <span className="truncate min-w-0 flex-1">{displayLabel}</span>
        {variant !== 'ghost' && (
          <ChevronDown
            size={16}
            className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>
      {name && required && strValue === '' && (
        <input tabIndex={-1} aria-hidden="true" className="sr-only" required value="" readOnly />
      )}
      {panel}
    </div>
  );
}

