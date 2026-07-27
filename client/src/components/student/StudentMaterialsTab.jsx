import React from 'react';
import { CourseSwitcher } from './StudentShared';
import StudentTrainingLMS from '../StudentTrainingLMS';

export default function StudentMaterialsTab({
  enrollments,
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  studentTrainingForLms,
  myAssignments,
  studentTrainingData,
}) {
  return (
          <div className="w-full bg-slate-50 min-h-full px-4 md:px-8 py-6">
            <CourseSwitcher
              courses={enrollments}
              activeCourseName={activeCourseName || viewStudent.course}
              onChange={setActiveCourseName}
            />
            <StudentTrainingLMS 
              trainingDataProp={{
                 videos: studentTrainingForLms.videos,
                 files: studentTrainingForLms.files,
                 assignments: myAssignments || [],
                 exams: viewStudent?.exams || studentTrainingData?.exams || []
              }}
              onBack={undefined}
            />
          </div>
  );
}
