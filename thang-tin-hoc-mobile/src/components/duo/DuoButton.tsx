import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { themeState } from '../../theme/tokens';

export type DuoButtonVariant =
  | 'primary'   // Emerald / Lime green (Học tiếp, Bắt đầu)
  | 'secondary' // White with clean shadow (Để sau, Hủy)
  | 'accent'    // Orange (Luyện ngay, Streak)
  | 'gold'      // Gold / Yellow (XP, Rương báu, Mua)
  | 'blue'      // Blue (Meet, Video)
  | 'danger'    // Red (Thoát, Bỏ cuộc)
  | 'purple'    // Purple (Thử thách)
  | 'dark';     // Dark Slate (Khóa, Bảo mật)

export type DuoButtonSize = 'sm' | 'md' | 'lg';

interface DuoButtonProps {
  children?: React.ReactNode;
  text?: string;
  label?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: DuoButtonVariant;
  size?: DuoButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const VARIANTS: Record<
  DuoButtonVariant,
  { face: string; bevel: string; text: string; border?: string }
> = {
  primary: {
    face: '#10B981',
    bevel: '#047857',
    text: '#FFFFFF',
  },
  secondary: {
    face: '#FFFFFF',
    bevel: '#CBD5E1',
    text: '#1E293B',
    border: '#E2E8F0',
  },
  accent: {
    face: '#F97316',
    bevel: '#C2410C',
    text: '#FFFFFF',
  },
  gold: {
    face: '#F59E0B',
    bevel: '#B45309',
    text: '#FFFFFF',
  },
  blue: {
    face: '#3B82F6',
    bevel: '#1D4ED8',
    text: '#FFFFFF',
  },
  danger: {
    face: '#EF4444',
    bevel: '#B91C1C',
    text: '#FFFFFF',
  },
  purple: {
    face: '#8B5CF6',
    bevel: '#6D28D9',
    text: '#FFFFFF',
  },
  dark: {
    face: '#0F172A',
    bevel: '#020617',
    text: '#FFFFFF',
    border: '#1E293B',
  },
};

const SIZES: Record<
  DuoButtonSize,
  { minHeight: number; paddingHorizontal: number; fontSize: number; bevel: number; radius: number }
> = {
  sm: { minHeight: 38, paddingHorizontal: 12, fontSize: 13, bevel: 3, radius: 14 },
  md: { minHeight: 46, paddingHorizontal: 18, fontSize: 15, bevel: 4, radius: 16 },
  lg: { minHeight: 52, paddingHorizontal: 22, fontSize: 16, bevel: 4, radius: 18 },
};

export function DuoButton({
  children,
  text,
  label,
  icon,
  rightIcon,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
}: DuoButtonProps) {
  const [pressed, setPressed] = useState(false);
  const contentText = label || text;

  const sizeSpec = SIZES[size];
  // Học viên theo khóa: nút chính màu đỏ (đồng bộ web app).
  const variantSpec = VARIANTS[variant === 'primary' && themeState.brand ? 'danger' : variant];

  const isDisabled = disabled || loading;
  const isPressed = pressed && !isDisabled;

  const bevelHeight = sizeSpec.bevel;
  const bevelPressed = 1;
  const translateY = isPressed ? bevelHeight - bevelPressed : 0;

  const currentFace = isDisabled ? '#E2E8F0' : variantSpec.face;
  const currentBevel = isDisabled ? '#CBD5E1' : variantSpec.bevel;
  const currentText = isDisabled ? '#94A3B8' : variantSpec.text;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || contentText}
      style={[
        styles.buttonBase,
        {
          minHeight: sizeSpec.minHeight,
          paddingHorizontal: sizeSpec.paddingHorizontal,
          borderRadius: sizeSpec.radius,
          backgroundColor: currentFace,
          borderBottomColor: currentBevel,
          borderBottomWidth: isPressed ? bevelPressed : bevelHeight,
          transform: [{ translateY }],
          borderWidth: variantSpec.border && !isDisabled ? 1.5 : 0,
          borderColor: variantSpec.border && !isDisabled ? variantSpec.border : 'transparent',
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator color={currentText} size="small" style={styles.loader} />
        ) : (
          <>
            {icon ? <View style={styles.iconLeft}>{icon}</View> : null}
            {contentText ? (
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: sizeSpec.fontSize, color: currentText },
                  textStyle,
                ]}
              >
                {contentText}
              </Text>
            ) : null}
            {children}
            {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 1,
    maxWidth: '100%',
  },
  buttonText: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  iconLeft: {
    marginRight: 2,
  },
  iconRight: {
    marginLeft: 2,
  },
  loader: {
    marginVertical: 2,
  },
});
