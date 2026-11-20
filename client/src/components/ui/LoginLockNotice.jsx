import React from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export function LoginLockStatusBanner({
  lockSecondsLeft,
  lockDurationSeconds,
  remainingAttempts,
  maxAttempts,
  compact = false,
}) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const padClass = compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-1.5 text-xs';

  if (lockSecondsLeft > 0) {
    const lockedMsg = isEn
      ? `Locked ${lockDurationSeconds}s — retry in ${lockSecondsLeft}s.`
      : `Tạm khóa ${lockDurationSeconds} giây — thử lại sau ${lockSecondsLeft}s.`;
    return (
      <div className={`rounded-lg bg-amber-500/15 border border-amber-400/30 ${padClass} font-bold text-amber-200 flex items-center gap-1.5`}>
        <Clock size={compact ? 13 : 14} aria-hidden="true" className="shrink-0 text-amber-300" />
        <span>{lockedMsg}</span>
      </div>
    );
  }

  if (remainingAttempts !== null && remainingAttempts > 0) {
    const warnMsg = isEn
      ? `${remainingAttempts}/${maxAttempts} attempts left (${lockDurationSeconds}s lock).`
      : `Còn ${remainingAttempts}/${maxAttempts} lần thử (khóa ${lockDurationSeconds} giây).`;
    return (
      <div className={`rounded-lg bg-amber-500/15 border border-amber-400/30 ${padClass} font-bold text-amber-200`}>
        <span>{warnMsg}</span>
      </div>
    );
  }

  return null;
}
