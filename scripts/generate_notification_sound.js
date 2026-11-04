'use strict';

/**
 * Sinh file chuông thông báo dùng chung cho web và mobile.
 * Chạy: node scripts/generate_notification_sound.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 1.25;
const total = Math.floor(SAMPLE_RATE * DURATION);
const dry = new Float32Array(total);

const NOTES = [
  { freq: 1046.5, at: 0, gain: 0.55 },
  { freq: 1318.51, at: 0.12, gain: 0.5 },
  { freq: 1567.98, at: 0.24, gain: 0.55 },
  { freq: 2093.0, at: 0.36, gain: 0.22 },
];
const PARTIALS = [
  { ratio: 1, gain: 1, decay: 0.42 },
  { ratio: 2, gain: 0.32, decay: 0.28 },
  { ratio: 2.76, gain: 0.14, decay: 0.18 },
  { ratio: 4.07, gain: 0.06, decay: 0.12 },
];
const ATTACK = 0.006;

for (const note of NOTES) {
  const start = Math.floor(note.at * SAMPLE_RATE);
  for (let i = start; i < total; i += 1) {
    const t = (i - start) / SAMPLE_RATE;
    const attack = t < ATTACK ? t / ATTACK : 1;
    let sample = 0;
    for (const partial of PARTIALS) {
      sample += partial.gain
        * Math.exp(-t / partial.decay)
        * Math.sin(2 * Math.PI * note.freq * partial.ratio * t);
    }
    dry[i] += note.gain * attack * sample;
  }
}

const TAPS = [
  { delay: 0.067, gain: 0.22 },
  { delay: 0.131, gain: 0.12 },
  { delay: 0.211, gain: 0.06 },
];
const wet = Float32Array.from(dry);
for (const tap of TAPS) {
  const offset = Math.floor(tap.delay * SAMPLE_RATE);
  for (let i = offset; i < total; i += 1) wet[i] += dry[i - offset] * tap.gain;
}

const fadeStart = Math.floor((DURATION - 0.15) * SAMPLE_RATE);
for (let i = fadeStart; i < total; i += 1) wet[i] *= (total - i) / (total - fadeStart);

let peak = 0;
for (const value of wet) peak = Math.max(peak, Math.abs(value));
const scale = 0.82 / peak;

const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i += 1) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, wet[i] * scale)) * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
const wav = Buffer.concat([header, data]);

const root = path.join(__dirname, '..');
const targets = [
  path.join(root, 'client/public/audio/notification.wav'),
  path.join(root, 'thang-tin-hoc-mobile/src/assets/audio/notification.wav'),
];
for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, wav);
  console.log('wrote', path.relative(root, target), wav.length, 'bytes');
}
