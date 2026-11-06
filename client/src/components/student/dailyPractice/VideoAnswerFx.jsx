import { useEffect, useMemo, useRef } from 'react';
export function readScreenshot(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let fake = 8;
    onProgress(fake);
    const timer = window.setInterval(() => {
      fake = Math.min(68, fake + 7);
      onProgress(fake);
    }, 120);
    const stop = () => window.clearInterval(timer);
    reader.onerror = () => { stop(); reject(new Error('Không đọc được ảnh')); };
    reader.onload = () => {
      stop();
      onProgress(78);
      const img = new Image();
      img.onload = () => {
        onProgress(92);
        const scale = Math.min(1, 960 / Math.max(img.width, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        onProgress(100);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('Ảnh không hợp lệ'));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function UploadProgress({ percent, grading }) {
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={grading ? 100 : percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full bg-sky-600 transition-all ${grading ? 'animate-pulse' : ''}`} style={{ width: `${grading ? 100 : percent}%` }} />
      </div>
      <p className="text-center text-sm font-bold text-slate-600">{grading ? 'AI đang chấm…' : `Đang tải ảnh lên ${percent}%`}</p>
    </div>
  );
}

export const HAPPY_MASCOT = '/cam-xuc-animation/vui%20t%C6%B0%C6%A1i.webp';
export const CRY_MASCOT = '/cam-xuc-animation/kh%C3%B3c.webp';

export function FireworkBurst() {
  const sparks = useMemo(() => {
    const colors = ['#F97316', '#FBBF24', '#EF4444', '#22C55E', '#38BDF8', '#F472B6'];
    const bursts = [
      { ox: '50%', oy: '38%' },
      { ox: '24%', oy: '46%' },
      { ox: '76%', oy: '44%' },
    ];
    return bursts.flatMap((burst, burstIndex) => Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const distance = 72 + (i % 4) * 18;
      return {
        dx: `${Math.round(Math.cos(angle) * distance)}px`,
        dy: `${Math.round(Math.sin(angle) * distance)}px`,
        color: colors[(i + burstIndex) % colors.length],
        delay: `${burstIndex * 140}ms`,
        ox: burst.ox,
        oy: burst.oy,
      };
    }));
  }, []);
  return sparks.map((spark, index) => (
    <span
      key={index}
      className="dp-firework"
      style={{
        background: spark.color,
        color: spark.color,
        '--dx': spark.dx,
        '--dy': spark.dy,
        '--ox': spark.ox,
        '--oy': spark.oy,
        animationDelay: spark.delay,
      }}
      aria-hidden="true"
    />
  ));
}

/** Đúng: pháo hoa + linh vật vui, rồi tự đóng. */
export function AnswerCheer({ onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current?.(), 1700);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/55">
      <FireworkBurst />
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <img src={HAPPY_MASCOT} alt="" className="dp-pay-mascot h-40 w-40 object-contain drop-shadow-lg" />
        <p className="mt-1 rounded-full bg-white px-4 py-2 text-base font-black text-emerald-700 shadow">Đúng rồi, xem tiếp nào!</p>
      </div>
    </div>
  );
}
