'use strict';

function callParticipantKey(participant) {
  return `${participant.role}:${participant.id}`;
}

function reserveCallParticipants(activeCalls, callId, caller, peer) {
  const callerKey = callParticipantKey(caller);
  const peerKey = callParticipantKey(peer);
  if (!callId || !caller.id || !peer.id || callerKey === peerKey) return false;
  if (activeCalls.has(callerKey) || activeCalls.has(peerKey)) return false;
  activeCalls.set(callerKey, callId);
  activeCalls.set(peerKey, callId);
  return true;
}

function releaseCallParticipants(activeCalls, call) {
  for (const participant of [call.caller, call.peer]) {
    const key = callParticipantKey(participant);
    if (activeCalls.get(key) === call.callId) activeCalls.delete(key);
  }
}

function resolveCallEndStatus(callStatus, isCaller) {
  if (callStatus !== 'ringing') return 'completed';
  return isCaller ? 'cancelled' : 'missed';
}

function getCallDurationSeconds(answeredAt, endedAt) {
  if (!answeredAt || !endedAt) return 0;
  return Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(answeredAt).getTime()) / 1000));
}

async function findCallRecipientSockets(fetchSockets, wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const sockets = await fetchSockets();
    if (sockets.length) return sockets;
    if (attempt === 0) await wait(3_000);
  }
  return [];
}

module.exports = {
  callParticipantKey,
  reserveCallParticipants,
  releaseCallParticipants,
  resolveCallEndStatus,
  getCallDurationSeconds,
  findCallRecipientSockets,
};
