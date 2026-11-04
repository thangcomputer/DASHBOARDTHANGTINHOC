export type VideoWatchTick = {
  seekTo: number | null;
  watchedSeconds: number;
  maxPosition: number;
  eligible: boolean;
};

export function createVideoWatchGuard(
  toleranceSeconds: number,
  initialWatchedSeconds = 0,
  initialMaxPosition = 0,
) {
  let maxPosition = Math.max(0, Number(initialMaxPosition) || 0);
  let watchedSeconds = Math.max(0, Number(initialWatchedSeconds) || 0);
  let previousPosition = maxPosition;

  return {
    tick(
      time: number,
      duration: number,
      playing: boolean,
      antiSeekEnabled: boolean,
      completed: boolean,
    ): VideoWatchTick {
      const position = Math.max(0, Number(time) || 0);
      const total = Math.max(0, Number(duration) || 0);
      if (completed) {
        previousPosition = position;
        return {
          seekTo: null,
          watchedSeconds,
          maxPosition,
          eligible: total > 0 && watchedSeconds / total >= 0.7,
        };
      }

      if (antiSeekEnabled && position > maxPosition + toleranceSeconds) {
        previousPosition = maxPosition;
        return { seekTo: maxPosition, watchedSeconds, maxPosition, eligible: false };
      }

      const elapsed = position - previousPosition;
      if (playing && elapsed > 0 && elapsed <= 2) watchedSeconds += elapsed;
      maxPosition = Math.max(maxPosition, position);
      previousPosition = position;

      return {
        seekTo: null,
        watchedSeconds,
        maxPosition,
        eligible: total > 0 && watchedSeconds / total >= 0.7,
      };
    },
  };
}
