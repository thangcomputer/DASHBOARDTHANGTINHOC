'use strict';
const backupApplicationService = require('../../services/BackupApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const ReportPost_rootCompleted = require('../events/ReportPost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await backupApplicationService.post_root(command);
    await eventBus.publish(new ReportPost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
