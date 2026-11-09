import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface TypingDotsProps {
  color?: string;
  size?: number;
}

export const TypingDots: React.FC<TypingDotsProps> = ({
  color = '#64748B',
  size = 5,
}) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnim = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 700 - delay - 350)),
        ])
      );
    };

    const a1 = createAnim(dot1, 0);
    const a2 = createAnim(dot2, 180);
    const a3 = createAnim(dot3, 360);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const renderDot = (anim: Animated.Value) => {
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -3],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    });
    return (
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderDot(dot1)}
      {renderDot(dot2)}
      {renderDot(dot3)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
  },
  dot: {
    marginHorizontal: 1,
  },
});

