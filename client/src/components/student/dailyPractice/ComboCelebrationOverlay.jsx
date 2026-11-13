import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, Zap } from 'lucide-react';
import Mascot from './Mascot';
import ComboGlowEffect from './ComboGlowEffect';
import { gameSounds } from '../../../utils/sound';
import './comboCelebration.css';
import { comboArtGifSrc, comboArtWebpFallback } from '../../../../../shared/dailyPractice/comboArtSources.mjs';

const TIMING_MS = { 3: 2200, 5: 2800, 10: 2800 };
const FADE_MS = 320;

const TIER_10 = {
  glow: 'gold',
  mascot: 'combo10',
  ribbonClass: 'dp-combo-ribbon--x10',
  ribbonLabel: 'COMBO ×10',
  message: 'Mười câu đúng liên tiếp — huyền thoại DewSkill!',
  stars: 5,
  laurel: true,
  confetti: true,
};

function LaurelSvg({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 42C8 28 14 18 22 10C18 22 16 34 10 42H8Z" fill="#FDE047" stroke="#F59E0B" strokeWidth="1.2" />
      <path d="M12 38C18 30 20 20 26 12C22 24 20 32 14 38H12Z" fill="#FACC15" />
      <circle cx="28" cy="14" r="3" fill="#FEF08A" />
    </svg>
  );
}

function ComboConfetti({ count = 10 }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, id) => ({
      id,
      left: `${10 + (id * 17) % 80}%`,
      top: `${8 + (id % 5) * 6}%`,
      color: ['#F472B6', '#38BDF8', '#FACC15', '#34D399', '#FB923C'][id % 5],
      delay: `${880 + (id % 4) * 90}ms`,
      rotate: `${(id % 7) * 24 - 40}deg`,
    })),
    [count],
  );

  return (
    <div className="dp-combo-confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="dp-combo-confetti-bit"
          style={{
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            animationDelay: p.delay,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

function DewComboStars({ count = 5 }) {
  return (
    <div className={`dp-combo-stars dp-combo-stars--${count}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} size={i === Math.floor(count / 2) ? 28 : 22} className={`dp-combo-star dp-combo-star--${i}`} />
      ))}
    </div>
  );
}

function ComboArtOverlay({ tier, exiting }) {
  const gifSrc = comboArtGifSrc(tier);
  const webpSrc = comboArtWebpFallback(tier);
  const [src, setSrc] = useState(gifSrc);
  const label = tier === 3 ? 'Combo ba câu đúng liên tiếp' : 'Combo năm câu đúng liên tiếp';

  useEffect(() => {
    setSrc(gifSrc);
  }, [gifSrc, tier]);

  return (
    <div className={`dp-combo-overlay${exiting ? ' dp-combo-overlay--exit' : ''}`} aria-live="polite" role="status">
      <div className="dp-combo-dim dp-combo-dim--soft" aria-hidden="true" />
      <div className="dp-combo-art-wrap">
        <img
          src={src}
          alt={label}
          className="dp-combo-art dp-combo-art--gif"
          draggable={false}
          onError={() => {
            if (src !== webpSrc) setSrc(webpSrc);
          }}
        />
      </div>
    </div>
  );
}

function ComboTenOverlay({ exiting, bonusXp }) {
  const pillText = bonusXp > 0 ? `+${bonusXp} XP` : null;
  return (
    <div className={`dp-combo-overlay${exiting ? ' dp-combo-overlay--exit' : ''}`} aria-live="polite" role="status">
      <div className="dp-combo-dim dp-combo-dim--soft" aria-hidden="true" />
      <ComboConfetti count={14} />
      <div className="dp-combo-stage dp-combo-stage--tier5">
        <ComboGlowEffect variant={TIER_10.glow} />
        <DewComboStars count={TIER_10.stars} />
        <div className="dp-combo-mascot-wrap">
          <Mascot emotion={TIER_10.mascot} size={108} />
        </div>
        <div className="dp-combo-hills" aria-hidden="true" />
        <div className="dp-combo-ribbon-wrap">
          <LaurelSvg className="dp-combo-laurel" />
          <div className={`dp-combo-ribbon ${TIER_10.ribbonClass}`}>
            <span>{TIER_10.ribbonLabel}</span>
          </div>
          <LaurelSvg className="dp-combo-laurel dp-combo-laurel--right" />
        </div>
        <div className="dp-combo-message-card">
          <p className="dp-combo-message-title">{TIER_10.message}</p>
          {pillText ? (
            <span className="dp-combo-pill">
              <Zap size={14} className="fill-amber-400 text-amber-500" aria-hidden="true" />
              {pillText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Combo ×3 / ×5: artwork GIF (ưu tiên) + fallback WebP + nền đen nhạt.
 * Combo ×10: overlay lớp (giữ logic hiện có).
 */
export default function ComboCelebrationOverlay({ combo = 3, bonusXp = 0, onDone }) {
  const tier = [3, 5, 10].includes(combo) ? combo : 3;
  const displayMs = TIMING_MS[tier] || 2600;
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    gameSounds.lightningCombo();

    const fadeAt = displayMs - FADE_MS;
    const fadeTimer = window.setTimeout(() => setExiting(true), fadeAt);
    const closeTimer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, displayMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(closeTimer);
    };
  }, [combo, displayMs, onDone]);

  if (!visible) return null;

  const body = tier === 10
    ? <ComboTenOverlay exiting={exiting} bonusXp={bonusXp} />
  : <ComboArtOverlay tier={tier} exiting={exiting} />;

  return createPortal(body, document.body);
}
