'use strict';
class CompensationManager {
  async compensate(sagaContext, stepsExecuted) {
    // Reverse order execution of compensation handlers
    for (let i = stepsExecuted.length - 1; i >= 0; i--) {
      const step = stepsExecuted[i];
      if (step.compensation) await step.compensation(sagaContext);
    }
  }
}
module.exports = CompensationManager;