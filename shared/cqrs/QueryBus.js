'use strict';
const RequestContext = require('../observability/RequestContext');
const Metrics = require('../observability/Metrics');
const Tracer = require('../observability/Tracer');
const RetryExecutor = require('../retry/RetryExecutor');
const RetryPolicy = require('../retry/RetryPolicy');
const BackoffStrategy = require('../retry/BackoffStrategy');

const retryPolicy = new RetryPolicy(3, BackoffStrategy.exponential);
const retryExecutor = new RetryExecutor(retryPolicy);

class QueryBus {
  constructor(registry, observabilityHooks = []) {
    this.registry = registry;
    this.hooks = observabilityHooks;
  }
  async dispatch(query) {
    const queryName = query.constructor.name;
    const handler = this.registry.resolve(queryName);
    
    for (const hook of this.hooks) if (hook.beforeExecute) await hook.beforeExecute(query);
    
    const start = Date.now();
    try {
      // Phase 2: RetryPolicy (read only)
      const result = await retryExecutor.execute(async () => {
         return await handler.execute(query);
      });
      const duration = Date.now() - start;
      Metrics.observe('query_duration', {}, duration);
      
      for (const hook of this.hooks) if (hook.afterExecute) await hook.afterExecute(query, result);
      return result;
    } catch (err) {
      for (const hook of this.hooks) if (hook.onError) await hook.onError(query, err);
      throw err;
    }
  }
}
module.exports = QueryBus;