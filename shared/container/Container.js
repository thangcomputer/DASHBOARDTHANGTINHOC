'use strict';
class Container {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
  }
  register(name, definition, isSingleton = true) {
    if (this.services.has(name)) throw new Error(`Service ${name} is already registered`);
    this.services.set(name, { definition, isSingleton });
  }
  resolve(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service ${name} not found in container`);
    
    if (service.isSingleton) {
      if (!this.instances.has(name)) {
        this.instances.set(name, service.definition(this));
      }
      return this.instances.get(name);
    }
    
    return service.definition(this);
  }
}
module.exports = Container;
