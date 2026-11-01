import type {
  CallDescription,
  CallIceCandidate,
  CallMediaStream,
  CallPeerConnection,
} from './callRtc.types';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export async function getCallAudioStream(): Promise<CallMediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt này không hỗ trợ gọi thoại. Hãy dùng HTTPS hoặc ứng dụng mobile.');
  }
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export function createCallPeerConnection(): CallPeerConnection {
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  return {
    get connectionState() {
      return peer.connectionState;
    },
    addLocalStream(stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track as MediaStreamTrack, stream as MediaStream));
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
      await peer.setRemoteDescription(description);
    },
    async addIceCandidate(candidate: CallIceCandidate) {
      await peer.addIceCandidate(candidate);
    },
    onIceCandidate(handler) {
      peer.addEventListener('icecandidate', (event) => {
        const candidate = event.candidate;
        handler(candidate ? {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        } : null);
      });
    },
    onRemoteStream(handler) {
      peer.addEventListener('track', (event) => {
        const remoteStream = event.streams[0];
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
