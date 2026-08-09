'use strict';
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
