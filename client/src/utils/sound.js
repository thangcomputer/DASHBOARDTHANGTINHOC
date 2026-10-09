let muted = localStorage.getItem('thvp_muted') === 'true';

/** Chỉ tạo AudioContext sau gesture người dùng (tránh cảnh báo autoplay Chrome) */
let audioCtx = null;
let audioUnlocked = false;

export const isSoundMuted = () => muted;

export const setSoundMuted = (val) => {
  muted = val;
  localStorage.setItem('thvp_muted', val ? 'true' : 'false');
};

/** Gọi sau click/touch đầu tiên để bật được âm thanh (Chrome/Safari autoplay policy) */
export const unlockAudio = () => {
  audioUnlocked = true;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
  } catch {
    /* noop */
  }
};

const playTone = (frequency = 440, type = 'sine', duration = 0.1, volume = 0.5) => {
  if (muted || !audioUnlocked) return;
  try {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch {
    /* noop */
  }
};

let lastMessageSoundAt = 0;
let lastNotifySoundAt = 0;

export const playMessageSound = () => {
  const now = Date.now();
  if (now - lastMessageSoundAt < 350) return;
  lastMessageSoundAt = now;
  playTone(1046.50, 'sine', 0.1, 0.2);
  setTimeout(() => playTone(1318.51, 'sine', 0.15, 0.2), 100);
};

export const playNotifySound = () => {
  const now = Date.now();
  if (now - lastNotifySoundAt < 1200) return;
  lastNotifySoundAt = now;
  playTone(880.00, 'triangle', 0.1, 0.2);
  setTimeout(() => playTone(1174.66, 'triangle', 0.2, 0.2), 150);
};

/**
 * FIX Bug 1 & 2: Dùng lại audioCtx module-level (tránh rò rỉ), kiểm tra muted.
 * KHÔNG tạo AudioContext mới mỗi lần gọi nữa.
 */
const playExamWarningBeep = (playbackToken) => {
  if (muted) return;
  if (playbackToken != null && playbackToken !== warningPlaybackToken) return;
  try {
    // Đảm bảo có audioCtx — tạo nếu chưa có (ưu tiên dùng lại)
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioUnlocked = true;
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
    /* noop — context hoàn toàn không khả dụng, im lặng */
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
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioUnlocked = true;
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function noiseCrack(ctx, start, duration, volume, freq) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, start);
  filter.frequency.exponentialRampToValueAtTime(160, start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(start);
  source.stop(start + duration);
}

/** Tiếng nổ pháo khi chọn đúng. */
export const playLessonCorrectSound = () => {
  unlockAudio();
  const ctx = lessonAudio();
  if (!ctx) return;
  const start = ctx.currentTime;
  noiseCrack(ctx, start, 0.16, 0.5, 1600);
  noiseCrack(ctx, start + 0.14, 0.12, 0.35, 2200);
  noiseCrack(ctx, start + 0.28, 0.2, 0.42, 1200);
  [988, 1318, 1760].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + index * 0.07;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.1, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  });
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
