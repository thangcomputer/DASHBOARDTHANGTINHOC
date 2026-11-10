import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Crown, Sparkles, Award, Star, CheckCircle } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import Mascot from './Mascot';

const CONFETTI_COLORS = ['#F59E0B', '#EF4444', '#10B981', '#0EA5E9', '#A855F7', '#EC4899', '#FACC15'];

function MascotBurstConfetti({ count = 36 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const distance = 160 + (i % 5) * 28;
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance - 30)}px`,
      rot: `${(i * 65) % 720 - 360}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(i * 25) % 250}ms`,
    };
  }), [count]);

  return pieces.map((piece, index) => (
    <span
      key={index}
      className="cms-goal-confetti"
      style={{
        background: piece.color,
        '--dx': piece.dx,
        '--dy': piece.dy,
        '--rot': piece.rot,
        animationDelay: piece.delay,
      }}
      aria-hidden="true"
    />
  ));
}

/**
 * Hiệu ứng toàn màn hình chúc mừng linh vật khi người học làm đúng hết liên tiếp (100% chính xác liên tục).
 * Tự biến mất trong vài giây hoặc bấm để tiếp tục ngay.
 * Có âm thanh khải hoàn chiến thắng hoành tráng.
 */
export default function PerfectStreakMascotOverlay({ total = 0, onDone }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Phát âm thanh khúc khải hoàn linh vật
    gameSounds.mascotVictory();

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 3000);

    const closeTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 3400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [onDone]);

  const handleDismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 200);
  };

  if (!visible) return null;

  return createPortal(
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[9995] flex items-center justify-center p-4 cursor-pointer select-none overflow-hidden transition-all duration-300 ${
        fading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      aria-live="assertive"
      role="status"
    >
      {/* 1. Màn nền mờ ấm áp với các tia sáng quay tròn (Radiant Sunburst) */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/85 via-slate-950/90 to-emerald-950/85 backdrop-blur-sm" />
      
      {/* Tia sáng hào quang xoay tròn */}
      <div className="pointer-events-none absolute h-[600px] w-[600px] rounded-full bg-gradient-to-r from-amber-400/20 via-yellow-300/30 to-amber-500/20 blur-3xl animate-ray-spin" />

      {/* Pháo hoa confetti rực rỡ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <MascotBurstConfetti count={40} />
      </div>

      {/* 2. Thẻ chúc mừng linh vật trung tâm */}
      <div className="relative z-20 flex w-full max-w-md flex-col items-center rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-50 via-white to-amber-50/90 p-6 text-center shadow-[0_20px_60px_rgba(245,158,11,0.45)] animate-mascot-burst sm:p-8">
        
        {/* Vương miện vàng lơ lửng phía trên */}
        <div className="absolute -top-7 flex items-center justify-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-[0_4px_16px_rgba(245,158,11,0.6)] border-2 border-white animate-bounce">
            <Crown size={28} className="fill-amber-600 text-amber-700" />
          </div>
        </div>

        {/* Huy hiệu đỉnh cao */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-900 shadow-sm">
          <Sparkles size={14} className="fill-amber-500 text-amber-600" />
          <span>BÁCH PHÁT BÁCH TRÚNG 100%</span>
          <Sparkles size={14} className="fill-amber-500 text-amber-600" />
        </div>

        {/* Linh vật ăn mừng vui vẻ (Mascot celebration GIF) */}
        <div className="relative mt-4 flex items-center justify-center">
          <div className="absolute -inset-2 rounded-full bg-amber-200/50 blur-xl animate-pulse" />
          <div className="relative transform hover:scale-105 transition duration-300">
            <Mascot mood="celebrate" size={130} />
          </div>
        </div>

        {/* Các ngôi sao vinh quang */}
        <div className="mt-2 flex items-center gap-1.5 justify-center">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={20} className="fill-amber-400 text-amber-500 drop-shadow-sm animate-pulse" style={{ animationDelay: `${s * 100}ms` }} />
          ))}
        </div>

        {/* Tiêu đề chúc mừng */}
        <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          XUẤT SẮC TUYỆT ĐỐI! 🎯
        </h2>

        {/* Dòng trạng thái đúng hết liên tiếp */}
        <p className="mt-1.5 text-sm sm:text-base font-extrabold text-amber-700">
          ĐÚNG HẾT TẤT CẢ CÁC CÂU LIÊN TIẾP!
        </p>

        <p className="mt-1 text-xs text-slate-600 font-semibold max-w-xs">
          Bạn đã hoàn thành trọn vẹn {total ? `${total}/${total}` : '100%'} câu hỏi mà không hề sai một câu nào. Phong độ đỉnh cao!
        </p>

        {/* Nút bấm tiếp tục hoặc tự biến mất */}
        <button
          type="button"
          onClick={handleDismiss}
          className="dp-3d-btn mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg hover:brightness-105 active:scale-98"
        >
          <CheckCircle size={18} />
          <span>Tuyệt vời, tiếp tục thôi!</span>
        </button>
      </div>
    </div>,
    document.body
  );
}

