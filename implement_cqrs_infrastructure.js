const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'shared');
const CQRS_DIR = path.join(BASE_DIR, 'cqrs');
const EVENTS_DIR = path.join(BASE_DIR, 'events');
const CONTAINER_DIR = path.join(BASE_DIR, 'container');

[
  CQRS_DIR, 
  EVENTS_DIR, 
  CONTAINER_DIR, 
  path.join(CQRS_DIR, '__tests__'),
  path.join(EVENTS_DIR, '__tests__'),
  path.join(CONTAINER_DIR, '__tests__')
].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

function write(filePath, content) {
  fs.writeFileSync(filePath, content);
  console.log(`Created ${filePath}`);
}

// =======================
// CQRS: CommandBus
// =======================
write(path.join(CQRS_DIR, 'CommandRegistry.js'), `'use strict';
class CommandRegistry {
  constructor() { this.handlers = new Map(); }
  register(commandName, handler) {
    if (this.handlers.has(commandName)) throw new Error(\`Handler for \${commandName} already registered\`);
    this.handlers.set(commandName, handler);
  }
  unregister(commandName) { this.handlers.delete(commandName); }
  resolve(commandName) {
    const handler = this.handlers.get(commandName);
    if (!handler) throw new Error(\`No handler registered for \${commandName}\`);
    return handler;
  }
}
module.exports = CommandRegistry;
`);

write(path.join(CQRS_DIR, 'CommandHandler.js'), `'use strict';
class CommandHandler {
  async execute(command) { throw new Error('execute() not implemented'); }
}
module.exports = CommandHandler;
`);

write(path.join(CQRS_DIR, 'CommandBus.js'), `'use strict';
class CommandBus {
  constructor(registry, observabilityHooks = []) {
    this.registry = registry;
    this.hooks = observabilityHooks;
  }
  async dispatch(command) {
    const commandName = command.constructor.name;
    const handler = this.registry.resolve(commandName);
    
    for (const hook of this.hooks) if (hook.beforeExecute) await hook.beforeExecute(command);
    
    try {
      const result = await handler.execute(command);
      for (const hook of this.hooks) if (hook.afterExecute) await hook.afterExecute(command, result);
      return result;
    } catch (err) {
      for (const hook of this.hooks) if (hook.onError) await hook.onError(command, err);
      throw err;
    }
  }
}
module.exports = CommandBus;
`);

// =======================
// CQRS: QueryBus
// =======================
write(path.join(CQRS_DIR, 'QueryRegistry.js'), `'use strict';
class QueryRegistry {
  constructor() { this.handlers = new Map(); }
  register(queryName, handler) {
    if (this.handlers.has(queryName)) throw new Error(\`Handler for \${queryName} already registered\`);
    this.handlers.set(queryName, handler);
  }
  unregister(queryName) { this.handlers.delete(queryName); }
  resolve(queryName) {
    const handler = this.handlers.get(queryName);
    if (!handler) throw new Error(\`No handler registered for \${queryName}\`);
    return handler;
  }
}
module.exports = QueryRegistry;
`);

write(path.join(CQRS_DIR, 'QueryHandler.js'), `'use strict';
class QueryHandler {
  async execute(query) { throw new Error('execute() not implemented'); }
}
module.exports = QueryHandler;
`);

write(path.join(CQRS_DIR, 'QueryBus.js'), `'use strict';
class QueryBus {
  constructor(registry, observabilityHooks = []) {
    this.registry = registry;
    this.hooks = observabilityHooks;
  }
  async dispatch(query) {
    const queryName = query.constructor.name;
    const handler = this.registry.resolve(queryName);
    
    for (const hook of this.hooks) if (hook.beforeExecute) await hook.beforeExecute(query);
    
    try {
      const result = await handler.execute(query);
      for (const hook of this.hooks) if (hook.afterExecute) await hook.afterExecute(query, result);
      return result;
    } catch (err) {
      for (const hook of this.hooks) if (hook.onError) await hook.onError(query, err);
      throw err;
    }
  }
}
module.exports = QueryBus;
`);

// =======================
// EVENTS
// =======================
write(path.join(EVENTS_DIR, 'DomainEvent.js'), `'use strict';
class DomainEvent {
  constructor(payload, metadata = {}) {
    this.eventId = Math.random().toString(36).substr(2, 9);
    this.timestamp = new Date();
    this.eventName = this.constructor.name;
    this.payload = payload;
    this.metadata = metadata;
  }
}
module.exports = DomainEvent;
`);

write(path.join(EVENTS_DIR, 'EventRegistry.js'), `'use strict';
class EventRegistry {
  constructor() { this.subscribers = new Map(); }
  register(eventName, handler) {
    if (!this.subscribers.has(eventName)) this.subscribers.set(eventName, []);
    this.subscribers.get(eventName).push(handler);
  }
  unregister(eventName, handler) {
    const handlers = this.subscribers.get(eventName);
    if (handlers) {
      this.subscribers.set(eventName, handlers.filter(h => h !== handler));
    }
  }
  resolve(eventName) { return this.subscribers.get(eventName) || []; }
}
module.exports = EventRegistry;
`);

write(path.join(EVENTS_DIR, 'EventDispatcher.js'), `'use strict';
class EventDispatcher {
  constructor(registry) { this.registry = registry; }
  async dispatch(event) {
    const handlers = this.registry.resolve(event.eventName);
    const promises = handlers.map(handler => handler.handle(event));
    await Promise.allSettled(promises);
  }
}
module.exports = EventDispatcher;
`);

write(path.join(EVENTS_DIR, 'EventBus.js'), `'use strict';
class EventBus {
  constructor(dispatcher, observabilityHooks = []) {
    this.dispatcher = dispatcher;
    this.hooks = observabilityHooks;
  }
  async publish(event) {
    for (const hook of this.hooks) if (hook.beforeExecute) await hook.beforeExecute(event);
    try {
      await this.dispatcher.dispatch(event);
      for (const hook of this.hooks) if (hook.afterExecute) await hook.afterExecute(event);
    } catch (err) {
      for (const hook of this.hooks) if (hook.onError) await hook.onError(event, err);
      throw err;
    }
  }
  subscribe(eventName, handler) { this.dispatcher.registry.register(eventName, handler); }
  unsubscribe(eventName, handler) { this.dispatcher.registry.unregister(eventName, handler); }
}
module.exports = EventBus;
`);

// =======================
// CONTAINER (DI)
// =======================
write(path.join(CONTAINER_DIR, 'Container.js'), `'use strict';
class Container {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
  }
  register(name, definition, isSingleton = true) {
    if (this.services.has(name)) throw new Error(\`Service \${name} is already registered\`);
    this.services.set(name, { definition, isSingleton });
  }
  resolve(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(\`Service \${name} not found in container\`);
    
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
`);

write(path.join(CONTAINER_DIR, 'ServiceProvider.js'), `'use strict';
class ServiceProvider {
  register(container) { throw new Error('register() not implemented'); }
}
module.exports = ServiceProvider;
`);

// =======================
// UNIT TESTS
// =======================
write(path.join(CQRS_DIR, '__tests__', 'CommandBus.test.js'), `'use strict';
const CommandRegistry = require('../CommandRegistry');
const CommandBus = require('../CommandBus');

class DummyCommand {}
class DummyHandler { async execute(command) { return 'success'; } }

describe('CommandBus', () => {
  let registry, bus;
  beforeEach(() => {
    registry = new CommandRegistry();
    bus = new CommandBus(registry);
  });
  
  test('dispatches command successfully', async () => {
    registry.register('DummyCommand', new DummyHandler());
    const res = await bus.dispatch(new DummyCommand());
    expect(res).toBe('success');
  });
  
  test('throws if handler not found', async () => {
    await expect(bus.dispatch(new DummyCommand())).rejects.toThrow('No handler registered');
  });
  
  test('duplicate registration throws', () => {
    registry.register('DummyCommand', new DummyHandler());
    expect(() => registry.register('DummyCommand', new DummyHandler())).toThrow();
  });
  
  test('observability hooks are called', async () => {
    registry.register('DummyCommand', new DummyHandler());
    let before = false, after = false;
    const hooks = [{
      beforeExecute: async () => { before = true; },
      afterExecute: async () => { after = true; }
    }];
    const busWithHooks = new CommandBus(registry, hooks);
    await busWithHooks.dispatch(new DummyCommand());
    expect(before).toBe(true);
    expect(after).toBe(true);
  });
});
`);

write(path.join(CQRS_DIR, '__tests__', 'QueryBus.test.js'), `'use strict';
const QueryRegistry = require('../QueryRegistry');
const QueryBus = require('../QueryBus');

class DummyQuery {}
class DummyHandler { async execute(query) { return 'query_success'; } }

describe('QueryBus', () => {
  test('dispatches query successfully', async () => {
    const registry = new QueryRegistry();
    const bus = new QueryBus(registry);
    registry.register('DummyQuery', new DummyHandler());
    const res = await bus.dispatch(new DummyQuery());
    expect(res).toBe('query_success');
  });
});
`);

write(path.join(EVENTS_DIR, '__tests__', 'EventBus.test.js'), `'use strict';
const EventRegistry = require('../EventRegistry');
const EventDispatcher = require('../EventDispatcher');
const EventBus = require('../EventBus');
const DomainEvent = require('../DomainEvent');

class DummyEvent extends DomainEvent {}

describe('EventBus', () => {
  let bus, registry;
  beforeEach(() => {
    registry = new EventRegistry();
    const dispatcher = new EventDispatcher(registry);
    bus = new EventBus(dispatcher);
  });
  
  test('publishes to multiple subscribers', async () => {
    let call1 = false, call2 = false;
    bus.subscribe('DummyEvent', { handle: async () => { call1 = true; } });
    bus.subscribe('DummyEvent', { handle: async () => { call2 = true; } });
    await bus.publish(new DummyEvent());
    expect(call1).toBe(true);
    expect(call2).toBe(true);
  });
  
  test('unsubscribe works', async () => {
    let calls = 0;
    const handler = { handle: async () => { calls++; } };
    bus.subscribe('DummyEvent', handler);
    await bus.publish(new DummyEvent());
    expect(calls).toBe(1);
    
    bus.unsubscribe('DummyEvent', handler);
    await bus.publish(new DummyEvent());
    expect(calls).toBe(1); // No increment
  });
});
`);

write(path.join(CONTAINER_DIR, '__tests__', 'Container.test.js'), `'use strict';
const Container = require('../Container');

describe('Container', () => {
  test('resolves singleton correctly', () => {
    const container = new Container();
    let instanceCount = 0;
    container.register('MyService', () => { instanceCount++; return { id: 1 }; });
    
    const s1 = container.resolve('MyService');
    const s2 = container.resolve('MyService');
    
    expect(instanceCount).toBe(1);
    expect(s1).toBe(s2);
  });
  
  test('throws if duplicate registration', () => {
    const container = new Container();
    container.register('A', () => ({}));
    expect(() => container.register('A', () => ({}))).toThrow();
  });
  
  test('throws if not found', () => {
    const container = new Container();
    expect(() => container.resolve('Unknown')).toThrow();
  });
});
`);
