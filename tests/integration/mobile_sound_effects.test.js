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
  const callScreen = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/screens/CallScreen.tsx'),
    'utf8',
  );
  const callRingback = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/components/CallRingback.tsx'),
    'utf8',
  );

  assert.ok(soundEffects.includes("DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION"));
  assert.ok(soundEffects.includes("DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED"));
  assert.ok(soundEffects.includes("require('../assets/audio/incoming-call-ringtone.wav')"));
  assert.ok(soundEffects.includes('ringtonePlayer.loop = true'));
  assert.ok(soundEffects.includes("getMobileSoundEnabled()"));
  assert.ok(soundEffects.includes('if (soundEnabled !== true || !incomingCall || !appIsActive)'));
  assert.ok(soundEffects.includes('if (!appIsActive) return;'));
  assert.ok(navigator.includes('<MobileSoundEffects incomingCall={Boolean(incomingCall)} />'));
  assert.ok(callScreen.includes("useState(direction === 'outgoing')"));
  assert.ok(callScreen.includes('setRingbackActive(false)'));
  assert.ok(callScreen.includes('<CallRingback active={ringbackActive && direction === \'outgoing\''));
  assert.ok(callRingback.includes('setInterval(playPattern, 4500)'));
});
