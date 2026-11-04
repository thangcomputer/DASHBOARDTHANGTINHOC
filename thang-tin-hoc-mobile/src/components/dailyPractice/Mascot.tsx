import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

export type MascotMood = 'idle' | 'happy' | 'sad' | 'thinking';

/** Linh vật "Giọt Nước" — giống bản web; nhún khi vui, rũ khi buồn. */
export function Mascot({ mood = 'idle', size = 96 }: { mood?: MascotMood; size?: number }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const motion = useRef(new Animated.Value(0)).current;
  const happy = mood === 'happy';
  const sad = mood === 'sad';
  const thinking = mood === 'thinking';

  useEffect(() => {
    motion.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: happy ? 420 : 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: happy ? 420 : 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [happy, motion]);

  const translateY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, happy ? -10 : sad ? 3 : -5] });
  const rotate = motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', sad ? '-4deg' : '0deg'] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }, { rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <RadialGradient id={`body-${gid}`} cx="38%" cy="32%" r="75%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="30%" stopColor={sad ? '#BFDBFE' : '#FECACA'} />
            <Stop offset="100%" stopColor={sad ? '#3B82F6' : '#DC2626'} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="60" cy="112" rx="26" ry="5" fill="rgba(15,23,42,0.12)" />
        <Path d="M60 8 C60 8 22 52 22 76 a38 38 0 0 0 76 0 C98 52 60 8 60 8 Z" fill={`url(#body-${gid})`} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
        <Ellipse cx="45" cy="50" rx="8" ry="12" fill="rgba(255,255,255,0.75)" transform="rotate(-20 45 50)" />
        {happy ? (
          <G>
            <Path d="M42 74 q6 -8 12 0" stroke="#0F172A" strokeWidth={3.5} fill="none" strokeLinecap="round" />
            <Path d="M66 74 q6 -8 12 0" stroke="#0F172A" strokeWidth={3.5} fill="none" strokeLinecap="round" />
            <Path d="M48 86 q12 14 24 0 Z" fill="#7F1D1D" />
            <Path d="M100 22 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#FBBF24" />
            <Path d="M16 36 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#FBBF24" />
          </G>
        ) : sad ? (
          <G>
            <Circle cx="48" cy="76" r="4" fill="#0F172A" />
            <Circle cx="72" cy="76" r="4" fill="#0F172A" />
            <Path d="M42 68 l10 3 M78 68 l-10 3" stroke="#0F172A" strokeWidth={2.5} strokeLinecap="round" />
            <Path d="M50 94 q10 -8 20 0" stroke="#0F172A" strokeWidth={3} fill="none" strokeLinecap="round" />
            <Path d="M76 82 q3 6 0 9 q-3 -3 0 -9 Z" fill="#60A5FA" />
          </G>
        ) : (
          <G>
            <Circle cx={thinking ? 50 : 48} cy={thinking ? 72 : 76} r="4.5" fill="#0F172A" />
            <Circle cx={thinking ? 74 : 72} cy={thinking ? 72 : 76} r="4.5" fill="#0F172A" />
            <Circle cx={thinking ? 51.5 : 49.5} cy={thinking ? 70.5 : 74.5} r="1.4" fill="#FFFFFF" />
            <Circle cx={thinking ? 75.5 : 73.5} cy={thinking ? 70.5 : 74.5} r="1.4" fill="#FFFFFF" />
            {thinking
              ? <Circle cx="62" cy="90" r="3" fill="#7F1D1D" />
              : <Path d="M52 88 q8 7 16 0" stroke="#0F172A" strokeWidth={3} fill="none" strokeLinecap="round" />}
            {thinking ? <SvgText x="92" y="30" fontSize="22" fontWeight="900" fill="#F59E0B">?</SvgText> : null}
          </G>
        )}
        <Circle cx="38" cy="86" r="5" fill="rgba(244,114,182,0.45)" />
        <Circle cx="82" cy="86" r="5" fill="rgba(244,114,182,0.45)" />
      </Svg>
    </Animated.View>
  );
}
