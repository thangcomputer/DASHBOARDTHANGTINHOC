'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  googleOAuthDisabled,
  zaloOAuthDisabled,
} = require('../../utils/googleOAuthDisabled');

function invoke(handler) {
  const state = { status: null, body: null, redirected: false };
  const res = {
    status(code) { state.status = code; return this; },
    json(body) { state.body = body; return body; },
    redirect() { state.redirected = true; },
  };
  handler({}, res);
  return state;
}

test('Google and Zalo OAuth handlers return 410 without redirects', () => {
  for (const [handler, code] of [
    [googleOAuthDisabled, 'GOOGLE_OAUTH_DISABLED'],
    [zaloOAuthDisabled, 'ZALO_OAUTH_DISABLED'],
  ]) {
    const result = invoke(handler);
    assert.equal(result.status, 410);
    assert.equal(result.body.code, code);
    assert.equal(result.redirected, false);
  }
});
