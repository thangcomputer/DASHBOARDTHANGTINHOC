import React, { useEffect, useRef } from 'react';
import StudentTrainingLMS from '../StudentTrainingLMS';
import { CourseSwitcher } from './StudentShared';
import { getActiveOneToOneEnrollment } from '../../utils/enrollments';

export default function StudentMaterialsTab({
  viewStudent,
  studentTrainingForLms,
  myAssignments,
  studentTrainingData,
  freePortalTrainingData = null,
  isFreePortalOnly = false,
  enrollments = [],
  activeCourseName,
  setActiveCourseName,
  initialMainTab = null,
  hideTabBar = true,
  focusAssignmentId = '',
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

  const resolvedTrainingProp = isFreePortalOnly
    ? {
        videos: [],
        files: freePortalTrainingData?.files || [],
        softwareLinks: freePortalTrainingData?.softwareLinks || [],
        assignments: freePortalTrainingData?.assignments || [],
        exams: [],
        isFreePortalOnly: true,
      }
    : {
        videos: studentTrainingForLms.videos,
        files: studentTrainingForLms.files,
        softwareLinks: studentTrainingData?.softwareLinks || [],
        assignments: myAssignments || [],
        exams: viewStudent?.exams || studentTrainingData?.exams || [],
        isFreePortalOnly: false,
      };

  return (
          <div className="cms-sd cms-sd-page bg-slate-50 min-h-full">
            {!isFreePortalOnly && (
              <CourseSwitcher
                courses={initialMainTab === 'courses' ? [] : enrollments}
                activeCourseName={activeCourseName || viewStudent?.course}
                onChange={setActiveCourseName}
              />
            )}
            <StudentTrainingLMS 
              key={initialMainTab || 'materials'}
              trainingDataProp={resolvedTrainingProp}
              onBack={undefined}
              initialMainTab={initialMainTab}
              hideTabBar={hideTabBar}
              focusAssignmentId={focusAssignmentId}
            />
          </div>
  );
}
