import type React from 'react';

/**
 * Shared types & TypeScript barrel — runtime resolution uses VideoPlayerFrame.native.tsx (iOS/Android) or VideoPlayerFrame.web.tsx (web).
 */
export type VideoPlayerProgress = {
  currentTime: number;
  duration: number;
  watchedSeconds: number;
  completed: boolean;
  playing: boolean;
};

export type VideoPlayerApi = {
  getCurrentTime: () => number;
  getDuration: () => number;
  pause?: () => void;
  play?: () => void;
  seekTo?: (sec: number) => void;
};

export type VideoPlayerFrameProps = {
  videoUrl: string;
  embeddedUrl: string;
  title: string;
  lessonId: string;
  antiSeekEnabled: boolean;
  done: boolean;
  onProgress: (progress: VideoPlayerProgress) => void;
  onWatched: () => Promise<boolean>;
  playerApiRef?: { current: VideoPlayerApi | null };
  brandedChrome?: boolean;
  chromeRightSlot?: React.ReactNode;
  appearance?: 'default' | 'window';
  chromeBg?: string;
  initialAtSec?: number;
};

export function VideoPlayerFrame(_props: VideoPlayerFrameProps): React.ReactElement | null {
  return null;
}
