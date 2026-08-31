'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { googleOAuthDisabled } = require('../../utils/googleOAuthDisabled');

test('Google OAuth endpoints return 410 JSON and never redirect', () => {
  const observed = { status: null, body: null, redirected: false };
  const res = {
    status(value) {
      observed.status = value;
      return this;
    },
    json(value) {
      observed.body = value;
      return this;
    },
    redirect() {
      observed.redirected = true;
      throw new Error('must not redirect');
    },
  };

  googleOAuthDisabled({}, res);
  assert.equal(observed.status, 410);
  assert.equal(observed.body.code, 'GOOGLE_OAUTH_DISABLED');
  assert.equal(observed.redirected, false);
});
