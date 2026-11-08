import React from 'react';
import { Text, View } from 'react-native';
import { typography } from '../theme/tokens';

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

export function VideoPlayerFrame({
}: {
  videoUrl: string;
  embeddedUrl: string;
  title: string;
  lessonId: string;
  antiSeekEnabled: boolean;
  done: boolean;
  onProgress: (progress: VideoPlayerProgress) => void;
  onWatched: () => Promise<boolean>;
  playerApiRef?: { current: VideoPlayerApi | null };
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' }}>
        Trình phát video chưa khả dụng trên thiết bị này.
      </Text>
    </View>
  );
}
