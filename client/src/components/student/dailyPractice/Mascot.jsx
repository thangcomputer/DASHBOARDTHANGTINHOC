import { useId } from 'react';

/** Linh vật "Giọt Nước" — biểu cảm theo kết quả: idle / happy / sad / thinking. */
export default function Mascot({ mood = 'idle', size = 96, className = '' }) {
  const gid = useId().replace(/:/g, '');
  const happy = mood === 'happy';
  const sad = mood === 'sad';
  const thinking = mood === 'thinking';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`${className} ${happy ? 'dp-bounce' : sad ? 'dp-droop' : 'dp-float'}`}
      role="img"
      aria-label={happy ? 'Linh vật vui mừng' : sad ? 'Linh vật buồn' : 'Linh vật'}
    >
      <defs>
        <radialGradient id={`body-${gid}`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor={sad ? '#BFDBFE' : '#FECACA'} />
          <stop offset="100%" stopColor={sad ? '#3B82F6' : '#DC2626'} />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="112" rx="26" ry="5" fill="rgba(15,23,42,0.12)" />
      <path
        d="M60 8 C60 8 22 52 22 76 a38 38 0 0 0 76 0 C98 52 60 8 60 8 Z"
        fill={`url(#body-${gid})`}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2"
      />
      <ellipse cx="45" cy="50" rx="8" ry="12" fill="rgba(255,255,255,0.75)" transform="rotate(-20 45 50)" />
      {happy ? (
        <>
          <path d="M42 74 q6 -8 12 0" stroke="#0F172A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M66 74 q6 -8 12 0" stroke="#0F172A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M48 86 q12 14 24 0 Z" fill="#7F1D1D" />
        </>
      ) : sad ? (
        <>
          <circle cx="48" cy="76" r="4" fill="#0F172A" />
          <circle cx="72" cy="76" r="4" fill="#0F172A" />
          <path d="M42 68 l10 3 M78 68 l-10 3" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 94 q10 -8 20 0" stroke="#0F172A" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M76 82 q3 6 0 9 q-3 -3 0 -9 Z" fill="#60A5FA" className="dp-tear" />
        </>
      ) : (
        <>
          <circle cx={thinking ? 50 : 48} cy={thinking ? 72 : 76} r="4.5" fill="#0F172A" />
          <circle cx={thinking ? 74 : 72} cy={thinking ? 72 : 76} r="4.5" fill="#0F172A" />
          <circle cx={thinking ? 51.5 : 49.5} cy={thinking ? 70.5 : 74.5} r="1.4" fill="#FFFFFF" />
          <circle cx={thinking ? 75.5 : 73.5} cy={thinking ? 70.5 : 74.5} r="1.4" fill="#FFFFFF" />
          {thinking
            ? <circle cx="62" cy="90" r="3" fill="#7F1D1D" />
            : <path d="M52 88 q8 7 16 0" stroke="#0F172A" strokeWidth="3" fill="none" strokeLinecap="round" />}
        </>
      )}
      <circle cx="38" cy="86" r="5" fill="rgba(244,114,182,0.45)" />
      <circle cx="82" cy="86" r="5" fill="rgba(244,114,182,0.45)" />
      {thinking && (
        <text x="92" y="30" fontSize="22" fontWeight="900" fill="#F59E0B">?</text>
      )}
      {happy && (
        <g fill="#FBBF24">
          <path d="M100 22 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" className="dp-twinkle" />
          <path d="M16 36 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" className="dp-twinkle dp-twinkle-late" />
        </g>
      )}
    </svg>
  );
}
