import React from 'react';
import StudentTrainingLMS from '../StudentTrainingLMS';

export default function StudentMaterialsTab({
  viewStudent,
  studentTrainingForLms,
  myAssignments,
  studentTrainingData,
  initialMainTab = null,
  hideTabBar = false,
}) {
  return (
          <div className="cms-sd cms-sd-page bg-slate-50 min-h-full">
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
