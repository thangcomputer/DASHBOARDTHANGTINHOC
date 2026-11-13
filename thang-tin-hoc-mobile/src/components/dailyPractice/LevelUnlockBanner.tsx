import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockOpen, Sparkles, Unlock } from 'lucide-react-native';
import { Mascot } from './Mascot';

type Unit = { id?: string; index?: number; title?: string };

export function LevelUnlockBanner({
  unit,
}: {
  unit: Unit | null;
}) {
  if (!unit) return null;
  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <LockOpen size={22} color="#FFFFFF" strokeWidth={2.5} />
        <Sparkles size={12} color="#FCD34D" style={styles.sparkle} />
      </View>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Unlock size={11} color="#047857" />
          <Text style={styles.badgeText}>Mở khóa chặng mới</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {unit.index ? `Chặng ${unit.index}: ` : ''}
          {unit.title || 'Chặng tiếp theo đã sẵn sàng!'}
        </Text>
        <Text style={styles.sub}>Đường dẫn tới chặng mới đã bừng sáng — tiếp tục chinh phục nhé!</Text>
      </View>
      <Mascot mood="celebrate" size={52} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
    marginBottom: 10,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  body: { flex: 1, minWidth: 0 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    textTransform: 'uppercase',
  },
  title: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sub: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#047857' },
});
