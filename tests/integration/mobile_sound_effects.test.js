'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');

test('mobile foreground notifications and incoming calls play enabled sound effects', () => {
  const soundEffects = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/components/MobileSoundEffects.tsx'),
    'utf8',
  );
  const navigator = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx'),
    'utf8',
  );

  assert.ok(soundEffects.includes("DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION"));
  assert.ok(soundEffects.includes("DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED"));
  assert.ok(soundEffects.includes('CALL_RING_PATTERN_MS = [0, 360, 720, 3000, 3360, 3720]'));
  assert.ok(soundEffects.includes('setInterval(schedulePattern, CALL_RING_PATTERN_INTERVAL_MS)'));
  assert.ok(soundEffects.includes("getMobileSoundEnabled()"));
  assert.ok(soundEffects.includes('if (soundEnabled !== true || !incomingCall || !appIsActive)'));
  assert.ok(soundEffects.includes('if (!appIsActive) return;'));
  assert.ok(navigator.includes('<MobileSoundEffects incomingCall={Boolean(incomingCall)} />'));
});
