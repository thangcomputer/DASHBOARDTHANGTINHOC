'use strict';

const CommunicationPreference = require('../models/CommunicationPreference');

const DEFAULT_COMMUNICATION_PREFERENCES = Object.freeze({
  rejectCalls: false,
  rejectMessagesFromStudents: false,
  rejectMessagesFromTeachers: false,
});

const MESSAGE_PREFERENCE_BY_ROLE = Object.freeze({
  student: 'rejectMessagesFromStudents',
  teacher: 'rejectMessagesFromTeachers',
});

function normalizeCommunicationPreferences(value) {
  return {
    rejectCalls: value?.rejectCalls === true,
    rejectMessagesFromStudents: value?.rejectMessagesFromStudents === true,
    rejectMessagesFromTeachers: value?.rejectMessagesFromTeachers === true,
  };
}

function getMessageRejectionPreference(preferences, senderRole) {
  const key = MESSAGE_PREFERENCE_BY_ROLE[String(senderRole || '').toLowerCase()];
  return key ? preferences?.[key] === true : false;
}

async function getCommunicationPreferences(userId, userRole) {
  const preference = await CommunicationPreference.findOne({
    userId: String(userId || ''),
    userRole: String(userRole || '').toLowerCase(),
  }).lean();
  return preference
    ? normalizeCommunicationPreferences(preference)
    : { ...DEFAULT_COMMUNICATION_PREFERENCES };
}

async function updateCommunicationPreferences(userId, userRole, updates) {
  const preference = await CommunicationPreference.findOneAndUpdate(
    { userId: String(userId || ''), userRole: String(userRole || '').toLowerCase() },
    { $set: updates },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean();
  return normalizeCommunicationPreferences(preference);
}

module.exports = {
  DEFAULT_COMMUNICATION_PREFERENCES,
  getMessageRejectionPreference,
  getCommunicationPreferences,
  normalizeCommunicationPreferences,
  updateCommunicationPreferences,
};
