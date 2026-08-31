import { formatRemaining } from '../../../hooks/useCertPrepSession';

export default function CertPrepTimer({ remainingSeconds, light = false }) {
  const n = Math.max(0, Number(remainingSeconds) || 0);
  const warning = n > 0 && n <= 5 * 60;
  const critical = n > 0 && n <= 60;
  const label = formatRemaining(n);
  let liveText = '';
  if (n === 0) liveText = 'Hết giờ';
  else if (n === 60) liveText = 'Còn 1 phút';
  else if (n === 5 * 60) liveText = 'Còn 5 phút';

  const color = light
    ? (critical ? 'text-red-300' : warning ? 'text-amber-200' : 'text-amber-300')
    : (critical ? 'text-red-600' : warning ? 'text-amber-700' : 'text-slate-900');

  return (
    <div className={light ? 'text-left' : 'text-right'}>
      <p
        className={`${light ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'} font-black tabular-nums leading-none ${color}`}
        aria-hidden="true"
      >
        {label}
      </p>
      <span className="sr-only" aria-live="polite">
        {liveText}
      </span>
    </div>
  );
}
