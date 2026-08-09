'use strict';
const DomainEvent = require('./DomainEvent');
class AuthenticationSucceeded extends DomainEvent { constructor(userId) { super(); this.userId = userId; } }
class AuthenticationFailed extends DomainEvent { constructor(ip, reason) { super(); this.ip = ip; this.reason = reason; } }
class PermissionDenied extends DomainEvent { constructor(userId, resource) { super(); this.userId = userId; this.resource = resource; } }
class SessionCreated extends DomainEvent { constructor(sessionId) { super(); this.sessionId = sessionId; } }
class SessionRevoked extends DomainEvent { constructor(sessionId) { super(); this.sessionId = sessionId; } }
class SessionExpired extends DomainEvent { constructor(sessionId) { super(); this.sessionId = sessionId; } }
class TokenIssued extends DomainEvent { constructor(tokenId) { super(); this.tokenId = tokenId; } }
class TokenRotated extends DomainEvent { constructor(familyId) { super(); this.familyId = familyId; } }
class TokenRevoked extends DomainEvent { constructor(tokenId) { super(); this.tokenId = tokenId; } }
class ReplayAttackDetected extends DomainEvent { constructor(requestId) { super(); this.requestId = requestId; } }
class PasswordChanged extends DomainEvent { constructor(userId) { super(); this.userId = userId; } }
class PasswordResetRequested extends DomainEvent { constructor(userId) { super(); this.userId = userId; } }
class PasswordResetCompleted extends DomainEvent { constructor(userId) { super(); this.userId = userId; } }

module.exports = {
  AuthenticationSucceeded, AuthenticationFailed, PermissionDenied,
  SessionCreated, SessionRevoked, SessionExpired,
  TokenIssued, TokenRotated, TokenRevoked, ReplayAttackDetected,
  PasswordChanged, PasswordResetRequested, PasswordResetCompleted
};