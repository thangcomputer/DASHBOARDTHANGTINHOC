import React, { useEffect, useRef } from 'react';
import StudentTrainingLMS from '../StudentTrainingLMS';
import { CourseSwitcher } from './StudentShared';
import { getActiveOneToOneEnrollment } from '../../utils/enrollments';

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
  const preferredCourse = getActiveOneToOneEnrollment(enrollments);
  const appliedInitialPreference = useRef(false);

  useEffect(() => {
    if (appliedInitialPreference.current || !preferredCourse) return;
    appliedInitialPreference.current = true;
    const preferredName = preferredCourse.courseName || preferredCourse.name;
    const activeEnrollment = enrollments.find(
      (enrollment) => (enrollment.courseName || enrollment.name) === activeCourseName,
    );
    if (activeEnrollment !== preferredCourse) setActiveCourseName(preferredName);
  }, [activeCourseName, enrollments, initialMainTab, preferredCourse, setActiveCourseName]);

  return (
          <div className="cms-sd cms-sd-page bg-slate-50 min-h-full">
            <CourseSwitcher
              courses={initialMainTab === 'courses' ? [] : enrollments}
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
