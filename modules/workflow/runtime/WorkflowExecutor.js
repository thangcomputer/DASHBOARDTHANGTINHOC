'use strict';
class WorkflowExecutor {
  constructor(metricsRegistry) {
    this.metrics = metricsRegistry;
  }
  
  async executeStep(step, context) {
    const start = Date.now();
    try {
      const result = await step.execute(context);
      this.metrics.increment('workflow_step_success');
      return result;
    } catch (error) {
      this.metrics.increment('workflow_step_failure');
      if (step.isRetryable) {
        throw new Error('RetryableError'); // triggers async retry
      }
      throw error;
    } finally {
      this.metrics.timing('workflow_step_duration', Date.now() - start);
    }
  }
}
module.exports = WorkflowExecutor;
