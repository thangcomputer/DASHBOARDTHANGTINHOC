'use strict';
class DomainEvent {
  constructor(payload = {}, metadata = {}) {
    this.eventId = Math.random().toString(36).substr(2, 9);
    this.timestamp = new Date();
    this.eventName = this.constructor.name;
    this.payload = payload;
    this.metadata = metadata;
    
    // Required tracing fields
    this.correlationId = metadata.correlationId || payload.correlationId || null;
    this.requestId = metadata.requestId || payload.requestId || null;
    this.aggregateId = metadata.aggregateId || payload.id || payload._id || null;
    this.aggregateType = metadata.aggregateType || this.eventName.replace('Completed', '');
    this.userId = metadata.userId || payload.userId || null;
    this.tenantId = metadata.tenantId || payload.tenantId || null;
    this.branchId = metadata.branchId || payload.branchId || null;

    Object.freeze(this);
  }
}
module.exports = DomainEvent;
