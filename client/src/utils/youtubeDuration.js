/**
 * YouTube helpers — duration probe for Admin Course Builder + LMS.
 */

export function extractYouTubeId(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').slice(0, 11);
    }
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const embed = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
    if (embed) return embed[1];
  } catch { /* not a URL */ }
  const m = raw.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : '';
}

/** Live YouTube player duration (seconds), 0 if unavailable. */
export function readYouTubeDuration(player) {
  try {
    const d = Number(player?.getDuration?.());
    return Number.isFinite(d) && d > 0 ? Math.floor(d) : 0;
  } catch {
    return 0;
  }
}

/** Playback position clamped to duration — avoids 1:38:38 / 1:38:35 mismatch in UI. */
export function readYouTubeCurrentTime(player, durationHint = 0) {
  try {
    const t = Number(player?.getCurrentTime?.());
    const raw = Number.isFinite(t) && t >= 0 ? t : 0;
    const dur = readYouTubeDuration(player) || Math.max(0, Number(durationHint) || 0);
    if (dur > 0) return Math.min(raw, dur);
    return raw;
  } catch {
    return 0;
  }
}

/** Prefer max(stored, live YT) — duration can shift slightly after load/end. */
export function resolveYouTubeDisplayDuration(storedDuration, player) {
  const stored = Math.max(0, Math.floor(Number(storedDuration) || 0));
  const live = readYouTubeDuration(player);
  return Math.max(stored, live);
}

/** Đồng bộ duration + currentTime cho UI — tránh current > total trên thanh player. */
export function syncYouTubePlaybackState(player, storedDuration = 0) {
  const liveDur = readYouTubeDuration(player);
  let rawTime = 0;
  try {
    const t = Number(player?.getCurrentTime?.());
    rawTime = Number.isFinite(t) && t >= 0 ? t : 0;
  } catch {
    rawTime = 0;
  }
  const stored = Math.max(0, Math.floor(Number(storedDuration) || 0));
  const duration = Math.max(stored, liveDur, Math.ceil(rawTime));
  const currentTime = duration > 0 ? Math.min(rawTime, duration) : rawTime;
  return { duration, currentTime, rawTime };
}

export function ensureYouTubeApi() {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { if (typeof prev === 'function') prev(); } catch { /* ignore */ }
      resolve(window.YT);
    };
    if (!document.getElementById('yt-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
}

/**
 * Probe real YouTube duration (seconds) via IFrame API.
 * Returns 0 if unavailable / invalid.
 */
export function probeYouTubeDurationSeconds(urlOrId, { timeoutMs = 12000 } = {}) {
  const videoId = extractYouTubeId(urlOrId);
  if (!videoId || typeof document === 'undefined') {
    return Promise.resolve(0);
  }

  return new Promise((resolve) => {
    let settled = false;
    let player = null;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(host);

    const finish = (secs) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { player?.destroy?.(); } catch { /* ignore */ }
      try { host.remove(); } catch { /* ignore */ }
      resolve(Math.max(0, Math.floor(Number(secs) || 0)));
    };

    const timer = setTimeout(() => finish(0), timeoutMs);

    ensureYouTubeApi().then((YT) => {
      if (settled || !YT?.Player) {
        finish(0);
        return;
      }
      try {
        player = new YT.Player(host, {
          videoId,
          width: 1,
          height: 1,
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              try {
                const dur = Number(event.target.getDuration?.()) || 0;
                finish(dur);
              } catch {
                finish(0);
              }
            },
            onError: () => finish(0),
          },
        });
      } catch {
        finish(0);
      }
    }).catch(() => finish(0));
  });
}
