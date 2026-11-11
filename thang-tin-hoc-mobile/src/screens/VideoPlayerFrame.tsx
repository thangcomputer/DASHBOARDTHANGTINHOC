/**
 * Shared types — implementation: VideoPlayerFrame.native.tsx (iOS/Android), VideoPlayerFrame.web.tsx (web).
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
