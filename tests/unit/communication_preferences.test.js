'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_COMMUNICATION_PREFERENCES,
  getMessageRejectionPreference,
  normalizeCommunicationPreferences,
} = require('../../services/communicationPreferences');

test('communication preferences default to allowing calls and messages', () => {
  assert.deepEqual(normalizeCommunicationPreferences(null), DEFAULT_COMMUNICATION_PREFERENCES);
  assert.equal(getMessageRejectionPreference(DEFAULT_COMMUNICATION_PREFERENCES, 'student'), false);
  assert.equal(getMessageRejectionPreference(DEFAULT_COMMUNICATION_PREFERENCES, 'teacher'), false);
});

test('message refusal applies only to the selected sender role', () => {
  const preferences = normalizeCommunicationPreferences({
    rejectMessagesFromStudents: true,
    rejectMessagesFromTeachers: false,
  });

  assert.equal(getMessageRejectionPreference(preferences, 'student'), true);
  assert.equal(getMessageRejectionPreference(preferences, 'teacher'), false);
  assert.equal(getMessageRejectionPreference(preferences, 'admin'), false);
});

test('communication preference values are enabled only by strict true', () => {
  assert.deepEqual(normalizeCommunicationPreferences({
    rejectCalls: 'true',
    rejectMessagesFromStudents: 1,
    rejectMessagesFromTeachers: true,
  }), {
    rejectCalls: false,
    rejectMessagesFromStudents: false,
    rejectMessagesFromTeachers: true,
  });
});
