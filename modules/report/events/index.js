'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('ReportPost_rootCompleted', { handle: async (event) => console.log('[Report Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('ReportDelete_idCompleted', { handle: async (event) => console.log('[Report Event Handler]', event.eventName, 'processed successfully.') });
