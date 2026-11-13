import React from 'react';
import './comboCelebration.css';

/**
 * Radial glow + sparkle rays phía sau mascot (GPU: opacity + transform).
 */
export default function ComboGlowEffect({ variant = 'green' }) {
  return (
    <div className={`dp-combo-glow dp-combo-glow--${variant}`} aria-hidden="true">
      <div className="dp-combo-glow__disc" />
      <span className="dp-combo-glow__ring" />
      <span className="dp-combo-glow__ray dp-combo-glow__ray--a" />
      <span className="dp-combo-glow__ray dp-combo-glow__ray--b" />
      <span className="dp-combo-glow__ray dp-combo-glow__ray--c" />
      <span className="dp-combo-glow__spark dp-combo-glow__spark--1" />
      <span className="dp-combo-glow__spark dp-combo-glow__spark--2" />
      <span className="dp-combo-glow__spark dp-combo-glow__spark--3" />
    </div>
  );
}
