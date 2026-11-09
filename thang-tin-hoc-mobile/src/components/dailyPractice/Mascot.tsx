import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, type ImageSourcePropType } from 'react-native';

export type MascotMood =
  | 'idle'
  | 'studying'
  | 'happy'
  | 'celebrate'
  | 'graduate'
  | 'done'
  | 'sad'
  | 'quit'
  | 'offline'
  | 'thinking'
  | 'idea'
  | 'determined'
  | 'determinedSoft'
  | 'energy'
  | 'sleepy'
  | 'connected';

const MOOD_SRC: Record<MascotMood, ImageSourcePropType> = {
  idle: require('../../../assets/mascot/cam-xuc-hoc-bai.gif'),
  studying: require('../../../assets/mascot/doc-sach.gif'),
  happy: require('../../../assets/mascot/cam-xuc-vui.gif'),
  celebrate: require('../../../assets/mascot/om-trai-tim-vui.gif'),
  graduate: require('../../../assets/mascot/tot-nghiep-vui-ve.gif'),
  done: require('../../../assets/mascot/hoan-thanh-checklish.gif'),
  sad: require('../../../assets/mascot/cam-xuc-buon.gif'),
  quit: require('../../../assets/mascot/cam-xuc-khoc.gif'),
  offline: require('../../../assets/mascot/Buon_Wifi.gif'),
  thinking: require('../../../assets/mascot/cam-xuc-suy-nghi.gif'),
  idea: require('../../../assets/mascot/y-tuong.gif'),
  determined: require('../../../assets/mascot/quyet-tam.gif'),
  determinedSoft: require('../../../assets/mascot/cam-xuc-quyet-tam.gif'),
  energy: require('../../../assets/mascot/nang-dong.gif'),
  sleepy: require('../../../assets/mascot/ngu-gat.gif'),
  connected: require('../../../assets/mascot/ket-noi-thanh-cong.gif'),
};

const BOUNCE_MOODS = new Set<MascotMood>(['happy', 'celebrate', 'graduate', 'done', 'energy']);
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Linh vật đồng hành luyện tập - hiển thị GIF động theo cảm xúc từng ngữ cảnh (đồng bộ Web App). */
export function Mascot({ mood = 'idle', size = 96 }: { mood?: MascotMood; size?: number }) {
  const key: MascotMood = mood && MOOD_SRC[mood] ? mood : 'idle';
  const source = MOOD_SRC[key];
  const bouncy = BOUNCE_MOODS.has(key);
  const sad = key === 'sad' || key === 'quit' || key === 'offline';
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(motion, {
        toValue: 1,
        duration: bouncy ? 450 : 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(motion, {
        toValue: 0,
        duration: bouncy ? 450 : 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bouncy, motion]);

  const translateY = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [0, bouncy ? -8 : sad ? 2 : -4],
  });

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ translateY }] }]}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Linh vật luyện tập"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
