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
          <div className="cms-sd cms-sd-page bg-slate-50 min-h-full">
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
