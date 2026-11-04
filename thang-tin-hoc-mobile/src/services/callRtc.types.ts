export type CallDescription = {
  type: 'offer' | 'answer';
  sdp: string;
};

export type CallIceCandidate = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

export type CallMediaTrack = {
  enabled: boolean;
  stop: () => void;
};

export type CallMediaStream = {
  getTracks: () => CallMediaTrack[];
  getAudioTracks: () => CallMediaTrack[];
};

export type CallPeerConnection = {
  connectionState: string;
  addLocalStream: (stream: CallMediaStream) => void;
  createOffer: () => Promise<CallDescription>;
  createAnswer: () => Promise<CallDescription>;
  setLocalDescription: (description: CallDescription) => Promise<void>;
  setRemoteDescription: (description: CallDescription) => Promise<void>;
  addIceCandidate: (candidate: CallIceCandidate) => Promise<void>;
  onIceCandidate: (handler: (candidate: CallIceCandidate | null) => void) => void;
  onRemoteStream: (handler: (stream: CallMediaStream) => void) => void;
  onConnectionStateChange: (handler: (state: string) => void) => void;
  close: () => void;
};
