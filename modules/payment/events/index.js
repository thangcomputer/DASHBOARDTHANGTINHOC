'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('PaymentPost_payment_sessionCompleted', { handle: async (event) => console.log('[Payment Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('PaymentPost_create_sessionCompleted', { handle: async (event) => console.log('[Payment Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('PaymentPost_sepayCompleted', { handle: async (event) => console.log('[Payment Event Handler]', event.eventName, 'processed successfully.') });
