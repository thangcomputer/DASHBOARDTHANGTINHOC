import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from 'lucide-react-native';
import { AppHeader, AppScreen, EmptyState, ErrorState, LoadingSkeleton } from '../components/ui';
import { SOCKET_EVENTS } from '../services/socketService';
import { getCallHistory, type CallHistoryEntry } from '../services/callHistoryApi';
import { colors, radius, spacing, typography, theme, createThemedStyles } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

function getCallStatusLabel(call: CallHistoryEntry) {
  if (call.status === 'missed') return call.direction === 'incoming' ? 'Cuộc gọi nhỡ' : 'Không có người trả lời';
  if (call.status === 'rejected') return call.direction === 'incoming' ? 'Bạn đã từ chối' : 'Bị từ chối';
  if (call.status === 'busy') return 'Máy bận';
  if (call.status === 'cancelled') return call.direction === 'incoming' ? 'Cuộc gọi nhỡ' : 'Đã hủy';
  if (call.status === 'completed') return 'Đã kết thúc';
  if (call.status === 'failed') return 'Không kết nối được';
  return call.status === 'active' ? 'Đang trong cuộc gọi' : 'Đang gọi';
}

function getCallIcon(call: CallHistoryEntry) {
  if (call.status === 'missed' || call.status === 'busy') return PhoneMissed;
  if (call.status === 'rejected' || call.status === 'cancelled' || call.status === 'failed') return PhoneOff;
  return call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
}

function formatCallDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number) {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes} phút ${remainingSeconds} giây` : `${remainingSeconds} giây`;
}

export function CallHistoryScreen() {
  const navigation = useNavigation<Navigation>();
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setCalls(await getCallHistory());
    } catch (loadError) {
      console.error('Không thể tải lịch sử cuộc gọi.', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadHistory();
  }, [loadHistory]));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_HISTORY_UPDATED, () => {
      void loadHistory();
    });
    return () => subscription.remove();
  }, [loadHistory]);

  return (
    <AppScreen contentStyle={styles.screen}>
      <AppHeader title="Lịch sử cuộc gọi" icon={Phone} />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState onRetry={() => void loadHistory()} /> : null}
      {!loading && !error && !calls.length ? (
        <EmptyState title="Chưa có cuộc gọi" message="Cuộc gọi nhỡ, bị từ chối, máy bận và đã kết thúc sẽ xuất hiện tại đây." />
      ) : null}
      {!loading && !error && calls.length ? (
        <View style={styles.list}>
          {calls.map((call) => {
            const Icon = getCallIcon(call);
            const isMissed = call.status === 'missed' || call.status === 'busy';
            const name = call.participantName || (call.participantRole === 'teacher' ? 'Giảng viên' : 'Học viên');
            const details = [formatCallDate(call.startedAt), call.status === 'completed' ? formatDuration(call.durationSeconds) : '']
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={call.callId}
                onPress={() => navigation.navigate('Conversation', {
                  conversationId: call.conversationId,
                  conversationName: name,
                  participantId: call.participantId,
                  participantRole: call.participantRole,
                })}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${getCallStatusLabel(call)} với ${name}, ${details}`}
              >
                <View style={[styles.callIcon, isMissed && styles.callIconMissed]}>
                  <Icon size={19} color={isMissed ? colors.red : theme.brand} />
                </View>
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.name}>{name}</Text>
                  <Text numberOfLines={1} style={[styles.status, isMissed && styles.statusMissed]}>
                    {getCallStatusLabel(call)}
                  </Text>
                  <Text numberOfLines={1} style={styles.details}>{details}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  screen: { gap: spacing.md },
  list: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.canvas },
  callIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconMissed: { backgroundColor: colors.redSoft },
  copy: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  status: { color: colors.muted, fontSize: typography.caption, fontWeight: '600' },
  statusMissed: { color: colors.red },
  details: { color: colors.muted, fontSize: typography.caption },
}));
