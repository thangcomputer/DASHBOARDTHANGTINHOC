'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('EnrollmentPost_id_enrollmentsCompleted', { handle: async (event) => console.log('[Enrollment Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('EnrollmentPut_id_enrollments_enrollmentId_settingsCompleted', { handle: async (event) => console.log('[Enrollment Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('EnrollmentPut_id_enrollments_enrollmentId_payCompleted', { handle: async (event) => console.log('[Enrollment Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('EnrollmentDelete_id_enrollments_enrollmentIdCompleted', { handle: async (event) => console.log('[Enrollment Event Handler]', event.eventName, 'processed successfully.') });
