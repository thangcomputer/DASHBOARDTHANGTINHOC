import React from 'react';
import { ScheduleView } from './StudentScheduleView';

export default function StudentScheduleTab({
  viewStudent,
  mySchedules,
  setNoteModalSched,
  displayGrades,
}) {
  return (
    <div className="w-full min-w-0 py-3 sm:py-6 animate-in fade-in duration-500">
      <ScheduleView
        schedules={mySchedules}
        student={viewStudent}
        setNoteModalSched={setNoteModalSched}
        displayGrades={displayGrades}
      />
    </div>
  );
}
