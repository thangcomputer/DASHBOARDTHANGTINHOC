const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('lmsBrandedVideoPlayer contract', () => {
  const {
    YT_BRANDED_PLAYER_VARS,
    buildYtBrandedPlayerVars,
    buildYtMobilePlayerVars,
  } = require('../../shared/dailyPractice/lmsBrandedVideoPlayer.cjs');
  it('web branded playerVars giữ controls=0 và không bật fs', () => {
    const vars = buildYtBrandedPlayerVars({ origin: 'https://example.test', start: 12 });
    assert.equal(vars.controls, 0);
    assert.equal(vars.fs, 0);
    assert.equal(vars.modestbranding, 1);
    assert.equal(vars.origin, 'https://example.test');
    assert.equal(vars.start, 12);
    assert.deepEqual(
      Object.keys(YT_BRANDED_PLAYER_VARS).sort(),
      ['cc_load_policy', 'controls', 'disablekb', 'enablejsapi', 'fs', 'iv_load_policy', 'modestbranding', 'playsinline', 'rel'],
    );
  });

  it('mobile branded dùng cùng bộ vars cốt lõi, không autoplay (bấm phát như web)', () => {
    const branded = buildYtMobilePlayerVars(true, 'https://api.test', 0);
    assert.equal(branded.controls, YT_BRANDED_PLAYER_VARS.controls);
    assert.equal(branded.cc_load_policy, YT_BRANDED_PLAYER_VARS.cc_load_policy);
    assert.equal(branded.autoplay, 0);
    const plain = buildYtMobilePlayerVars(false, 'https://api.test', 0);
    assert.equal(plain.autoplay, 1);
  });

  it('StudentVideoPlayer web import shared buildYtBrandedPlayerVars', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../client/src/components/lms/StudentVideoPlayer.jsx'),
      'utf8',
    );
    assert.match(src, /buildYtBrandedPlayerVars/);
    assert.match(src, /lms-yt-crop/);
    assert.match(src, /shared\/dailyPractice\/lmsBrandedVideoPlayer\.mjs/);
  });
});
