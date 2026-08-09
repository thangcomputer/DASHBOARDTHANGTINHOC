const MongoAssignmentRepository = require('./MongoAssignmentRepository');
const MongoCourseRepository = require('./MongoCourseRepository');
const MongoSubmissionRepository = require('./MongoSubmissionRepository');
const MongoTeachingGuideRepository = require('./MongoTeachingGuideRepository');
const MongoTrainingCourseRepository = require('./MongoTrainingCourseRepository');
const MongoTrainingLessonRepository = require('./MongoTrainingLessonRepository');
const MongoTrainingProgressRepository = require('./MongoTrainingProgressRepository');

module.exports = {
  assignmentRepository: new MongoAssignmentRepository(),
  courseRepository: new MongoCourseRepository(),
  submissionRepository: new MongoSubmissionRepository(),
  teachingGuideRepository: new MongoTeachingGuideRepository(),
  trainingCourseRepository: new MongoTrainingCourseRepository(),
  trainingLessonRepository: new MongoTrainingLessonRepository(),
  trainingProgressRepository: new MongoTrainingProgressRepository(),
};
