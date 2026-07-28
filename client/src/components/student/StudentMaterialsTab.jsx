import React from 'react';
import StudentTrainingLMS from '../StudentTrainingLMS';

export default function StudentMaterialsTab({
  viewStudent,
  studentTrainingForLms,
  myAssignments,
  studentTrainingData,
}) {
  return (
          <div className="cms-sd cms-sd-page bg-slate-50 min-h-full">
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
