import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AiSparklesDecor, SearchAiIcon } from './aiSearchArt';

const BADGE_GRAD = 'aiHdrBadgeGrad';

type Props = {
  onPress: () => void;
  compact?: boolean;
  iconOnly?: boolean;
};

export function AiSearchHeaderButton({ onPress, compact = false, iconOnly = false }: Props) {
  const height = 36;
  const width = iconOnly ? 36 : compact ? 60 : 64;
  const iconSize = iconOnly ? 26 : 27;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.wrap,
        { width, height },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Tìm & hỏi đáp bằng AI"
    >
      <View style={[styles.shell, { width, height, borderRadius: height / 2 }]}>
        <SearchAiIcon size={iconSize} />
        {!iconOnly ? (
          <View style={styles.aiBlock}>
            <View style={styles.aiBadge}>
              <Svg width={28} height={22} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id={BADGE_GRAD} x1="0" y1="0" x2="28" y2="22" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#00DDAA" />
                    <Stop offset="0.45" stopColor="#00BE94" />
                    <Stop offset="1" stopColor="#078F69" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="28" height="22" rx="7" fill={`url(#${BADGE_GRAD})`} />
              </Svg>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
            {!compact ? (
              <View style={styles.sparkles} pointerEvents="none">
                <AiSparklesDecor width={14} height={11} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 1,
    shadowColor: '#10B981',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: '#09B981',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  aiBlock: {
    position: 'relative',
    justifyContent: 'center',
    width: 28,
    height: 22,
  },
  aiBadge: {
    width: 28,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#009664',
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sparkles: {
    position: 'absolute',
    right: -2,
    top: -4,
  },
});