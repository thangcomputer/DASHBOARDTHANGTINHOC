import React, { useEffect, useRef } from 'react';
import { createElement } from 'react';
import type { CallMediaStream } from '../services/callRtc.types';

export function CallAudio({ stream }: { stream: CallMediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!audioRef.current || !stream) return;
    audioRef.current.srcObject = stream as MediaStream;
    void audioRef.current.play().catch((error: unknown) => {
      console.warn('Không thể tự phát âm thanh cuộc gọi:', error);
    });
  }, [stream]);

  return createElement('audio', { ref: audioRef, autoPlay: true, playsInline: true, style: { display: 'none' } });
}
