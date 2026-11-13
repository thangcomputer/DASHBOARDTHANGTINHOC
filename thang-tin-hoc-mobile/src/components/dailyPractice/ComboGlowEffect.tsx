import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function ComboGlowEffect({ variant = 'green' }: { variant?: 'green' | 'gold' }) {
  const isGold = variant === 'gold';
  const breathe = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    breathe.setValue(0);
    ring.setValue(0);
    Animated.sequence([
      Animated.timing(breathe, {
        toValue: 1,
        duration: 900,
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(breathe, {
        toValue: 0.55,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    Animated.spring(ring, {
      toValue: 1,
      friction: 6,
      tension: 90,
      delay: 650,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [breathe, ring, variant]);

  const discScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.08] });
  const discOpacity = breathe.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.85, isGold ? 0.5 : 0.48] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.disc,
          isGold ? styles.discGold : styles.discGreen,
          { opacity: discOpacity, transform: [{ scale: discScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          isGold ? styles.ringGold : styles.ringGreen,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  discGreen: {
    backgroundColor: 'rgba(110, 231, 183, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  discGold: {
    backgroundColor: 'rgba(253, 224, 71, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
  },
  ring: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  ringGreen: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  ringGold: {
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
});
