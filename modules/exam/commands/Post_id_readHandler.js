'use strict';
const evaluationApplicationService = require('../../services/EvaluationApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const ExamPost_id_readCompleted = require('../events/ExamPost_id_readCompleted');

class Post_id_readHandler {
  async execute(command) {
    const result = await evaluationApplicationService.post_id_read(command);
    await eventBus.publish(new ExamPost_id_readCompleted(command));
    return result;
  }
}
module.exports = Post_id_readHandler;
