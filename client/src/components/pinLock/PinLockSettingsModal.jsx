import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, KeyRound, Lock, X } from 'lucide-react';
import PinPad from './PinPad';
import {
  PIN_DEFAULT_TIMEOUT,
  PIN_LOCK_NOW_EVENT,
  PIN_SETTINGS_EVENT,
  PIN_TIMEOUT_OPTIONS,
  readPinConfig,
  removePin,
  savePin,
  setPinTimeout,
  verifyPin,
} from '../../utils/pinLock';

const STEP_TITLES = {
  create: 'Nhập mã PIN mới gồm 6 số',
  confirm: 'Nhập lại mã PIN để xác nhận',
  'verify-change': 'Nhập mã PIN hiện tại',
  'verify-remove': 'Nhập mã PIN hiện tại để tắt khóa',
};

export default function PinLockSettingsModal({ userKey }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState('overview');
  const [draftPin, setDraftPin] = useState('');
  const [timeout, setTimeoutMinutes] = useState(PIN_DEFAULT_TIMEOUT);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onOpen = () => {
      const current = readPinConfig(userKey);
      setConfig(current);
      setTimeoutMinutes(current?.timeoutMinutes || PIN_DEFAULT_TIMEOUT);
      setStep('overview');
      setDraftPin('');
      setError('');
      setNotice('');
      setOpen(true);
    };
    window.addEventListener(PIN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(PIN_SETTINGS_EVENT, onOpen);
  }, [userKey]);

  if (!open) return null;

  const goStep = (next) => {
    setStep(next);
    setError('');
    setResetKey((key) => key + 1);
  };

  const fail = (message) => {
    setError(message);
    setResetKey((key) => key + 1);
  };

  const handlePin = (pin) => {
    if (step === 'create') {
      setDraftPin(pin);
      goStep('confirm');
      return;
    }
    if (step === 'confirm') {
      if (pin !== draftPin) {
        setDraftPin('');
        setStep('create');
        fail('Hai lần nhập không khớp. Vui lòng nhập lại mã PIN mới.');
        return;
      }
      savePin(userKey, pin, timeout);
      setConfig(readPinConfig(userKey));
      setNotice(config ? 'Đã đổi mã PIN.' : 'Đã bật khóa mã PIN.');
      goStep('overview');
      return;
    }
    if (!verifyPin(userKey, pin)) {
      fail('Mã PIN không đúng.');
      return;
    }
    if (step === 'verify-change') {
      goStep('create');
      return;
    }
    if (step === 'verify-remove') {
      removePin(userKey);
      setConfig(null);
      setNotice('Đã tắt khóa mã PIN.');
      goStep('overview');
    }
  };

  const changeTimeout = (minutes) => {
    setTimeoutMinutes(minutes);
    if (config) {
      setPinTimeout(userKey, minutes);
      setConfig(readPinConfig(userKey));
      setNotice('Đã lưu thời gian tự khóa.');
    }
  };

  const close = () => setOpen(false);

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Khóa mã PIN">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <KeyRound size={20} className="text-red-600" aria-hidden="true" /> Khóa mã PIN
          </h2>
          <button type="button" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {step === 'overview' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Ứng dụng tự khóa khi bạn không thao tác trong thời gian đã chọn. Nhập đúng mã PIN 6 số là mở lại ngay.
              Mã PIN chỉ lưu trên thiết bị này.
            </p>
            {notice ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} aria-hidden="true" /> {notice}
              </p>
            ) : null}
            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">Tự khóa sau khi không thao tác</p>
              <div className="flex flex-wrap gap-2">
                {PIN_TIMEOUT_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    onClick={() => changeTimeout(option.minutes)}
                    aria-pressed={timeout === option.minutes}
                    className={`cms-pin-press rounded-xl border px-3 py-2 text-sm font-bold ${timeout === option.minutes
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {config ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => goStep('verify-change')} className="cms-pin-press rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50">Đổi mã PIN</button>
                <button
                  type="button"
                  onClick={() => { close(); window.dispatchEvent(new CustomEvent(PIN_LOCK_NOW_EVENT)); }}
                  className="cms-pin-press inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white"
                >
                  <Lock size={15} aria-hidden="true" /> Khóa ngay
                </button>
                <button type="button" onClick={() => goStep('verify-remove')} className="cms-pin-press rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Tắt khóa</button>
              </div>
            ) : (
              <button type="button" onClick={() => goStep('create')} className="cms-pin-press w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white">
                Tạo mã PIN
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-center text-sm font-bold text-slate-700">{STEP_TITLES[step]}</p>
            <PinPad onComplete={handlePin} error={error} resetKey={resetKey} />
            <button type="button" onClick={() => goStep('overview')} style={{ boxShadow: 'none' }} className="bg-transparent text-sm font-semibold text-slate-500 hover:text-slate-800">
              Quay lại
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
