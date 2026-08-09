'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('ExamPost_rootCompleted', { handle: async (event) => console.log('[Exam Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('ExamPost_id_readCompleted', { handle: async (event) => console.log('[Exam Event Handler]', event.eventName, 'processed successfully.') });
