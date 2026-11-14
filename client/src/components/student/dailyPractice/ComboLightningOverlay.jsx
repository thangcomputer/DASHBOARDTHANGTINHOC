import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Flame, Sparkles } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';

/**
 * Hiệu ứng toàn màn hình kiểu tia chớp khi đạt combo 3 câu liên tiếp đúng.
 * Tự động biến mất sau 2.2 giây, có âm thanh tia chớp combo kích thích hưng phấn.
 */
export default function ComboLightningOverlay({ combo = 3, onDone }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Phát âm thanh tia chớp combo bùng nổ
    gameSounds.lightningCombo();

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1800);

    const closeTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [onDone]);

  if (!visible) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] flex items-center justify-center pointer-events-none select-none overflow-hidden transition-opacity duration-300 ${
        fading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      aria-live="assertive"
      role="status"
    >
      {/* 1. Màn chớp điện toàn màn hình (Flash shockwave) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-950/70 via-slate-950/80 to-red-950/70 backdrop-blur-xs animate-lightning-flash" />

      {/* 2. Các tia sét SVGs xẹt qua màn hình */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="lightning-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tia sét góc trên trái bắn vào giữa */}
        <polyline
          points="0,40 180,120 140,220 340,320 280,410 480,480"
          fill="none"
          stroke="#FACC15"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lightning-glow)"
          className="animate-pulse"
          opacity="0.9"
        />
        {/* Tia sét góc trên phải */}
        <polyline
          points="1000,0 860,140 910,210 720,320 780,390 560,460"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lightning-glow)"
          className="animate-pulse [animation-delay:100ms]"
          opacity="0.85"
        />
        {/* Tia sét từ đáy lên */}
        <polyline
          points="200,900 320,720 270,640 450,550"
          fill="none"
          stroke="#FB923C"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lightning-glow)"
          className="animate-pulse [animation-delay:180ms]"
          opacity="0.9"
        />
      </svg>

      {/* 3. Popup hiệu ứng trung tâm (Bùng nổ kích thích người học) */}
      <div className="relative z-20 flex flex-col items-center text-center px-4 animate-combo-pop">
        {/* Vòng hào quang năng lượng điện */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-600 opacity-75 blur-xl animate-spin [animation-duration:3s]" />
          
          {/* Biểu tượng tia sét 3D lớn */}
          <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-emerald-600 shadow-[0_0_40px_rgba(245,158,11,0.8),inset_0_2px_4px_rgba(255,255,255,0.6)] border-2 border-amber-200">
            <Zap size={48} className="text-white fill-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] animate-bounce" />
          </div>
        </div>

        {/* Huy hiệu tia chớp bùng nổ */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-white shadow-lg border border-amber-200/50">
          <Flame size={14} className="text-amber-200 animate-pulse" />
          <span>TIA CHỚP BÙNG NỔ</span>
          <Flame size={14} className="text-amber-200 animate-pulse" />
        </div>

        {/* Chữ Combo X3 rực rỡ */}
        <h1 className="mt-2 text-4xl sm:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_20px_rgba(239,68,68,0.8)]">
          COMBO <span className="bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400 bg-clip-text text-transparent">X{combo}!</span>
        </h1>

        {/* Lời cổ vũ tạo động lực */}
        <p className="mt-1 text-sm sm:text-base font-extrabold text-amber-200 drop-shadow-md">
          {combo === 3 ? '⚡ 3 CÂU ĐÚNG LIÊN TIẾP – QUÁ XUẤT SẮC! ⚡' : `⚡ ${combo} CÂU ĐÚNG LIÊN TIẾP – KHÔNG THỂ CẢN PHÁ! ⚡`}
        </p>

        {/* Các hạt tia lửa điện trang trí xung quanh */}
        <div className="mt-2 flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
          <Sparkles size={16} className="animate-spin" />
          <span>Tăng tốc độ & nhân đôi cảm hứng học tập!</span>
          <Sparkles size={16} className="animate-spin" />
        </div>
      </div>
    </div>,
    document.body
  );
}

