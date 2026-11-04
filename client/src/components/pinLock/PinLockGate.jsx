import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole, LogOut } from 'lucide-react';
import PinPad from './PinPad';
import {
  PIN_CHANGED_EVENT,
  PIN_LOCK_NOW_EVENT,
  PIN_MAX_ATTEMPTS,
  clearLastActive,
  configStorageKey,
  isIdleExpired,
  isLockedFlag,
  lockedStorageKey,
  markActive,
  readLastActive,
  readPinConfig,
  removePin,
  setLockedFlag,
  verifyPin,
} from '../../utils/pinLock';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
const ACTIVITY_WRITE_MS = 5000;
const CHECK_MS = 5000;

export default function PinLockGate({ userKey, userName = '', onLogout }) {
  const [config, setConfig] = useState(() => readPinConfig(userKey));
  const [locked, setLocked] = useState(() => {
    const current = readPinConfig(userKey);
    if (!current) return false;
    if (isLockedFlag(userKey)) return true;
    return isIdleExpired(readLastActive(userKey), current.timeoutMinutes);
  });
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const lastWriteRef = useRef(0);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const lock = useCallback(() => {
    if (!readPinConfig(userKey)) return;
    setLockedFlag(userKey, true);
    setLocked(true);
    setError('');
    setAttempts(0);
    setResetKey((key) => key + 1);
  }, [userKey]);

  useEffect(() => {
    const current = readPinConfig(userKey);
    setConfig(current);
    if (!readLastActive(userKey)) markActive(userKey);
    if (current && locked) setLockedFlag(userKey, true);
  }, [userKey, locked]);

  useEffect(() => {
    const refresh = () => {
      const current = readPinConfig(userKey);
      setConfig(current);
      if (!current) setLocked(false);
    };
    const lockNow = () => lock();
    const onStorage = (event) => {
      if (event.key === lockedStorageKey(userKey)) {
        if (event.newValue === '1') lock();
        else setLocked(false);
      }
      if (event.key === configStorageKey(userKey)) refresh();
    };
    window.addEventListener(PIN_CHANGED_EVENT, refresh);
    window.addEventListener(PIN_LOCK_NOW_EVENT, lockNow);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PIN_CHANGED_EVENT, refresh);
      window.removeEventListener(PIN_LOCK_NOW_EVENT, lockNow);
      window.removeEventListener('storage', onStorage);
    };
  }, [lock, userKey]);

  useEffect(() => {
    if (!config) return undefined;
    const onActivity = () => {
      if (lockedRef.current) return;
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_WRITE_MS) return;
      lastWriteRef.current = now;
      markActive(userKey, now);
    };
    const check = () => {
      if (lockedRef.current) return;
      if (isIdleExpired(readLastActive(userKey), config.timeoutMinutes)) lock();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(check, CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [config, lock, userKey]);

  const signOut = useCallback(() => {
    removePin(userKey);
    clearLastActive(userKey);
    setLocked(false);
    onLogout?.();
  }, [onLogout, userKey]);

  const handleComplete = (pin) => {
    if (verifyPin(userKey, pin)) {
      setLockedFlag(userKey, false);
      markActive(userKey);
      setLocked(false);
      setError('');
      setAttempts(0);
      return;
    }
    const used = attempts + 1;
    setAttempts(used);
    setResetKey((key) => key + 1);
    if (used >= PIN_MAX_ATTEMPTS) {
      signOut();
      return;
    }
    setError(`Mã PIN không đúng. Còn ${PIN_MAX_ATTEMPTS - used} lần thử.`);
  };

  if (!config || !locked) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Màn hình khóa mã PIN"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[28px] border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 px-6 py-8 text-white shadow-2xl">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 shadow-[0_8px_24px_rgba(220,38,38,0.45)]">
          <LockKeyhole size={28} aria-hidden="true" />
        </span>
        <div className="text-center">
          <p className="text-lg font-extrabold">Ứng dụng đã khóa</p>
          <p className="mt-1 text-sm text-slate-300">
            {userName ? `${userName}, nhập mã PIN để mở khóa` : 'Nhập mã PIN để mở khóa'}
          </p>
        </div>
        <PinPad onComplete={handleComplete} error={error} resetKey={resetKey} dark />
        <div className="mt-1 flex w-full flex-col items-center gap-2.5 border-t border-white/10 pt-4">
          <p className="text-xs font-medium text-slate-400">Quên mã PIN?</p>
          <button
            type="button"
            onClick={signOut}
            style={{ boxShadow: 'none' }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <LogOut size={15} aria-hidden="true" /> Đăng xuất để đăng nhập lại
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
