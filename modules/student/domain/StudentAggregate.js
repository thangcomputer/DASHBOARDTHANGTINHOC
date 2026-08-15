'use strict';

class StudentAggregate {
  constructor(id, data) {
    this.id = id;
    this.data = data;
    this.events = [];
  }

  static create(id, payload, branchId) {
    // Invariants
    if (!payload.name) throw new Error('Student name is required');
    if (!payload.phone) throw new Error('Student phone is required');
    
    const student = new StudentAggregate(id, {
      ...payload,
      branchId,
      enrollments: payload.enrollments || [],
      paid: payload.paid || false,
      isFirstLogin: payload.isFirstLogin !== undefined ? payload.isFirstLogin : false
    });

    student.addDomainEvent({
      type: 'StudentCreatedEvent',
      payload: { id: student.id, name: student.data.name, phone: student.data.phone }
    });

    return student;
  }

  addDomainEvent(event) {
    this.events.push(event);
  }

  clearEvents() {
    this.events = [];
  }
}

module.exports = StudentAggregate;
