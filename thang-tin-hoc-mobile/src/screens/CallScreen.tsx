import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CallAudio } from '../components/CallAudio';
import { CallRingback } from '../components/CallRingback';
import { useAuth } from '../app/AuthContext';
import { spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import { createCallPeerConnection, getCallAudioStream } from '../services/callRtc';
import type { CallDescription, CallIceCandidate, CallMediaStream, CallPeerConnection } from '../services/callRtc.types';
import { emit, SOCKET_EVENTS, waitForConnection } from '../services/socketService';
import { setAudioModeAsync } from 'expo-audio';

type CallRoute = RouteProp<AppStackParamList, 'Call'>;
type CallPayload = {
  callId?: string;
  conversationId?: string;
  description?: CallDescription;
  candidate?: CallIceCandidate;
  code?: string;
  reason?: string;
};

function getCallErrorMessage(code?: string) {
  if (code === 'USER_BUSY') return 'Máy bận - người này đang trong một cuộc gọi khác.';
  if (code === 'CALL_RATE_LIMITED') return 'Bạn đã gọi quá nhiều lần. Vui lòng thử lại sau.';
  if (code === 'CALL_NOT_ALLOWED') return 'Bạn không có quyền gọi trong cuộc trò chuyện này.';
  if (code === 'CALL_NOT_AVAILABLE') return 'Cuộc gọi không còn khả dụng.';
  if (code === 'USER_OFFLINE') return 'Người nhận hiện chưa có online.';
  if (code === 'CALL_REJECTED_BY_RECIPIENT') return 'Không thể gọi được vì người nhận đã từ chối cuộc gọi.';
  if (code === 'CALL_DELIVERY_FAILED') return 'Không thể gửi thông báo cuộc gọi đến người nhận.';
  return 'Không thể kết nối cuộc gọi. Vui lòng kiểm tra micro và kết nối mạng.';
}

export function CallScreen() {
  const route = useRoute<CallRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { callId, conversationId, conversationName, participantName, direction } = route.params;
  const [status, setStatus] = useState(direction === 'outgoing' ? 'Đang kiểm tra kết nối người nhận…' : 'Đang kết nối…');
  const [errorMessage, setErrorMessage] = useState('');
  const [muted, setMuted] = useState(false);
  const [checkingRecipient, setCheckingRecipient] = useState(false);
  const [ringbackActive, setRingbackActive] = useState(direction === 'outgoing');
  const [remoteStream, setRemoteStream] = useState<CallMediaStream | null>(null);
  const peerRef = useRef<CallPeerConnection | null>(null);
  const localStreamRef = useRef<CallMediaStream | null>(null);
  const remoteDescriptionReady = useRef(false);
  const pendingCandidates = useRef<CallIceCandidate[]>([]);
  const offerStarted = useRef(false);
  const finished = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matchesCall = useCallback((payload: CallPayload) => (
    payload.callId === callId && payload.conversationId === conversationId
  ), [callId, conversationId]);

  const scheduleClose = useCallback((delay = 1000) => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null;
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MainTabs', { screen: 'Messages' });
    }, delay);
  }, [navigation]);

  const closeMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const endCall = useCallback((notifyPeer = true) => {
    if (finished.current) return;
    finished.current = true;
    setRingbackActive(false);
    if (notifyPeer) emit('call:end', { callId, conversationId });
    closeMedia();
    setStatus('Cuộc gọi đã kết thúc');
  }, [callId, closeMedia, conversationId]);

  useEffect(() => {
    let active = true;

    const handleFailure = (message: string) => {
      if (!active) return;
      if (finished.current) return;
      finished.current = true;
      setRingbackActive(false);
      emit('call:end', { callId, conversationId });
      closeMedia();
      setErrorMessage(message);
      setStatus('Cuộc gọi đã kết thúc');
      scheduleClose(1400);
    };

    const startOffer = async () => {
      const peer = peerRef.current;
      if (!peer || offerStarted.current || finished.current) return;
      offerStarted.current = true;
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        emit('call:offer', { callId, conversationId, description: offer });
        setStatus('Đang kết nối…');
      } catch {
        handleFailure('Không thể bắt đầu cuộc gọi. Vui lòng thử lại.');
      }
    };

    const addRemoteCandidate = async (candidate: CallIceCandidate) => {
      const peer = peerRef.current;
      if (!peer) return;
      if (!remoteDescriptionReady.current) {
        pendingCandidates.current.push(candidate);
        return;
      }
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        handleFailure('Kết nối mạng cuộc gọi bị gián đoạn.');
      }
    };

    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_ACCEPTED, (event: CallPayload) => {
        if (matchesCall(event) && direction === 'outgoing') {
          setRingbackActive(false);
          void startOffer();
        }
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_RINGING, (event: CallPayload) => {
        if (matchesCall(event) && direction === 'outgoing') {
          setCheckingRecipient(false);
          setStatus('Đang đổ chuông…');
        }
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_CHECKING, (event: CallPayload) => {
        if (matchesCall(event) && direction === 'outgoing') {
          setCheckingRecipient(true);
          setStatus('Đang kiểm tra kết nối người nhận…');
        }
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_REJECTED, (event: CallPayload) => {
        if (!matchesCall(event) || finished.current) return;
        finished.current = true;
        setRingbackActive(false);
        closeMedia();
        setStatus('Cuộc gọi bị từ chối');
        scheduleClose(900);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_TIMEOUT, (event: CallPayload) => {
        if (!matchesCall(event) || finished.current) return;
        finished.current = true;
        setRingbackActive(false);
        closeMedia();
        setStatus('Không có người trả lời');
        scheduleClose(900);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_ENDED, (event: CallPayload) => {
        if (!matchesCall(event) || finished.current) return;
        finished.current = true;
        setRingbackActive(false);
        closeMedia();
        setStatus(event.reason === 'disconnected' ? 'Cuộc gọi bị ngắt kết nối' : 'Cuộc gọi đã kết thúc');
        scheduleClose(900);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_ERROR, (event: CallPayload) => {
        if (!matchesCall(event)) return;
        handleFailure(getCallErrorMessage(event.code));
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.DISCONNECTED, () => {
        handleFailure('Mất kết nối với máy chủ. Hãy gọi lại khi có mạng.');
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_OFFER, async (event: CallPayload) => {
        if (!matchesCall(event) || !event.description) return;
        const peer = peerRef.current;
        if (!peer || direction !== 'incoming') return;
        try {
          await peer.setRemoteDescription(event.description);
          remoteDescriptionReady.current = true;
          for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          emit('call:answer', { callId, conversationId, description: answer });
          setStatus('Đang kết nối…');
        } catch {
          handleFailure('Không thể nhận lời gọi. Vui lòng thử lại.');
        }
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_ANSWER, async (event: CallPayload) => {
        if (!matchesCall(event) || !event.description) return;
        const peer = peerRef.current;
        if (!peer || direction !== 'outgoing') return;
        try {
          await peer.setRemoteDescription(event.description);
          remoteDescriptionReady.current = true;
          for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate);
        } catch {
          handleFailure('Không thể hoàn tất kết nối cuộc gọi.');
        }
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_ICE, (event: CallPayload) => {
        if (matchesCall(event) && event.candidate) void addRemoteCandidate(event.candidate);
      }),
    ];

    const initialize = async () => {
      try {
        await waitForConnection();
        if (!active || finished.current) return;
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: 'mixWithOthers',
        });
        const stream = await getCallAudioStream();
        if (!active || finished.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        const peer = createCallPeerConnection();
        peerRef.current = peer;
        peer.addLocalStream(stream);
        peer.onIceCandidate((candidate) => {
          if (candidate && !finished.current) emit('call:ice', { callId, conversationId, candidate });
        });
        peer.onRemoteStream((remote) => {
          if (active) setRemoteStream(remote);
        });
        peer.onConnectionStateChange((connectionState) => {
          if (connectionState === 'connected') {
            setRingbackActive(false);
            setStatus('Đang trong cuộc gọi');
          }
          if (connectionState === 'failed') handleFailure('Không thể kết nối hai thiết bị qua mạng hiện tại.');
          if (connectionState === 'disconnected') setStatus('Đang khôi phục kết nối…');
        });

        if (direction === 'outgoing') {
          if (!emit('call:invite', { callId, conversationId, callType: 'audio', participantName })) {
            handleFailure('Mất kết nối máy chủ. Vui lòng gọi lại.');
            return;
          }
        } else {
          emit('call:accept', { callId, conversationId });
          setStatus('Đã nhận cuộc gọi, đang kết nối…');
        }
      } catch (error) {
        handleFailure(error instanceof Error ? error.message : 'Không thể truy cập micro.');
      }
    };

    void initialize();
    return () => {
      active = false;
      if (exitTimer.current) clearTimeout(exitTimer.current);
      if (!finished.current) emit('call:end', { callId, conversationId });
      finished.current = true;
      subscriptions.forEach((subscription) => subscription.remove());
      closeMedia();
    };
  }, [callId, closeMedia, conversationId, direction, matchesCall, participantName, scheduleClose]);

  const toggleMute = () => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  return (
    <View style={styles.screen}>
      <CallRingback active={ringbackActive && direction === 'outgoing' && !finished.current} />
      <CallAudio stream={remoteStream} />
      <View style={styles.callCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{participantName.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{participantName}</Text>
        <Text style={styles.conversation}>{conversationName}</Text>
        <Text style={styles.status}>{errorMessage || status}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={toggleMute}
          style={[styles.action, muted && styles.actionMuted]}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Bật micro' : 'Tắt micro'}
        >
          {muted ? <MicOff size={23} color="#FFFFFF" /> : <Mic size={23} color="#FFFFFF" />}
          <Text style={styles.actionLabel}>{muted ? 'Bật mic' : 'Tắt mic'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            endCall();
            navigation.goBack();
          }}
          style={styles.endAction}
          accessibilityRole="button"
          accessibilityLabel="Kết thúc cuộc gọi"
        >
          <PhoneOff size={25} color="#FFFFFF" />
          <Text style={styles.actionLabel}>Kết thúc</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  callCard: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  avatarText: { color: '#FFFFFF', fontSize: 42, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: typography.title, fontWeight: '700', textAlign: 'center' },
  conversation: { color: '#CBD5E1', fontSize: typography.body, marginTop: spacing.xs, textAlign: 'center' },
  status: { color: '#BFDBFE', fontSize: typography.body, marginTop: spacing.lg, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 42, paddingBottom: spacing.xl },
  action: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionMuted: { backgroundColor: '#475569' },
  endAction: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '600' },
});
