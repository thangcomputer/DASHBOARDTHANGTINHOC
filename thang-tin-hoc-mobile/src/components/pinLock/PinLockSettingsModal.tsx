import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, KeyRound, Lock, X } from 'lucide-react-native';
import { colors, droplet } from '../../theme/tokens';
import { DuoButton } from '../duo/DuoButton';
import { PinPad } from './PinPad';
import {
  PIN_DEFAULT_TIMEOUT,
  PIN_LOCK_NOW_EVENT,
  PIN_TIMEOUT_OPTIONS,
  readPinConfig,
  removePin,
  savePin,
  setPinTimeout,
  verifyPin,
  type PinConfig,
} from '../../services/pinLock';

type Step = 'overview' | 'create' | 'confirm' | 'verify-change' | 'verify-remove';

const STEP_TITLES: Record<Exclude<Step, 'overview'>, string> = {
  create: 'Nhập mã PIN mới gồm 6 số',
  confirm: 'Nhập lại mã PIN để xác nhận',
  'verify-change': 'Nhập mã PIN hiện tại',
  'verify-remove': 'Nhập mã PIN hiện tại để tắt khóa',
};

export function PinLockSettingsModal({
  userKey,
  onClose,
  isBrandStudent = false,
}: {
  userKey: string;
  onClose: () => void;
  isBrandStudent?: boolean;
}) {
  const [config, setConfig] = useState<PinConfig | null>(null);
  const [step, setStep] = useState<Step>('overview');
  const [draftPin, setDraftPin] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(PIN_DEFAULT_TIMEOUT);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void readPinConfig(userKey).then((current) => {
      setConfig(current);
      setTimeoutMinutes(current?.timeoutMinutes || PIN_DEFAULT_TIMEOUT);
    });
  }, [userKey]);

  const goStep = (next: Step) => {
    setStep(next);
    setError('');
    setResetKey((key) => key + 1);
  };

  const fail = (message: string) => {
    setError(message);
    setResetKey((key) => key + 1);
  };

  const handlePin = async (pin: string) => {
    if (step === 'create') {
      setDraftPin(pin);
      goStep('confirm');
      return;
    }
    if (step === 'confirm') {
      if (pin !== draftPin) {
        setDraftPin('');
        setStep('create');
        fail('Hai lần nhập không khớp. Vui lòng nhập lại mã PIN mới.');
        return;
      }
      await savePin(userKey, pin, timeoutMinutes);
      setNotice(config ? 'Đã đổi mã PIN.' : 'Đã bật khóa mã PIN.');
      setConfig(await readPinConfig(userKey));
      goStep('overview');
      return;
    }
    if (!(await verifyPin(userKey, pin))) {
      fail('Mã PIN không đúng.');
      return;
    }
    if (step === 'verify-change') {
      goStep('create');
      return;
    }
    if (step === 'verify-remove') {
      await removePin(userKey);
      setConfig(null);
      setNotice('Đã tắt khóa mã PIN.');
      goStep('overview');
    }
  };

  const changeTimeout = async (minutes: number) => {
    setTimeoutMinutes(minutes);
    if (!config) return;
    await setPinTimeout(userKey, minutes);
    setConfig(await readPinConfig(userKey));
    setNotice('Đã lưu thời gian tự khóa.');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <KeyRound size={20} color={isBrandStudent ? '#059669' : colors.brand} />
              <Text style={[styles.title, isBrandStudent && { color: '#059669' }]}>Khóa mã PIN</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {step === 'overview' ? (
              <>
                <Text style={styles.intro}>
                  Ứng dụng tự khóa khi bạn không thao tác trong thời gian đã chọn. Nhập đúng mã PIN 6 số là mở lại ngay. Mã PIN chỉ lưu trên thiết bị này.
                </Text>
                {notice ? (
                  <View style={styles.notice}>
                    <CheckCircle2 size={16} color="#047857" />
                    <Text style={styles.noticeText}>{notice}</Text>
                  </View>
                ) : null}
                <Text style={styles.label}>Tự khóa sau khi không thao tác</Text>
                <View style={styles.options}>
                  {PIN_TIMEOUT_OPTIONS.map((option) => {
                    const selected = timeoutMinutes === option.minutes;
                    return (
                      <Pressable
                        key={option.minutes}
                        onPress={() => { void changeTimeout(option.minutes); }}
                        style={[styles.option, selected && (isBrandStudent ? styles.optionActiveBrand : styles.optionActive)]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {config ? (
                  <View style={styles.actions}>
                    <DuoButton
                      variant="secondary"
                      size="md"
                      fullWidth
                      text="Đổi mã PIN"
                      onPress={() => goStep('verify-change')}
                    />
                    <DuoButton
                      variant="dark"
                      size="md"
                      fullWidth
                      text="Khóa ngay"
                      icon={<Lock size={15} color="#FFFFFF" />}
                      onPress={() => { onClose(); DeviceEventEmitter.emit(PIN_LOCK_NOW_EVENT); }}
                    />
                    <DuoButton
                      variant="danger"
                      size="md"
                      fullWidth
                      text="Tắt khóa"
                      onPress={() => goStep('verify-remove')}
                    />
                  </View>
                ) : (
                  <DuoButton
                    variant={isBrandStudent ? 'danger' : 'primary'}
                    size="lg"
                    fullWidth
                    text="Tạo mã PIN"
                    onPress={() => goStep('create')}
                  />
                )}
              </>
            ) : (
              <View style={styles.pinStep}>
                <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
                <PinPad onComplete={(pin) => { void handlePin(pin); }} error={error} resetKey={resetKey} />
                <DuoButton
                  variant="secondary"
                  size="md"
                  text="Quay lại"
                  onPress={() => goStep('overview')}
                  style={{ alignSelf: 'center', marginTop: 8 }}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.6)' },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  body: { paddingHorizontal: 18, paddingBottom: 20, gap: 14 },
  intro: { color: '#475569', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: { color: '#047857', fontSize: 14, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  optionActiveBrand: {
    borderColor: '#059669',
    backgroundColor: '#10B981',
  },
  optionText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  optionTextActive: { color: '#FFFFFF', fontWeight: '800' },
  actions: { gap: 10 },
  pinStep: { alignItems: 'center', gap: 12, paddingTop: 4 },
  stepTitle: { color: '#334155', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  back: { paddingVertical: 8, paddingHorizontal: 12 },
  backText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
});
