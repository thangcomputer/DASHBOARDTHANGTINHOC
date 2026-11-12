import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { colors, typography } from '../theme/tokens';

interface KineticDotsLoaderProps {
  dots?: number;
  message?: string;
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export function KineticDotsLoader({
  dots = 4,
  message,
  size = 'medium',
  color = colors.brand, // #059669
}: KineticDotsLoaderProps) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const dotSize = isSmall ? 14 : isLarge ? 24 : 18;
  const colHeight = isSmall ? 52 : isLarge ? 88 : 68;
  const colWidth = isSmall ? 18 : isLarge ? 30 : 22;
  const jumpHeight = isSmall ? 22 : isLarge ? 40 : 30;

  // Tạo animated values cho từng dot
  const animations = useRef(
    Array.from({ length: dots }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animLoops = animations.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
    });

    animLoops.forEach((loop) => loop.start());

    return () => {
      animLoops.forEach((loop) => loop.stop());
    };
  }, [animations]);

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {animations.map((anim, index) => {
          // 1. Gravity Bounce (TranslateY)
          // 0% -> 0, 50% -> -jumpHeight, 100% -> 0
          const translateY = anim.interpolate({
            inputRange: [0, 0.45, 0.5, 0.55, 1],
            outputRange: [0, -jumpHeight * 0.95, -jumpHeight, -jumpHeight * 0.95, 0],
          });

          // 2. Rubber Morph (Squash on floor, stretch in air)
          const scaleX = anim.interpolate({
            inputRange: [0, 0.08, 0.18, 0.5, 0.85, 0.95, 1],
            outputRange: [1.35, 0.88, 1, 1, 0.9, 1.25, 1.35],
          });

          const scaleY = anim.interpolate({
            inputRange: [0, 0.08, 0.18, 0.5, 0.85, 0.95, 1],
            outputRange: [0.65, 1.15, 1, 1, 1.1, 0.75, 0.65],
          });

          // 3. Reflective Shadow
          const shadowScale = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1.3, 0.5, 1.3],
          });

          const shadowOpacity = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.6, 0.12, 0.6],
          });

          // 4. Ripple Expand (shockwave when hitting ground)
          const rippleScale = anim.interpolate({
            inputRange: [0, 0.25, 1],
            outputRange: [0.5, 1.5, 1.5],
          });

          const rippleOpacity = anim.interpolate({
            inputRange: [0, 0.08, 0.25, 1],
            outputRange: [0.8, 0.5, 0, 0],
          });

          return (
            <View
              key={index}
              style={[
                styles.col,
                { width: colWidth, height: colHeight },
              ]}
            >
              {/* Floor Ripple */}
              <Animated.View
                style={[
                  styles.ripple,
                  {
                    width: dotSize * 2,
                    height: dotSize * 0.6,
                    borderColor: 'rgba(16, 185, 129, 0.45)',
                    opacity: rippleOpacity,
                    transform: [{ scale: rippleScale }],
                  },
                ]}
              />

              {/* Floor Shadow */}
              <Animated.View
                style={[
                  styles.shadow,
                  {
                    width: dotSize * 1.1,
                    height: dotSize * 0.3,
                    backgroundColor: 'rgba(16, 185, 129, 0.45)',
                    opacity: shadowOpacity,
                    transform: [{ scale: shadowScale }],
                  },
                ]}
              />

              {/* Bouncing Liquid Ball */}
              <Animated.View
                style={[
                  styles.ballWrap,
                  {
                    width: dotSize,
                    height: dotSize,
                    transform: [{ translateY }, { scaleX }, { scaleY }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.ball,
                    {
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: color,
                      shadowColor: '#059669',
                      borderColor: '#34D399',
                    },
                  ]}
                >
                  {/* Liquid Specular Highlight */}
                  <View
                    style={[
                      styles.specular,
                      {
                        width: Math.max(3, dotSize * 0.28),
                        height: Math.max(3, dotSize * 0.28),
                        borderRadius: dotSize * 0.14,
                      },
                    ]}
                  />
                </View>
              </Animated.View>
            </View>
          );
        })}
      </View>

      {message ? (
        <Text style={[styles.message, isSmall && styles.messageSmall]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 14,
  },
  col: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ballWrap: {
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ball: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
  },
  specular: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  shadow: {
    position: 'absolute',
    bottom: -3,
    borderRadius: 999,
  },
  ripple: {
    position: 'absolute',
    bottom: -2,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  message: {
    marginTop: 14,
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  messageSmall: {
    marginTop: 8,
    fontSize: typography.micro,
  },
});
