'use strict';
const { eventBus } = require('../../../shared/cqrs');
eventBus.subscribe('CoursePost_uploadCompleted', { handle: async (event) => console.log('[Course Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('CoursePost_rootCompleted', { handle: async (event) => console.log('[Course Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('CoursePut_idCompleted', { handle: async (event) => console.log('[Course Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('CourseDelete_idCompleted', { handle: async (event) => console.log('[Course Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('CoursePost_id_submitCompleted', { handle: async (event) => console.log('[Course Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('CoursePut_submissions_submissionId_gradeCompleted', { handle: async (event) => console.log('[Course Event Handler]', event.eventName, 'processed successfully.') });
