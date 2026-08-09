'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPost_id_reset_historyCompleted = require('../events/StudentPost_id_reset_historyCompleted');

class Post_id_reset_historyHandler {
  async execute(command) {
    const result = await studentApplicationService.post_id_reset_history(command);
    await eventBus.publish(new StudentPost_id_reset_historyCompleted(command));
    return result;
  }
}
module.exports = Post_id_reset_historyHandler;
