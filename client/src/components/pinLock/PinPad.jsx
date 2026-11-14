import React, { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { PIN_LENGTH } from '../../utils/pinLock';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Nhập đủ PIN_LENGTH số là tự gọi onComplete. */
export default function PinPad({ onComplete, error = '', disabled = false, resetKey = 0, dark = false }) {
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => { setValue(''); }, [resetKey]);

  useEffect(() => {
    if (!error) return undefined;
    setShake(true);
    setValue('');
    const timer = window.setTimeout(() => setShake(false), 420);
    return () => window.clearTimeout(timer);
  }, [error, resetKey]);

  const press = (key) => {
    if (disabled) return;
    if (key === 'del') {
      setValue((current) => current.slice(0, -1));
      return;
    }
    setValue((current) => {
      if (current.length >= PIN_LENGTH) return current;
      const next = `${current}${key}`;
      if (next.length === PIN_LENGTH) window.setTimeout(() => completeRef.current?.(next), 80);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        press('del');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className={`flex items-center gap-3 ${shake ? 'cms-pin-shake' : ''}`} aria-label={`Đã nhập ${value.length} trên ${PIN_LENGTH} số`}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${index < value.length
              ? 'scale-110 border-emerald-600 bg-emerald-600'
              : dark ? 'border-white/60 bg-transparent' : 'border-slate-300 bg-white'}`}
          />
        ))}
      </div>
      <p className={`min-h-5 text-center text-sm font-semibold ${error ? 'text-red-500' : 'text-transparent'}`} role="alert">
        {error || '.'}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, index) => (key ? (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            aria-label={key === 'del' ? 'Xóa số vừa nhập' : `Số ${key}`}
            style={key === 'del' ? { boxShadow: 'none' } : undefined}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold transition active:scale-95 disabled:opacity-50 ${dark
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200'} ${key === 'del' ? '!bg-transparent' : ''}`}
          >
            {key === 'del' ? <Delete size={24} aria-hidden="true" /> : key}
          </button>
        ) : <span key={`blank-${index}`} aria-hidden="true" />))}
      </div>
    </div>
  );
}
