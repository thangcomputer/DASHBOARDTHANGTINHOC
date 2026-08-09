'use strict';
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
