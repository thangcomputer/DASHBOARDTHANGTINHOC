'use strict';
const TransactionManager = require('../transaction/TransactionManager');
const TransactionFactory = require('../transaction/TransactionFactory');
const TransactionContext = require('../transaction/TransactionContext');
const IdempotencyManager = require('../idempotency/IdempotencyManager');
const IdempotencyKeyGenerator = require('../idempotency/IdempotencyKeyGenerator');
const IdempotencyStore = require('../idempotency/IdempotencyStore');
const RequestContext = require('../observability/RequestContext');
const Metrics = require('../observability/Metrics');

const txManager = new TransactionManager(new TransactionFactory());
const idempotencyManager = new IdempotencyManager(new IdempotencyStore(), new IdempotencyKeyGenerator());

class CommandBus {
  constructor(registry, observabilityHooks = []) {
    this.registry = registry;
    this.hooks = observabilityHooks;
  }
  async dispatch(command) {
    const commandName = command.constructor.name;
    const handler = this.registry.resolve(commandName);
    const req = RequestContext.getContext();
    const isReqEmpty = !req || Object.keys(req).length === 0;
    const fallbackReq = { method: 'CMD', url: commandName + Date.now() + Math.random(), userId: 'sys', tenantId: 'sys' };
    
    // Phase 4: Idempotency Integration
    return await idempotencyManager.execute(isReqEmpty ? fallbackReq : req, async () => {
      // Phase 1: TransactionManager Integration
      return await txManager.execute(async (tx) => {
        // Automatically create TransactionContext
        return await TransactionContext.run(tx, async () => {
          for (const hook of this.hooks) if (hook.beforeExecute) await hook.beforeExecute(command);
          
          const start = Date.now();
          let result;
          try {
            result = await handler.execute(command);
            const duration = Date.now() - start;
            Metrics.observe('execution_duration', {}, duration);
            Metrics.inc('transaction_total', { status: 'success', command: commandName });
            
            for (const hook of this.hooks) if (hook.afterExecute) await hook.afterExecute(command, result);
            return result;
          } catch (err) {
            const duration = Date.now() - start;
            Metrics.observe('execution_duration', {}, duration);
            Metrics.inc('transaction_total', { status: 'rollback', command: commandName, reason: err.name || 'Error' });
            
            for (const hook of this.hooks) if (hook.onError) await hook.onError(command, err);
            throw err;
          }
        });
      });
    });
  }
}
module.exports = CommandBus;