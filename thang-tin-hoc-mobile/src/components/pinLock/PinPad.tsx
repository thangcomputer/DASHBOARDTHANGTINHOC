import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { colors, droplet } from '../../theme/tokens';
import { PIN_LENGTH } from '../../services/pinLock';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Nhập đủ PIN_LENGTH số là tự gọi onComplete. */
export function PinPad({
  onComplete,
  error = '',
  resetKey = 0,
  dark = false,
  disabled = false,
}: {
  onComplete: (pin: string) => void;
  error?: string;
  resetKey?: number;
  dark?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const shake = useRef(new Animated.Value(0)).current;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => { setValue(''); }, [resetKey]);

  useEffect(() => {
    if (!error) return;
    setValue('');
    Animated.sequence([
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, resetKey, shake]);

  const press = (key: string) => {
    if (disabled) return;
    if (key === 'del') {
      setValue((current) => current.slice(0, -1));
      return;
    }
    setValue((current) => {
      if (current.length >= PIN_LENGTH) return current;
      const next = `${current}${key}`;
      if (next.length === PIN_LENGTH) setTimeout(() => completeRef.current(next), 80);
      return next;
    });
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.dots, { transform: [{ translateX: shake }] }]}
        accessibilityLabel={`Đã nhập ${value.length} trên ${PIN_LENGTH} số`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              dark ? styles.dotDark : null,
              index < value.length ? styles.dotFilled : null,
            ]}
          />
        ))}
      </Animated.View>
      <Text style={[styles.error, !error && styles.errorHidden]} accessibilityLiveRegion="polite">
        {error || ' '}
      </Text>
      <View style={styles.grid}>
        {KEYS.map((key, index) => (key ? (
          <Pressable
            key={key}
            onPress={() => press(key)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={key === 'del' ? 'Xóa số vừa nhập' : `Số ${key}`}
            style={({ pressed }) => [
              styles.key,
              key === 'del' ? null : [styles.keyShadow, dark ? styles.keyDark : styles.keyLight],
              pressed && styles.keyPressed,
            ]}
          >
            {key === 'del'
              ? <Delete size={24} color={dark ? '#FFFFFF' : colors.ink} />
              : <Text style={[styles.keyText, dark && styles.keyTextDark]}>{key}</Text>}
          </Pressable>
        ) : <View key={`blank-${index}`} style={styles.keyBlank} />))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  dotDark: { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'transparent' },
  dotFilled: { borderColor: colors.brand, backgroundColor: colors.brand, transform: [{ scale: 1.1 }] },
  error: { minHeight: 20, color: '#EF4444', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorHidden: { color: 'transparent' },
  grid: { width: 3 * 68 + 2 * 14, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  key: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  keyShadow: { boxShadow: droplet.button },
  keyLight: { backgroundColor: '#F1F5F9' },
  keyDark: { backgroundColor: 'rgba(255,255,255,0.15)' },
  keyPressed: { transform: [{ scale: 0.94 }], opacity: 0.85 },
  keyBlank: { width: 68, height: 68 },
  keyText: { color: colors.ink, fontSize: 26, fontWeight: '700' },
  keyTextDark: { color: '#FFFFFF' },
});
