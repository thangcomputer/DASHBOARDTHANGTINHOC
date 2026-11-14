import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Star, Zap } from 'lucide-react-native';
import { ComboGlowEffect } from './ComboGlowEffect';
import { Mascot } from './Mascot';
import type { GameSound } from './useGameSounds';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const TIMING_MS: Record<number, number> = { 3: 2200, 5: 2800, 10: 2800 };

const COMBO_ART = {
  3: require('../../../assets/daily-practice/combo-x3.png'),
  5: require('../../../assets/daily-practice/combo-x5.png'),
} as const;

function MobileComboArtOverlay({
  tier,
  displayMs,
  play,
  onDone,
}: {
  tier: 3 | 5;
  displayMs: number;
  play: (sound: GameSound) => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const artMaxWidth = Math.min(width - 28, 380);
  const artMaxHeight = Math.min(height * 0.78, 560);

  const dim = useRef(new Animated.Value(0)).current;
  const art = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    play('lightning');
    dim.setValue(0);
    art.setValue(0);
    rootOpacity.setValue(1);

    Animated.timing(dim, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
    Animated.spring(art, {
      toValue: 1,
      friction: 5,
      tension: 130,
      delay: 80,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    const fadeAt = displayMs - 320;
    const fadeTimer = setTimeout(() => {
      Animated.timing(rootOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }, fadeAt);
    const closeTimer = setTimeout(() => onDone(), displayMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [art, dim, displayMs, onDone, play, tier]);

  const dimOpacity = dim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.44] });
  const artScale = art.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const artY = art.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent pointerEvents="none">
      <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
        <Animated.View style={[styles.dim, { opacity: dimOpacity }]} />
        <Animated.View
          style={[
            styles.artWrap,
            {
              maxWidth: artMaxWidth,
              maxHeight: artMaxHeight,
              transform: [{ scale: artScale }, { translateY: artY }],
              opacity: art,
            },
          ]}
        >
          <Image
            source={COMBO_ART[tier]}
            style={[styles.art, { maxWidth: artMaxWidth, maxHeight: artMaxHeight }]}
            resizeMode="contain"
            accessibilityLabel={tier === 3 ? 'Combo ba câu đúng liên tiếp' : 'Combo năm câu đúng liên tiếp'}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function MobileComboTenOverlay({
  displayMs,
  play,
  onDone,
}: {
  displayMs: number;
  play: (sound: GameSound) => void;
  onDone: () => void;
}) {
  const { width } = useWindowDimensions();
  const stageWidth = Math.min(width - 32, 400);
  const dim = useRef(new Animated.Value(0)).current;
  const mascot = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    play('lightning');
    Animated.timing(dim, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
    Animated.spring(mascot, {
      toValue: 1,
      friction: 5,
      tension: 140,
      delay: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    const fadeAt = displayMs - 320;
    const fadeTimer = setTimeout(() => {
      Animated.timing(rootOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }, fadeAt);
    const closeTimer = setTimeout(() => onDone(), displayMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [dim, displayMs, mascot, onDone, play]);

  const dimOpacity = dim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.44] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent pointerEvents="none">
      <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
        <Animated.View style={[styles.dim, { opacity: dimOpacity }]} />
        <View style={[styles.stage, { width: stageWidth }]}>
          <ComboGlowEffect variant="gold" />
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={22} color="#FDE047" fill="#FACC15" />
            ))}
          </View>
          <Mascot mood="combo10" size={100} />
          <View style={styles.ribbonGold}>
            <Animated.Text style={[styles.ribbonText, { opacity: mascot }]}>COMBO ×10</Animated.Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export function MobileComboCelebrationOverlay({
  combo = 3,
  bonusXp = 0,
  play,
  onDone,
}: {
  combo?: number;
  bonusXp?: number;
  play: (sound: GameSound) => void;
  onDone: () => void;
}) {
  const tier = [3, 5, 10].includes(combo) ? combo : 3;
  const displayMs = TIMING_MS[tier] || 2600;

  if (tier === 3 || tier === 5) {
    return (
      <MobileComboArtOverlay tier={tier} displayMs={displayMs} play={play} onDone={onDone} />
    );
  }

  return (
    <MobileComboTenOverlay displayMs={displayMs} play={play} onDone={onDone} />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
  },
  artWrap: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: '100%',
    height: '100%',
  },
  stage: {
    alignItems: 'center',
    zIndex: 2,
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ribbonGold: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FDE047',
  },
  ribbonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
});
