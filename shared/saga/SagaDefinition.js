'use strict';
class SagaDefinition {
  constructor(name) {
    this.name = name;
    this.steps = [];
  }
  addStep(action, compensation) {
    this.steps.push({ action, compensation });
    return this;
  }
}
module.exports = SagaDefinition;