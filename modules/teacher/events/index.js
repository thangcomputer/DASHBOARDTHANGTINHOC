'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('TeacherPost_rootCompleted', { handle: async (event) => console.log('[Teacher Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TeacherPut_idCompleted', { handle: async (event) => console.log('[Teacher Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TeacherDelete_idCompleted', { handle: async (event) => console.log('[Teacher Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('TeacherPost_id_payCompleted', { handle: async (event) => console.log('[Teacher Event Handler]', event.eventName, 'processed successfully.') });
