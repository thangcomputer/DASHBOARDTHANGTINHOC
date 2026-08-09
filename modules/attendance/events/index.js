'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('AttendancePost_rootCompleted', { handle: async (event) => console.log('[Attendance Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('AttendancePut_scheduleIdCompleted', { handle: async (event) => console.log('[Attendance Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('AttendanceDelete_scheduleIdCompleted', { handle: async (event) => console.log('[Attendance Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('AttendancePatch_scheduleId_cancelCompleted', { handle: async (event) => console.log('[Attendance Event Handler]', event.eventName, 'processed successfully.') });
