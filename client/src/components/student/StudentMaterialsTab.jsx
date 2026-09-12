import React from 'react';
import StudentTrainingLMS from '../StudentTrainingLMS';
import { CourseSwitcher } from './StudentShared';

export default function StudentMaterialsTab({
  viewStudent,
  studentTrainingForLms,
  myAssignments,
  studentTrainingData,
  enrollments = [],
  activeCourseName,
  setActiveCourseName,
  initialMainTab = null,
  hideTabBar = true,
}) {
  return (
          <div className="cms-sd cms-sd-page bg-slate-50 min-h-full">
            <CourseSwitcher
              courses={enrollments}
              activeCourseName={activeCourseName || viewStudent?.course}
              onChange={setActiveCourseName}
            />
            <StudentTrainingLMS 
              key={initialMainTab || 'materials'}
              trainingDataProp={{
                 videos: studentTrainingForLms.videos,
                 files: studentTrainingForLms.files,
                 softwareLinks: studentTrainingData?.softwareLinks || [],
                 assignments: myAssignments || [],
                 exams: viewStudent?.exams || studentTrainingData?.exams || []
              }}
              onBack={undefined}
              initialMainTab={initialMainTab}
              hideTabBar={hideTabBar}
            />
          </div>
  );
}
