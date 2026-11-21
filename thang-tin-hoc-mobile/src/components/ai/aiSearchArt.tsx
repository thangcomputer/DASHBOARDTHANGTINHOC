import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const SQ_GRAD = 'aiSearchSqGrad';
export function SearchAiIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id={SQ_GRAD} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#6EE7B7" />
          <Stop offset="0.42" stopColor="#2DD4BF" />
          <Stop offset="1" stopColor="#0F766E" />
        </LinearGradient>
      </Defs>
      <Rect x="4" y="4" width="56" height="56" rx="14" fill={`url(#${SQ_GRAD})`} />
      <Circle cx="27.5" cy="27.5" r="10.5" stroke="#FFFFFF" strokeWidth={3.25} fill="none" />
      <Path d="M35.2 35.2 45.5 45.5" stroke="#FFFFFF" strokeWidth={3.6} strokeLinecap="round" />
      <Path
        fill="#FFFFFF"
        d="M27.5 21.2 28.55 25.35 32.7 26.4 28.55 27.45 27.5 31.6 26.45 27.45 22.3 26.4 26.45 25.35z"
      />
      <Path
        fill="#FFFFFF"
        d="M39.8 17.2 40.42 19.4 42.62 20.02 40.42 20.64 39.8 22.84 39.18 20.64 36.98 20.02 39.18 19.4z"
      />
    </Svg>
  );
}

export function AiSparklesDecor({ width = 20, height = 16 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 36 28" fill="none">
      <Path fill="#FACC15" d="M11 4.5 12.55 9.85 17.9 11.4 12.55 12.95 11 18.3 9.45 12.95 4.1 11.4 9.45 9.85z" />
      <Path fill="#FDE047" d="M27.2 12.8 27.75 14.55 29.5 15.1 27.75 15.65 27.2 17.4 26.65 15.65 24.9 15.1 26.65 14.55z" />
    </Svg>
  );
}
