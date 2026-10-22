import React, { useEffect, useMemo, useState } from 'react';
import { ScheduleView } from './StudentScheduleView';
import { CourseSwitcher } from './StudentShared';
import {
  filterSchedulesByCourse,
  getActiveOneToOneEnrollment,
  scopeStudentToEnrollment,
} from '../../utils/enrollments';

export default function StudentScheduleTab({
  viewStudent,
  mySchedules,
  enrollments = [],
  activeCourseName,
  setActiveCourseName,
  setNoteModalSched,
  displayGrades,
}) {
  const preferredCourse = getActiveOneToOneEnrollment(enrollments);
  const [scheduleCourseName, setScheduleCourseName] = useState('');

  useEffect(() => {
    const selectedExists = enrollments.some(
      (enrollment) => (enrollment.courseName || enrollment.name) === scheduleCourseName,
    );
    if (!scheduleCourseName || !selectedExists) {
      setScheduleCourseName(
        preferredCourse?.courseName
        || preferredCourse?.name
        || activeCourseName
        || viewStudent?.course
        || '',
      );
    }
  }, [activeCourseName, enrollments, preferredCourse, scheduleCourseName, viewStudent?.course]);

  const selectedEnrollment = enrollments.find(
    (enrollment) => (enrollment.courseName || enrollment.name) === scheduleCourseName,
  );
  const scheduleStudent = selectedEnrollment
    ? scopeStudentToEnrollment(viewStudent, selectedEnrollment)
    : viewStudent;
  const schedulesForSelectedCourse = useMemo(
    () => filterSchedulesByCourse(mySchedules, scheduleCourseName),
    [mySchedules, scheduleCourseName],
  );

  return (
    <div className="w-full min-w-0 py-3 sm:py-6 animate-in fade-in duration-500">
      <div className="mb-4">
        <CourseSwitcher
          courses={enrollments}
          activeCourseName={scheduleCourseName || activeCourseName || viewStudent?.course}
          onChange={setScheduleCourseName}
        />
      </div>
      <ScheduleView
        schedules={schedulesForSelectedCourse}
        student={scheduleStudent}
        setNoteModalSched={setNoteModalSched}
        displayGrades={displayGrades}
      />
    </div>
  );
}
