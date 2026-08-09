'use strict';
class SagaManager {
  constructor(registry, compensationManager) {
    this.registry = registry;
    this.compensationManager = compensationManager;
  }
  async executeSaga(sagaName, initialData) {
    // Scaffold only
    const definition = this.registry.resolve(sagaName);
    if (!definition) throw new Error(`Saga ${sagaName} not found`);
    return true;
  }
}
module.exports = SagaManager;