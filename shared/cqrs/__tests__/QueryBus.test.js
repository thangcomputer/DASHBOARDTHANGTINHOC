'use strict';
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
