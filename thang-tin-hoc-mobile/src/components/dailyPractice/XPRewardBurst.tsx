import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Star, Zap } from 'lucide-react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const TRAJECTORIES = [
  { dx: -28, dy: -36, delay: 0 },
  { dx: 26, dy: -40, delay: 50 },
  { dx: -12, dy: -48, delay: 100 },
  { dx: 32, dy: -30, delay: 140 },
  { dx: 4, dy: -52, delay: 80 },
];

function StarParticle({ dx, dy, delay }: { dx: number; dy: number; delay: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 850,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [delay, progress]);

  const style = {
    opacity: progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
      { scale: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.35, 1, 0.3] }) },
    ],
  };

  return (
    <Animated.View style={[styles.starParticle, style]} pointerEvents="none">
      <Star size={12} color="#FBBF24" fill="#FBBF24" />
    </Animated.View>
  );
}

export function XPRewardBurst({ xpAmount, burstKey = '' }: { xpAmount: number; burstKey?: string }) {
  const amount = Math.max(0, Math.round(Number(xpAmount) || 0));
  const [burst, setBurst] = useState(false);
  const pop = useRef(new Animated.Value(0.85)).current;
  const seenRef = useRef<string>('');

  const stars = useMemo(() => TRAJECTORIES, []);

  useEffect(() => {
    if (amount <= 0) return undefined;
    const key = `${burstKey}:${amount}`;
    if (seenRef.current === key) return undefined;
    seenRef.current = key;
    setBurst(true);
    pop.setValue(0.85);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: USE_NATIVE_DRIVER }).start();
    const timer = setTimeout(() => setBurst(false), 1000);
    return () => clearTimeout(timer);
  }, [amount, burstKey, pop]);

  if (amount <= 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      {burst ? stars.map((s, i) => <StarParticle key={i} {...s} />) : null}
      <Animated.View style={[styles.pill, { transform: [{ scale: pop }] }]}>
        <Zap size={13} color="#F59E0B" fill="#FBBF24" />
        <Text style={styles.pillText}>{`+${amount} XP`}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  starParticle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -6,
    marginTop: -6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
});
