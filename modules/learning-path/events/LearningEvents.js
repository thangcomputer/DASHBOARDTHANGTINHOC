'use strict'; 
const DomainEvent = require('../../shared/events/DomainEvent');
class LearningStarted extends DomainEvent { constructor(data) { super(); Object.assign(this, data); } }
class LessonStarted extends DomainEvent { constructor(data) { super(); Object.assign(this, data); } }
class LessonCompleted extends DomainEvent { constructor(data) { super(); Object.assign(this, data); } }
class CourseCompleted extends DomainEvent { constructor(data) { super(); Object.assign(this, data); } }
class LearningPathCompleted extends DomainEvent { constructor(data) { super(); Object.assign(this, data); } }
class CertificateUnlocked extends DomainEvent { constructor(data) { super(); Object.assign(this, data); } }
module.exports = { LearningStarted, LessonStarted, LessonCompleted, CourseCompleted, LearningPathCompleted, CertificateUnlocked };
