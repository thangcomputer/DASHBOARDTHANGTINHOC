'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath));

test('web and mobile ship identical message and notification sounds', () => {
  for (const name of ['message.wav', 'notification.wav']) {
    const web = read(`client/public/audio/${name}`);
    const mobile = read(`thang-tin-hoc-mobile/src/assets/audio/${name}`);
    assert.ok(web.length > 1000, `${name} is too small`);
    assert.equal(web.toString('ascii', 0, 4), 'RIFF');
    assert.ok(web.equals(mobile), `${name} differs between web and mobile`);
  }
  assert.ok(
    read('client/public/audio/message.wav').equals(read('thang-tin-hoc-mobile/src/assets/audio/practice-correct.wav')),
    'message sound must stay the mobile app message sound',
  );
});

test('web and mobile play message and notification files separately', () => {
  const web = read('client/src/utils/sound.js').toString('utf8');
  const mobile = read('thang-tin-hoc-mobile/src/components/MobileSoundEffects.tsx').toString('utf8');

  assert.ok(web.includes("MESSAGE_SOUND_URL = '/audio/message.wav'"));
  assert.ok(web.includes("NOTIFICATION_SOUND_URL = '/audio/notification.wav'"));
  assert.ok(mobile.includes("require('../assets/audio/message.wav')"));
  assert.ok(mobile.includes("require('../assets/audio/notification.wav')"));
  assert.ok(mobile.includes('SOCKET_EVENTS.MESSAGE_RECEIVED, playMessageSound'));
  assert.ok(mobile.includes('SOCKET_EVENTS.NOTIFICATION, playNotificationSound'));
});
