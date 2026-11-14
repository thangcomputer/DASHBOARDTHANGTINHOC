export const SOUND_MUTE_STORAGE_KEY = 'thvp_muted';
export const SOUND_MUTE_CHANGED_EVENT = 'thvp-sound-muted-changed';

const readInitialMuted = () => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const saved = localStorage.getItem(SOUND_MUTE_STORAGE_KEY);
    // Mặc định bật âm thanh trừ khi người dùng tự tắt
    if (saved === null) return false;
    return saved === 'true';
  } catch {
    return false;
  }
};

let muted = readInitialMuted();

/** Chỉ tạo AudioContext sau gesture người dùng (tránh cảnh báo autoplay Chrome) */
let audioCtx = null;

export const isSoundMuted = () => muted;

export const setSoundMuted = (val) => {
  muted = Boolean(val);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SOUND_MUTE_STORAGE_KEY, muted ? 'true' : 'false');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SOUND_MUTE_CHANGED_EVENT, { detail: { muted } }));
    }
  } catch {
    /* ignore storage error */
  }
};

export const toggleSoundMuted = () => {
  const next = !muted;
  setSoundMuted(next);
  if (!next) {
    unlockAudio();
  }
  return next;
};

/** Gọi sau click/touch đầu tiên để bật được âm thanh (Chrome/Safari autoplay policy) */
export const unlockAudio = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      return;
    }
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
  } catch {
    /* noop */
  }
};

let lastMessageSoundAt = 0;
let lastNotifySoundAt = 0;

/** Cùng file với app mobile (thang-tin-hoc-mobile/src/assets/audio). */
export const MESSAGE_SOUND_URL = '/audio/message.wav';
export const NOTIFICATION_SOUND_URL = '/audio/notification.wav';

const alertPlayers = new Map();

const playAlertFile = (url, volume) => {
  if (muted || typeof window === 'undefined' || typeof window.Audio !== 'function') return;
  let player = alertPlayers.get(url);
  if (!player) {
    player = new window.Audio(url);
    player.preload = 'auto';
    alertPlayers.set(url, player);
  }
  player.volume = volume;
  try {
    player.currentTime = 0;
  } catch { /* not loaded yet */ }
  const playback = player.play();
  if (playback && typeof playback.catch === 'function') {
    playback.catch(() => { /* chưa có thao tác người dùng hoặc trình duyệt chặn */ });
  }
};

export const playMessageSound = () => {
  const now = Date.now();
  if (now - lastMessageSoundAt < 900) return;
  lastMessageSoundAt = now;
  playAlertFile(MESSAGE_SOUND_URL, 0.8);
};

export const playNotifySound = () => {
  const now = Date.now();
  if (now - lastNotifySoundAt < 1200) return;
  lastNotifySoundAt = now;
  playAlertFile(NOTIFICATION_SOUND_URL, 0.75);
};

/**
 * FIX Bug 1 & 2: Dùng lại audioCtx module-level (tránh rò rỉ), kiểm tra muted.
 * KHÔNG tạo AudioContext mới mỗi lần gọi nữa.
 */
const playExamWarningBeep = (playbackToken) => {
  if (muted) return;
  if (playbackToken != null && playbackToken !== warningPlaybackToken) return;
  try {
    // Đảm bảo có audioCtx - tạo nếu chưa có (ưu tiên dùng lại)
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const ctx = audioCtx; // alias để code ngắn gọn
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    warningOscillators.add(osc);
    osc.onended = () => warningOscillators.delete(osc);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    setTimeout(() => {
      try {
        if (playbackToken != null && playbackToken !== warningPlaybackToken) return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(660, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        warningOscillators.add(osc2);
        osc2.onended = () => warningOscillators.delete(osc2);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.18);
      } catch { /* ignore */ }
    }, 120);
  } catch {
    /* noop - context hoàn toàn không khả dụng, im lặng */
  }
};

let currentWarningAudio = null;
let warningPlaybackToken = 0;
const warningOscillators = new Set();

/**
 * FIX Bug 3: await resume() trước khi phát để xử lý AudioContext.state === 'suspended'.
 * Cảnh báo phòng thi: file Admin tải lên; không có thì beep.
 */
export const playExamWarningSound = (customUrl = '') => {
  unlockAudio();
  if (muted) return;
  const playbackToken = ++warningPlaybackToken;

  const doPlay = () => {
    if (playbackToken !== warningPlaybackToken) return;
    if (currentWarningAudio) {
      try {
        currentWarningAudio.pause();
        currentWarningAudio.currentTime = 0;
      } catch { /* ignore */ }
    }

    const url = String(customUrl || '').trim();
    if (url) {
      try {
        currentWarningAudio = new Audio(url);
        currentWarningAudio.volume = 0.7;
        void currentWarningAudio.play().catch(() => {
          currentWarningAudio = null;
          playExamWarningBeep(playbackToken);
        });
        return;
      } catch {
        currentWarningAudio = null;
        /* fall through to beep */
      }
    }
    playExamWarningBeep(playbackToken);
  };

  // FIX Bug 3: đảm bảo AudioContext resumed trước khi phát
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(doPlay).catch(doPlay);
  } else {
    doPlay();
  }
};

function lessonAudio() {
  if (muted) return null;
  try {
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

const lessonPraisePlayers = new Map();

/** Phát đúng bản ghi đã ghép với lời khen đang hiển thị. */
export const playLessonCorrectSound = (audioUrl) => {
  if (muted || typeof window === 'undefined' || !audioUrl || typeof window.Audio !== 'function') return;

  let player = lessonPraisePlayers.get(audioUrl);
  if (!player) {
    player = new window.Audio(audioUrl);
    player.preload = 'auto';
    player.volume = 0.85;
    lessonPraisePlayers.set(audioUrl, player);
  }

  player.currentTime = 0;
  const playback = player.play();
  if (playback && typeof playback.catch === 'function') {
    playback.catch((error) => {
      console.warn('Không phát được âm thanh khen luyện tập', error);
    });
  }
};

/** Tiếng tích tắc khi đồng hồ câu hỏi gần hết giờ. */
export const playLessonTick = (tock = false) => {
  unlockAudio();
  const ctx = lessonAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime;
  osc.type = 'square';
  osc.frequency.setValueAtTime(tock ? 620 : 980, start);
  gain.gain.setValueAtTime(0.045, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.05);
};

/** Tiếng trầm khi chọn sai, khác hẳn tiếng nổ. */
export const playLessonWrongSound = () => {
  unlockAudio();
  const ctx = lessonAudio();
  if (!ctx) return;
  const start = ctx.currentTime;
  [196, 130].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + index * 0.14;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, at + 0.16);
    gain.gain.setValueAtTime(0.22, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  });
};

/** Chuỗi nốt ngắn cho hiệu ứng trò chơi luyện tập hằng ngày. */
function playNotes(notes, { type = 'sine', volume = 0.18 } = {}) {
  unlockAudio();
  const ctx = lessonAudio();
  if (!ctx) return;
  const start = ctx.currentTime;
  notes.forEach(({ freq, at = 0, dur = 0.14, slideTo }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = start + at;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });
}

export const gameSounds = {
  tap: () => playNotes([{ freq: 660, dur: 0.05 }], { type: 'triangle', volume: 0.08 }),
  click: () => playNotes([{ freq: 660, dur: 0.05 }], { type: 'triangle', volume: 0.08 }),
  pick: () => playNotes([{ freq: 520, dur: 0.06, slideTo: 760 }], { type: 'triangle', volume: 0.1 }),
  drop: () => playNotes([{ freq: 760, dur: 0.07, slideTo: 440 }], { type: 'triangle', volume: 0.1 }),
  correct: () => playNotes([
    { freq: 659, at: 0, dur: 0.12 },
    { freq: 880, at: 0.09, dur: 0.12 },
    { freq: 1319, at: 0.18, dur: 0.22 },
  ], { type: 'triangle', volume: 0.16 }),
  wrong: () => playNotes([
    { freq: 330, at: 0, dur: 0.2, slideTo: 247 },
    { freq: 247, at: 0.18, dur: 0.32, slideTo: 165 },
  ], { type: 'sawtooth', volume: 0.07 }),
  hint: () => playNotes([
    { freq: 988, at: 0, dur: 0.1 },
    { freq: 1319, at: 0.07, dur: 0.16 },
  ], { type: 'sine', volume: 0.12 }),
  xp: () => playNotes([
    { freq: 880, at: 0, dur: 0.09 },
    { freq: 1175, at: 0.07, dur: 0.11 },
    { freq: 1568, at: 0.15, dur: 0.2 },
  ], { type: 'sine', volume: 0.14 }),
  unlock: () => playNotes([
    { freq: 587, at: 0, dur: 0.11 },
    { freq: 784, at: 0.09, dur: 0.12 },
    { freq: 988, at: 0.18, dur: 0.14 },
    { freq: 1175, at: 0.28, dur: 0.28 },
  ], { type: 'triangle', volume: 0.16 }),
  complete: () => playNotes([
    { freq: 523, at: 0, dur: 0.14 },
    { freq: 659, at: 0.12, dur: 0.14 },
    { freq: 784, at: 0.24, dur: 0.14 },
    { freq: 1047, at: 0.36, dur: 0.34 },
    { freq: 1319, at: 0.5, dur: 0.4 },
  ], { type: 'triangle', volume: 0.16 }),
  win: () => playNotes([
    { freq: 523, at: 0, dur: 0.14 },
    { freq: 659, at: 0.12, dur: 0.14 },
    { freq: 784, at: 0.24, dur: 0.14 },
    { freq: 1047, at: 0.36, dur: 0.34 },
    { freq: 1319, at: 0.5, dur: 0.4 },
  ], { type: 'triangle', volume: 0.16 }),
  sad: () => playNotes([
    { freq: 392, at: 0, dur: 0.28 },
    { freq: 349, at: 0.26, dur: 0.28 },
    { freq: 311, at: 0.52, dur: 0.5, slideTo: 262 },
  ], { type: 'sine', volume: 0.14 }),
  lightningCombo: () => {
    unlockAudio();
    const ctx = lessonAudio();
    if (!ctx) return;
    const start = ctx.currentTime;
    try {
      // 1. Tiếng tia chớp quét tần số cao xuống thấp cực nhanh (electric zap)
      const zapOsc = ctx.createOscillator();
      const zapGain = ctx.createGain();
      zapOsc.type = 'sawtooth';
      zapOsc.frequency.setValueAtTime(1400, start);
      zapOsc.frequency.exponentialRampToValueAtTime(180, start + 0.12);
      zapGain.gain.setValueAtTime(0.24, start);
      zapGain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
      zapOsc.connect(zapGain);
      zapGain.connect(ctx.destination);
      zapOsc.start(start);
      zapOsc.stop(start + 0.13);

      // 2. Chuỗi hợp âm combo tia chớp bùng nổ (C5, E5, G5, C6, E6)
      playNotes([
        { freq: 523.25, at: 0.08, dur: 0.12 },
        { freq: 659.25, at: 0.15, dur: 0.12 },
        { freq: 783.99, at: 0.22, dur: 0.14 },
        { freq: 1046.50, at: 0.30, dur: 0.35 },
        { freq: 1318.51, at: 0.40, dur: 0.42 },
      ], { type: 'triangle', volume: 0.22 });
    } catch {
      /* ignore audio error */
    }
  },
  mascotVictory: () => {
    unlockAudio();
    const ctx = lessonAudio();
    if (!ctx) return;
    try {
      // Khúc khải hoàn linh vật chiến thắng xuất sắc tuyệt đối
      playNotes([
        { freq: 523.25, at: 0.00, dur: 0.16 }, // C5
        { freq: 659.25, at: 0.14, dur: 0.16 }, // E5
        { freq: 783.99, at: 0.28, dur: 0.16 }, // G5
        { freq: 1046.50, at: 0.42, dur: 0.24 }, // C6
        { freq: 1318.51, at: 0.58, dur: 0.28 }, // E6
        { freq: 1567.98, at: 0.74, dur: 0.55 }, // G6
      ], { type: 'triangle', volume: 0.25 });
    } catch {
      /* ignore audio error */
    }
  },
};

/**
 * Quản lý âm thanh Game Hóa DewSkill:
 * - Mặc định bật âm thanh trừ khi người dùng tắt ('thvp_muted' === 'true').
 * - Lưu tùy chọn qua localStorage ('thvp_muted').
 * - Không tự phát trước khi người dùng tương tác.
 */
export const GameSoundManager = {
  isMuted: isSoundMuted,
  setMuted: setSoundMuted,
  toggleMuted: toggleSoundMuted,
  click: () => gameSounds.click(),
  correct: () => gameSounds.correct(),
  wrong: () => gameSounds.wrong(),
  xp: () => gameSounds.xp(),
  complete: () => gameSounds.complete(),
  unlock: () => gameSounds.unlock(),
  play(soundKey) {
    const fn = gameSounds[soundKey];
    if (typeof fn === 'function') fn();
  },
};

export const stopExamWarningSound = () => {
  warningPlaybackToken += 1;
  if (currentWarningAudio) {
    try {
      currentWarningAudio.pause();
      currentWarningAudio.currentTime = 0;
    } catch { /* ignore */ }
    currentWarningAudio = null;
  }
  warningOscillators.forEach((osc) => {
    try { osc.stop(); } catch { /* already stopped */ }
    warningOscillators.delete(osc);
  });
};
