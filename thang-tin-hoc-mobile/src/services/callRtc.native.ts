import type {
  MediaStream,
  RTCPeerConnection,
  RTCIceCandidate,
} from 'react-native-webrtc';
import type {
  CallDescription,
  CallIceCandidate,
  CallMediaStream,
  CallPeerConnection,
} from './callRtc.types';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
type WebRtcModule = typeof import('react-native-webrtc');
let webRtcModule: WebRtcModule | undefined;

function getWebRtcModule(): WebRtcModule {
  webRtcModule ??= require('react-native-webrtc') as WebRtcModule;
  return webRtcModule;
}

type NativePeerConnection = RTCPeerConnection & {
  addEventListener: (type: 'icecandidate' | 'track' | 'connectionstatechange', listener: (event: {
    candidate?: RTCIceCandidate | null;
    streams?: MediaStream[];
  }) => void) => void;
};

export async function getCallAudioStream(): Promise<CallMediaStream> {
  const { mediaDevices } = getWebRtcModule();
  return mediaDevices.getUserMedia({ audio: true, video: false });
}

export function createCallPeerConnection(): CallPeerConnection {
  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } = getWebRtcModule();
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS }) as NativePeerConnection;
  return {
    get connectionState() {
      return peer.connectionState;
    },
    addLocalStream(stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track as import('react-native-webrtc').MediaStreamTrack, stream as MediaStream));
    },
    async createOffer() {
      const description = await peer.createOffer();
      return { type: 'offer', sdp: String(description.sdp || '') };
    },
    async createAnswer() {
      const description = await peer.createAnswer();
      return { type: 'answer', sdp: String(description.sdp || '') };
    },
    async setLocalDescription(description: CallDescription) {
      await peer.setLocalDescription(description);
    },
    async setRemoteDescription(description: CallDescription) {
      await peer.setRemoteDescription(new RTCSessionDescription(description));
    },
    async addIceCandidate(candidate: CallIceCandidate) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    },
    onIceCandidate(handler) {
      peer.addEventListener('icecandidate', (event) => {
        handler(event.candidate?.toJSON() || null);
      });
    },
    onRemoteStream(handler) {
      peer.addEventListener('track', (event) => {
        const remoteStream = event.streams?.[0];
        if (remoteStream) handler(remoteStream);
      });
    },
    onConnectionStateChange(handler) {
      peer.addEventListener('connectionstatechange', () => handler(peer.connectionState));
    },
    close() {
      peer.close();
    },
  };
}
