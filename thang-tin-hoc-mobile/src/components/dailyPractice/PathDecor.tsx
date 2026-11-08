import React, { useId } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { Cpu, Monitor } from 'lucide-react-native';
import { Mascot, type MascotMood } from './Mascot';

const STAGE_BUDDIES_ASSETS: Array<[ImageSourcePropType, ImageSourcePropType]> = [
  [require('../../../assets/stage-buddies/buddy-0-color.webp'), require('../../../assets/stage-buddies/buddy-0-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-1-color.webp'), require('../../../assets/stage-buddies/buddy-1-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-2-color.webp'), require('../../../assets/stage-buddies/buddy-2-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-3-color.webp'), require('../../../assets/stage-buddies/buddy-3-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-4-color.webp'), require('../../../assets/stage-buddies/buddy-4-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-5-color.webp'), require('../../../assets/stage-buddies/buddy-5-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-6-color.webp'), require('../../../assets/stage-buddies/buddy-6-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-7-color.webp'), require('../../../assets/stage-buddies/buddy-7-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-8-color.webp'), require('../../../assets/stage-buddies/buddy-8-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-9-color.webp'), require('../../../assets/stage-buddies/buddy-9-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-10-color.webp'), require('../../../assets/stage-buddies/buddy-10-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-11-color.webp'), require('../../../assets/stage-buddies/buddy-11-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-12-color.webp'), require('../../../assets/stage-buddies/buddy-12-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-13-color.webp'), require('../../../assets/stage-buddies/buddy-13-dark.webp')],
  [require('../../../assets/stage-buddies/buddy-14-color.webp'), require('../../../assets/stage-buddies/buddy-14-dark.webp')],
];

export function getStageBuddies(unitIndex: number, unlocked: boolean): [ImageSourcePropType, ImageSourcePropType] {
  const pick = (slot: number) => {
    const pair = STAGE_BUDDIES_ASSETS[slot % STAGE_BUDDIES_ASSETS.length];
    return unlocked ? pair[0] : pair[1];
  };
  return [pick(unitIndex * 2), pick(unitIndex * 2 + 1)];
}

export function StageBuddiesOverlay({ unitIndex, unlocked }: { unitIndex: number; unlocked: boolean }) {
  const [buddyLeft, buddyRight] = getStageBuddies(unitIndex, unlocked);
  return (
    <>
      <View
        style={[
          styles.stageBuddyLeft,
          { opacity: unlocked ? 1 : 0.72, transform: [{ rotate: '-5deg' }] },
        ]}
        pointerEvents="none"
      >
        <Image source={buddyLeft} style={styles.stageBuddyImg} resizeMode="contain" />
      </View>
      <View
        style={[
          styles.stageBuddyRight,
          { opacity: unlocked ? 1 : 0.72, transform: [{ rotate: '5deg' }] },
        ]}
        pointerEvents="none"
      >
        <Image source={buddyRight} style={styles.stageBuddyImg} resizeMode="contain" />
      </View>
    </>
  );
}

/** Hai giọt nước nhỏ nối giữa 2 nút liên tiếp trên đường uốn lượn (đồng bộ Web PathSnakeConnector). */
export function PathSnakeConnector({
  fromX,
  toX,
  active,
  color,
}: {
  fromX: number;
  toX: number;
  active: boolean;
  color: { from: string; to: string };
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const dx = fromX - toX;
  const dy = 26;
  const angle = Math.max(-28, Math.min(28, (-Math.atan2(dx, dy) * 180) / Math.PI * 0.55));
  const drops = [
    { t: 0.34, w: 12, h: 16 },
    { t: 0.7, w: 15, h: 20 },
  ];

  return (
    <View style={styles.snakeConnector} pointerEvents="none">
      {drops.map(({ t, w, h }, idx) => (
        <View
          key={t}
          style={{
            position: 'absolute',
            left: dx * (1 - t) - w / 2,
            top: 2 + t * dy - h / 2,
            transform: [{ rotate: `${angle}deg` }],
            opacity: active ? 0.96 : 0.78,
          }}
        >
          <Svg width={w} height={h} viewBox="0 0 24 30">
            <Defs>
              <LinearGradient id={`drop-${gid}-${idx}`} x1="30%" y1="10%" x2="75%" y2="95%">
                <Stop offset="0%" stopColor={active ? '#FFFFFF' : '#E2E8F0'} stopOpacity={active ? '0.9' : '1'} />
                <Stop offset="35%" stopColor={active ? color.from : '#CBD5E1'} />
                <Stop offset="100%" stopColor={active ? color.to : '#94A3B8'} />
              </LinearGradient>
            </Defs>
            <Path
              d="M12 1.8 C12 1.8 3 13 3 19.2 a9 9 0 0 0 18 0 C21 13 12 1.8 12 1.8 Z"
              fill={`url(#drop-${gid}-${idx})`}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.4"
            />
            <Ellipse cx="9" cy="15.5" rx="2.3" ry="3.8" fill="rgba(255,255,255,0.65)" transform="rotate(-18 9 15.5)" />
          </Svg>
        </View>
      ))}
    </View>
  );
}

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
  stageBuddyLeft: {
    position: 'absolute',
    left: 6,
    top: '28%' as const,
    zIndex: 0,
  },
  stageBuddyRight: {
    position: 'absolute',
    right: 6,
    top: '56%' as const,
    zIndex: 0,
  },
  stageBuddyImg: {
    width: 78,
    height: 78,
  },
  snakeConnector: {
    position: 'absolute',
    top: -26,
    left: '50%' as const,
    width: 0,
    height: 0,
  },
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
