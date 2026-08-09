'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('TransactionPost_calculateCompleted', { handle: async (event) => console.log('[Transaction Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TransactionPost_rootCompleted', { handle: async (event) => console.log('[Transaction Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TransactionPut_id_confirmCompleted', { handle: async (event) => console.log('[Transaction Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TransactionPut_id_cancelCompleted', { handle: async (event) => console.log('[Transaction Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TransactionDelete_idCompleted', { handle: async (event) => console.log('[Transaction Event Handler]', event.eventName, 'processed successfully.') });
