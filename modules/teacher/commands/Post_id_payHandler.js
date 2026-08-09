'use strict';
const employeeApplicationService = require('../services/TeacherApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TeacherPost_id_payCompleted = require('../events/TeacherPost_id_payCompleted');

class Post_id_payHandler {
  async execute(command) {
    const result = await employeeApplicationService.post_id_pay(command);
    await eventBus.publish(new TeacherPost_id_payCompleted(command));
    return result;
  }
}
module.exports = Post_id_payHandler;
