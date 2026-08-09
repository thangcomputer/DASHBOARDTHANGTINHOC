'use strict';
const backupApplicationService = require('../../services/BackupApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const ReportDelete_idCompleted = require('../events/ReportDelete_idCompleted');

class Delete_idHandler {
  async execute(command) {
    const result = await backupApplicationService.delete_id(command);
    await eventBus.publish(new ReportDelete_idCompleted(command));
    return result;
  }
}
module.exports = Delete_idHandler;
