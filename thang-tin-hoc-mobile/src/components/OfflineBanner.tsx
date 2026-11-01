/**
 * OfflineBanner.tsx
 * Hiển thị thanh thông báo khi mất kết nối mạng / server unreachable.
 * Đồng bộ với OfflineBanner.jsx trên web app.
 */
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      setIsOffline(!window.navigator.onLine);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.content}>
        <WifiOff size={16} color="#FFFBEB" />
        <Text style={styles.text}>
          Mất kết nối máy chủ — đang giữ phiên đăng nhập và tự thử lại…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999999,
    backgroundColor: '#B45309', // Amber / Gold tone from web
    paddingBottom: 8,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#FFFBEB',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
