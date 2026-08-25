import { useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Star } from 'lucide-react';
import { formatHoaHong, STAR_BONUS_MIN_STARS, STAR_BONUS_MIN_STUDENTS } from '../utils/teacherCommission';

/**
 * Pháo hoa chào mừng / hoàn thành khóa / thưởng sao GV — canvas trên overlay (pointer-events: none).
 */
export default function WelcomeCelebrationOverlay({
  open,
  role = 'student',
  name = '',
  variant = 'welcome',
  courseName = '',
  /** Thưởng sao: { month, monthLabel, amount, minStudents, minStars } */
  starBonus = null,
  onClose,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const rocketsRef = useRef([]);
  const sparksRef = useRef([]);
  const flashesRef = useRef([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    rocketsRef.current = [];
    sparksRef.current = [];
    flashesRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return undefined;
    }
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const palette = [
      '#FF3B3B', '#FF6B6B', '#FFD700', '#FFEC8B', '#FFF8DC',
      '#FF8C00', '#FF4500', '#FFFFFF', '#FFB6C1', '#FFE4B5',
    ];

    const addFlash = (x, y, r = 80) => {
      flashesRef.current.push({ x, y, r, life: 1 });
    };

    const explode = (x, y, style = 'bloom') => {
      addFlash(x, y, style === 'bloom' ? 110 : 70);
      const rings = style === 'bloom' ? 2 : 1;
      for (let ring = 0; ring < rings; ring += 1) {
        const n = style === 'bloom' ? 64 : 40;
        const baseSpeed = (style === 'bloom' ? 4.2 : 3.2) + ring * 1.4;
        for (let i = 0; i < n; i += 1) {
          const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.08;
          const speed = baseSpeed + Math.random() * 2.8;
          sparksRef.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 0.006 + Math.random() * 0.007,
            color: palette[Math.floor(Math.random() * palette.length)],
            size: 2 + Math.random() * 2.8,
            glow: true,
            kind: 'spark',
          });
        }
      }
      // Tia dài kiểu pháo hoa thật
      const streaks = style === 'bloom' ? 18 : 10;
      for (let i = 0; i < streaks; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 5;
        sparksRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.01 + Math.random() * 0.008,
          color: palette[Math.floor(Math.random() * 5)],
          size: 1.2,
          glow: true,
          kind: 'streak',
          prevX: x,
          prevY: y,
        });
      }
      // Lõi trắng vàng
      for (let i = 0; i < 20; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.4 + Math.random() * 1.8;
        sparksRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.018,
          color: '#FFFBEB',
          size: 2.2 + Math.random() * 2.5,
          glow: false,
          kind: 'core',
        });
      }
      // Nổ phụ nhỏ lệch tâm
      if (style === 'bloom' && Math.random() > 0.35) {
        setTimeout(() => {
          explode(
            x + (Math.random() - 0.5) * 60,
            y + (Math.random() - 0.5) * 40,
            'pop',
          );
        }, 120 + Math.random() * 180);
      }
    };

    const launchRocket = (forcedX) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = forcedX ?? w * (0.1 + Math.random() * 0.8);
      // Nổ trên cao / quanh card (15%–48%)
      const targetY = h * (0.15 + Math.random() * 0.33);
      rocketsRef.current.push({
        x,
        y: h + 12,
        vx: (Math.random() - 0.5) * 0.9,
        vy: -(9 + Math.random() * 4),
        targetY,
        color: '#FFD700',
        trail: [],
        hue: Math.random() > 0.5 ? '#FF3B3B' : '#FFD700',
      });
    };

    // Mở màn: 3 quả giữa + 2 bên
    const w0 = window.innerWidth;
    [0, 220, 420].forEach((ms, i) => {
      setTimeout(() => launchRocket(w0 * (0.35 + i * 0.15)), ms);
    });
    setTimeout(() => launchRocket(w0 * 0.18), 150);
    setTimeout(() => launchRocket(w0 * 0.82), 300);
    setTimeout(() => launchRocket(), 600);
    setTimeout(() => launchRocket(), 900);

    const interval = setInterval(() => {
      launchRocket();
      if (Math.random() > 0.4) setTimeout(() => launchRocket(), 160);
    }, 750);

    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Flash sáng khi nổ
      const nextFlashes = [];
      for (const f of flashesRef.current) {
        f.life -= 0.06;
        if (f.life <= 0) continue;
        const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * f.life);
        grd.addColorStop(0, `rgba(255, 236, 180, ${0.45 * f.life})`);
        grd.addColorStop(0.45, `rgba(255, 80, 60, ${0.18 * f.life})`);
        grd.addColorStop(1, 'rgba(255,80,60,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * f.life, 0, Math.PI * 2);
        ctx.fill();
        nextFlashes.push(f);
      }
      flashesRef.current = nextFlashes;

      // Rocket
      const nextRockets = [];
      for (const r of rocketsRef.current) {
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.055;
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 18) r.trail.shift();

        for (let i = 0; i < r.trail.length; i += 1) {
          const t = r.trail[i];
          const a = (i + 1) / r.trail.length;
          ctx.globalAlpha = a * 0.7;
          ctx.fillStyle = r.hue;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 1.2 + a * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FFD700';
        ctx.fillStyle = '#FFF8DC';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (r.y <= r.targetY || r.vy >= -0.8) {
          explode(r.x, r.y, Math.random() > 0.3 ? 'bloom' : 'pop');
        } else {
          nextRockets.push(r);
        }
      }
      rocketsRef.current = nextRockets;

      // Sparks
      const nextSparks = [];
      for (const p of sparksRef.current) {
        if (p.kind === 'streak') {
          p.prevX = p.x;
          p.prevY = p.y;
        }
        p.vx *= 0.982;
        p.vy *= 0.982;
        p.vy += 0.04;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) continue;

        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        if (p.glow) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }

        if (p.kind === 'streak') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.6 * p.life;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.prevX, p.prevY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.4, p.size * p.life), 0, Math.PI * 2);
          ctx.fill();
        }
        nextSparks.push(p);
      }
      sparksRef.current = nextSparks;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const autoClose = setTimeout(() => {
      onClose?.();
    }, 9000);

    return () => {
      clearInterval(interval);
      clearTimeout(autoClose);
      window.removeEventListener('resize', resize);
      stop();
    };
  }, [open, onClose, stop]);

  if (!open) return null;

  const isTeacher = role === 'teacher';
  const isCourseComplete = variant === 'course_complete';
  const isStarBonus = variant === 'star_bonus';

  const bonusAmount = Number(starBonus?.amount) || 0;
  const monthLabel = starBonus?.monthLabel
    || (starBonus?.month
      ? (() => {
        const [y, m] = String(starBonus.month).split('-');
        return y && m ? `tháng ${Number(m)}/${y}` : String(starBonus.month);
      })()
      : '');
  const minHv = Number(starBonus?.minStudents) || STAR_BONUS_MIN_STUDENTS;
  const minStars = Number(starBonus?.minStars) || STAR_BONUS_MIN_STARS;

  if (isStarBonus) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="star-bonus-celebration-title"
      >
        <div
          className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950/80 via-amber-950/50 to-slate-950/85"
          onClick={() => onClose?.()}
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-amber-200/40 bg-white shadow-[0_25px_80px_-12px_rgba(0,0,0,0.55)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-500 px-6 pt-10 pb-12 text-center text-amber-950">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-white/30 blur-3xl" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onClose?.()}
              className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-amber-950/80 hover:bg-black/15 transition"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>

            {/* Sao to giữa màn hình popup */}
            <div className="relative mx-auto mb-2 flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full bg-amber-200/50 animate-ping opacity-40"
                style={{ animationDuration: '2.2s' }}
                aria-hidden="true"
              />
              <span
                className="absolute inset-2 rounded-full bg-gradient-to-br from-yellow-200 to-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.85)] animate-pulse"
                aria-hidden="true"
              />
              <Star
                size={72}
                className="relative text-amber-600 fill-amber-500 drop-shadow-[0_4px_12px_rgba(180,83,9,0.45)]"
                strokeWidth={1.25}
                aria-hidden="true"
              />
            </div>

            <p className="relative text-[11px] font-bold uppercase tracking-[0.28em] text-amber-900/70">
              Trung tâm Tin học Thắng Tin Học
            </p>
            <h2
              id="star-bonus-celebration-title"
              className="relative mt-3 text-2xl sm:text-[1.75rem] font-black tracking-tight leading-tight text-amber-950"
            >
              Chúc mừng đạt thưởng sao!
            </h2>
            {name ? (
              <p className="relative mt-2 text-sm font-semibold text-amber-900/85">
                Giảng viên <span className="font-black text-amber-950">{name}</span>
              </p>
            ) : null}
            {monthLabel ? (
              <p className="relative mt-2 text-sm font-bold text-amber-900/90 capitalize">
                {monthLabel}
              </p>
            ) : null}
          </div>

          <div className="px-6 sm:px-8 py-6 sm:py-7 text-center space-y-4">
            <p className="text-[15px] leading-relaxed text-slate-600">
              Bạn đã đủ điều kiện thưởng sao
              {monthLabel ? ` ${monthLabel}` : ''}
              {' '}
              (≥{minHv} HV · ≥{minStars}★).
            </p>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-yellow-50 px-4 py-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
                Sẽ được cộng vào lương
              </p>
              <p className="mt-1 text-3xl sm:text-4xl font-black tabular-nums text-amber-700 tracking-tight">
                +{formatHoaHong(bonusAmount)}
              </p>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Số tiền này được cộng khi Admin chi lương tháng tương ứng.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onClose?.()}
              className="w-full min-h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-amber-950 text-sm font-bold shadow-lg shadow-amber-500/30 transition tracking-wide"
            >
              Tuyệt vời!
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden="true"
        />
      </div>
    );
  }

  const title = isCourseComplete
    ? 'Hoàn thành khóa học'
    : isTeacher
      ? 'Chào mừng giảng viên mới'
      : 'Chào mừng học viên mới';

  const body = isCourseComplete
    ? `Bạn đã hoàn thành khóa ${courseName || 'học'} tại Trung tâm Tin học Thắng Tin Học. Đây là cột mốc đáng tự hào — hãy tiếp tục luyện tập để vững kiến thức lâu dài.`
    : isTeacher
      ? 'Bạn đã chính thức trở thành giảng viên của Trung tâm Tin học Thắng Tin Học. Chúc bạn đồng hành và truyền cảm hứng thật nhiều trên hành trình phía trước.'
      : 'Bạn đã chính thức trở thành học viên của Trung tâm Tin học Thắng Tin Học. Chúc bạn học tập hiệu quả và đạt nhiều thành quả đáng tự hào.';

  const poemLines = isTeacher && !isCourseComplete
    ? [
      'Mỗi buổi dạy là một cơ hội gieo tri thức.',
      'Kiên trì đồng hành, học viên vững bước vươn xa.',
    ]
    : [
      'Mỗi ngày một chút, bền bỉ sẽ thành công.',
      'Luyện thêm một buổi, vững vàng từng bước chân.',
      'Học đều hôm nay — tự tin ngày mai.',
    ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-celebration-title"
    >
      {/* 1. Nền tối */}
      <div
        className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950/75 via-slate-900/65 to-slate-950/80"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />

      {/* 2. Card */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[28px] border border-white/25 bg-white shadow-[0_25px_80px_-12px_rgba(0,0,0,0.5)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-red-700 via-red-600 to-rose-700 px-6 pt-8 pb-10 text-center text-white">
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onClose?.()}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200/40 bg-white/15 shadow-inner backdrop-blur-sm">
            <Sparkles size={30} className="text-amber-200" aria-hidden="true" />
          </div>
          <p className="relative text-[11px] font-bold uppercase tracking-[0.28em] text-amber-100/95">
            Trung tâm Tin học Thắng Tin Học
          </p>
          <h2 id="welcome-celebration-title" className="relative mt-3 text-2xl sm:text-[1.7rem] font-black tracking-tight leading-tight">
            {title}
          </h2>
          {name ? (
            <p className="relative mt-2 text-sm font-medium text-red-50/95">
              Kính gửi <span className="font-bold text-white">{name}</span>
            </p>
          ) : null}
          <p className="relative mt-3 text-base font-bold text-amber-100 tracking-wide">
            Chúc bạn thành công!
          </p>
        </div>

        <div className="px-6 sm:px-8 py-6 sm:py-7 text-center space-y-4">
          <p className="text-[15px] leading-relaxed text-slate-600">{body}</p>

          <blockquote className="rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/80 to-white px-4 py-4">
            <div className="space-y-1.5 text-[14px] italic leading-relaxed text-slate-700">
              {poemLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
              Học đều · Luyện tập · Kiên trì
            </p>
          </blockquote>

          <div className="h-px w-16 mx-auto bg-gradient-to-r from-transparent via-red-200 to-transparent" aria-hidden="true" />
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Lời chào từ đội ngũ Thắng Tin Học
          </p>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-full min-h-12 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white text-sm font-bold shadow-lg shadow-red-600/25 transition tracking-wide"
          >
            {isCourseComplete ? 'Tiếp tục hành trình' : 'Tiếp tục vào hệ thống'}
          </button>
        </div>
      </div>

      {/* 3. Pháo hoa TRÊN cùng — không chặn click */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-20"
        aria-hidden="true"
      />
    </div>
  );
}
