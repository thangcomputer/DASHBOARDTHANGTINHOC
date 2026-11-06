import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Cpu, Monitor } from 'lucide-react-native';
import { Mascot, type MascotMood } from './Mascot';

export function DropletMark({ size = 14, fill = '#EF4444' }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 24 28">
      <Path d="M12 2 C12 2 4 13 4 18 a8 8 0 0 0 16 0 C20 13 12 2 12 2 Z" fill={fill} stroke="rgba(255,255,255,0.9)" strokeWidth={1.2} />
      <Ellipse cx="9" cy="14" rx="2.5" ry="3.5" fill="rgba(255,255,255,0.6)" transform="rotate(-18 9 14)" />
    </Svg>
  );
}

export function StageDropletBadge({ index, locked, accentTo }: { index: number; locked: boolean; accentTo: string }) {
  if (locked) {
    return (
      <View style={styles.badgeLocked}>
        <DropletMark size={22} fill="#64748B" />
      </View>
    );
  }
  return (
    <View style={styles.badgeWrap}>
      <DropletMark size={44} fill={accentTo} />
      <Text style={styles.badgeNum}>{index}</Text>
    </View>
  );
}

export function PathITBackdrop({ accentSoft = '#EFF6FF' }: { accentSoft?: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: accentSoft }]} pointerEvents="none">
      <Monitor size={72} color="rgba(125,211,252,0.35)" strokeWidth={1.2} style={styles.iconMonitor} />
      <Cpu size={60} color="rgba(254,202,202,0.45)" strokeWidth={1.2} style={styles.iconCpu} />
    </View>
  );
}

export function PathMascotBuddy({ side, mood, size = 52 }: { side: 'left' | 'right'; mood: MascotMood; size?: number }) {
  return (
    <View style={[styles.mascotBuddy, side === 'left' ? { left: 0 } : { right: 0 }]} pointerEvents="none">
      <Mascot mood={mood} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  badgeWrap: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' },
  badgeNum: {
    position: 'absolute',
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(15,23,42,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeLocked: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#94A3B8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  backdrop: { borderRadius: 22, overflow: 'hidden', opacity: 0.92 },
  iconMonitor: { position: 'absolute', right: 4, top: '16%' as const },
  iconCpu: { position: 'absolute', left: 0, bottom: '14%' as const },
  mascotBuddy: { position: 'absolute', top: '25%' as const, zIndex: 2 },
});
