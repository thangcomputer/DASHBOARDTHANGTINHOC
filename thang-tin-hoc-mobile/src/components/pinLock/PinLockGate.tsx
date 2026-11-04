import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, LogOut } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { PinPad } from './PinPad';
import {
  PIN_CHANGED_EVENT,
  PIN_LOCK_NOW_EVENT,
  PIN_MAX_ATTEMPTS,
  clearLastActive,
  getMemoryActiveAt,
  isIdleExpired,
  isLockedFlag,
  markActive,
  readLastActive,
  readPinConfig,
  removePin,
  setLockedFlag,
  setPinActivityUser,
  verifyPin,
  type PinConfig,
} from '../../services/pinLock';

const CHECK_MS = 5000;

export function PinLockGate({
  userKey,
  userName = '',
  onSignOut,
}: {
  userKey: string;
  userName?: string;
  onSignOut: () => void;
}) {
  const [config, setConfig] = useState<PinConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const configRef = useRef<PinConfig | null>(null);
  const lockedRef = useRef(false);
  configRef.current = config;
  lockedRef.current = locked;

  const lock = useCallback(async () => {
    if (!configRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    setError('');
    setAttempts(0);
    setResetKey((key) => key + 1);
    await setLockedFlag(userKey, true);
  }, [userKey]);

  const checkIdle = useCallback(async () => {
    const current = configRef.current;
    if (!current || lockedRef.current) return;
    const lastActive = Math.max(await readLastActive(userKey), getMemoryActiveAt());
    if (isIdleExpired(lastActive, current.timeoutMinutes)) await lock();
  }, [lock, userKey]);

  useEffect(() => {
    let active = true;
    setPinActivityUser(userKey);
    setLocked(false);
    void (async () => {
      const current = await readPinConfig(userKey);
      if (!active) return;
      configRef.current = current;
      setConfig(current);
      const lastActive = await readLastActive(userKey);
      if (!lastActive) await markActive(userKey);
      if (current && ((await isLockedFlag(userKey)) || isIdleExpired(lastActive, current.timeoutMinutes))) {
        if (active) await lock();
      }
    })();
    return () => { active = false; };
  }, [lock, userKey]);

  useEffect(() => {
    const changed = DeviceEventEmitter.addListener(PIN_CHANGED_EVENT, (key: string) => {
      if (key !== userKey) return;
      void readPinConfig(userKey).then((current) => {
        configRef.current = current;
        setConfig(current);
        if (!current) setLocked(false);
      });
    });
    const lockNow = DeviceEventEmitter.addListener(PIN_LOCK_NOW_EVENT, () => { void lock(); });
    return () => {
      changed.remove();
      lockNow.remove();
    };
  }, [lock, userKey]);

  useEffect(() => {
    if (!config) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkIdle();
      } else if (!lockedRef.current && getMemoryActiveAt()) {
        void markActive(userKey, getMemoryActiveAt());
      }
    });
    const timer = setInterval(() => { void checkIdle(); }, CHECK_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [checkIdle, config, userKey]);

  const signOut = async () => {
    await removePin(userKey).catch(() => {});
    await clearLastActive(userKey).catch(() => {});
    setLocked(false);
    onSignOut();
  };

  const handleComplete = async (pin: string) => {
    if (await verifyPin(userKey, pin)) {
      await setLockedFlag(userKey, false);
      await markActive(userKey);
      setLocked(false);
      setError('');
      setAttempts(0);
      return;
    }
    const used = attempts + 1;
    setAttempts(used);
    setResetKey((key) => key + 1);
    if (used >= PIN_MAX_ATTEMPTS) {
      await signOut();
      return;
    }
    setError(`Mã PIN không đúng. Còn ${PIN_MAX_ATTEMPTS - used} lần thử.`);
  };

  if (!config || !locked) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={styles.screen} accessibilityViewIsModal>
        <View style={styles.card}>
          <View style={styles.icon}>
            <LockKeyhole size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Ứng dụng đã khóa</Text>
          <Text style={styles.subtitle}>
            {userName ? `${userName}, nhập mã PIN để mở khóa` : 'Nhập mã PIN để mở khóa'}
          </Text>
          <PinPad onComplete={(pin) => { void handleComplete(pin); }} error={error} resetKey={resetKey} dark />
          <View style={styles.forgot}>
            <Text style={styles.forgotText}>Quên mã PIN?</Text>
            <Pressable
              onPress={() => { void signOut(); }}
              style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
              accessibilityRole="button"
              accessibilityLabel="Quên mã PIN, đăng xuất để đăng nhập lại"
            >
              <LogOut size={15} color="#E2E8F0" />
              <Text style={styles.signOutText}>Đăng xuất để đăng nhập lại</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#0B1220' },
  card: { width: '100%', maxWidth: 380, alignItems: 'center', gap: 10 },
  icon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, boxShadow: '0px 8px 24px rgba(220, 38, 38, 0.45)' },
  title: { marginTop: 6, color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subtitle: { marginBottom: 8, color: '#CBD5E1', fontSize: 14, textAlign: 'center' },
  forgot: { width: '100%', alignItems: 'center', gap: 10, marginTop: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  forgotText: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  signOutPressed: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)' },
  signOutText: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
});
