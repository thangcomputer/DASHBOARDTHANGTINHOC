'use strict';
const evaluationApplicationService = require('../../services/EvaluationApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const ExamPost_rootCompleted = require('../events/ExamPost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await evaluationApplicationService.post_root(command);
    await eventBus.publish(new ExamPost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
