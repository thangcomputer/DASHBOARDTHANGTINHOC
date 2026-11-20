import { useCallback, useEffect, useState } from 'react';

const LOGIN_ERROR_EN_FALLBACK = {
  'Mật khẩu không đúng.': 'Incorrect password.',
  'Số điện thoại hoặc mật khẩu không đúng': 'Incorrect phone number or password',
  'Số điện thoại/Gmail hoặc mật khẩu không đúng': 'Incorrect phone/Gmail or password',
  'Tài khoản hoặc mật khẩu không đúng': 'Incorrect account or password',
  'Tài khoản không tồn tại. Vui lòng đăng ký tài khoản mới để bắt đầu học.':
    'Account does not exist. Please register a new account to start learning.',
  'Tài khoản giảng viên không tồn tại. Vui lòng đăng ký hoặc liên hệ Học vụ để được cấp tài khoản.':
    'Teacher account does not exist. Please register or contact Academic Affairs to get an account.',
  'Địa chỉ Gmail này đã được sử dụng. Vui lòng đăng nhập.':
    'This Gmail address is already in use. Please sign in.',
};

export function formatLoginErrorText(message, language, tr) {
  const raw = String(message || '');
  if (!raw || language !== 'en') return raw;
  const translated = typeof tr === 'function' ? tr(raw) : raw;
  if (translated && translated !== raw) return translated;
  const trimmed = raw.trim();
  if (LOGIN_ERROR_EN_FALLBACK[trimmed]) return LOGIN_ERROR_EN_FALLBACK[trimmed];
  const lockMatch = trimmed.match(/^Sai mật khẩu quá (\d+) lần\.?$/i);
  if (lockMatch) return `Too many wrong password attempts (${lockMatch[1]}).`;
  return raw;
}

export function formatRetryButtonText(lockSecondsLeft, language) {
  return language === 'en' ? `Retry in ${lockSecondsLeft}s` : `Thử lại sau ${lockSecondsLeft}s`;
}

export function useLoginLockCountdown() {
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [lockDurationSeconds, setLockDurationSeconds] = useState(900);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [maxAttempts, setMaxAttempts] = useState(5);

  useEffect(() => {
    if (lockSecondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setLockSecondsLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockSecondsLeft]);

  const resetLockHint = useCallback(() => {
    setLockSecondsLeft(0);
    setRemainingAttempts(null);
  }, []);

  const applyLoginFailure = useCallback((status, data) => {
    const retry = Number(data?.retryAfterSeconds);
    const duration = Number(data?.lockDurationSeconds);
    const rem = Number(data?.remainingAttempts);
    const max = Number(data?.maxAttempts);

    if (Number.isFinite(duration) && duration > 0) {
      setLockDurationSeconds(Math.ceil(duration));
    }
    if (Number.isFinite(max) && max > 0) {
      setMaxAttempts(max);
    }

    if ((status === 403 || status === 429) && Number.isFinite(retry) && retry > 0) {
      setLockSecondsLeft(Math.ceil(retry));
      setRemainingAttempts(0);
      return;
    }

    if (Number.isFinite(rem) && rem >= 0) {
      setRemainingAttempts(rem);
      setLockSecondsLeft(0);
      return;
    }

    if (!data?.captchaError) {
      setLockSecondsLeft(0);
      setRemainingAttempts(null);
    }
  }, []);

  return {
    lockSecondsLeft,
    lockDurationSeconds,
    remainingAttempts,
    maxAttempts,
    applyLoginFailure,
    resetLockHint,
  };
}
