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
  const height = compact ? 36 : 38;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.wrap,
        iconOnly && styles.wrapIconOnly,
        { height, minWidth: iconOnly ? 38 : compact ? 60 : 66 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Tìm kiếm bằng AI"
    >
      <View
        style={[
          styles.shell,
          { height, borderRadius: height / 2, paddingHorizontal: iconOnly ? 4 : 6 },
        ]}
      >
        <SearchAiIcon size={iconOnly ? 26 : 28} />
        {!iconOnly ? (
          <View style={styles.aiBlock}>
            <View style={styles.aiBadge}>
              <Svg width={30} height={24} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id={BADGE_GRAD} x1="0" y1="0" x2="30" y2="24" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#34D399" />
                    <Stop offset="1" stopColor="#059669" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="30" height="24" rx="8" fill={`url(#${BADGE_GRAD})`} />
              </Svg>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
            {!compact ? (
              <View style={styles.sparkles} pointerEvents="none">
                <AiSparklesDecor width={18} height={14} />
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
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  wrapIconOnly: {
    width: 38,
    minWidth: 38,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#34D399',
    backgroundColor: '#F4FBF9',
    overflow: 'hidden',
  },
  aiBlock: {
    position: 'relative',
    justifyContent: 'center',
    minWidth: 30,
    minHeight: 24,
  },
  aiBadge: {
    width: 30,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sparkles: {
    position: 'absolute',
    right: -10,
    top: -10,
  },
});