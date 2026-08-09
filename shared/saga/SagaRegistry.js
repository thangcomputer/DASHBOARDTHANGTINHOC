'use strict';
class SagaRegistry {
  constructor() {
    this.sagas = new Map();
  }
  register(sagaDefinition) {
    this.sagas.set(sagaDefinition.name, sagaDefinition);
  }
  resolve(name) {
    return this.sagas.get(name);
  }
}
module.exports = SagaRegistry;