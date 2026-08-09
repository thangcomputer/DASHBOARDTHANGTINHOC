'use strict';

class CreateStudentCommand {
  constructor(payload) {
    this.actorId = payload.actorId;
    this.tenantId = payload.tenantId;
    this.branchId = payload.branchId;
    this.studentData = payload.studentData;
    this.correlationId = payload.correlationId || Date.now().toString();
  }
}

module.exports = CreateStudentCommand;
