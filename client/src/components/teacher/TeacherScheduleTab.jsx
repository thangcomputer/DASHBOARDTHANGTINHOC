import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import TeacherMonthlyCalendar from './TeacherMonthlyCalendar';

export default function TeacherScheduleTab({
  setEditingSchedule, setShowScheduleModal, mySchedules, startEditSchedule, cancelSchedule,
}) {
  return (
          <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
            <div className="cms-toolbar sm:flex-row sm:items-center sm:justify-between min-w-0">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 min-w-0">
                <Calendar size={20} className="text-blue-600 shrink-0" /> Lß╗ïch dß║íy
              </h2>
              <button onClick={() => { setEditingSchedule(null); setShowScheduleModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
                <Plus size={14} /> Xß║┐p lß╗ïch mß╗¢i
              </button>
            </div>
            <TeacherMonthlyCalendar
              schedules={mySchedules}
              onEditSchedule={startEditSchedule}
              onAddSchedule={(date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                setEditingSchedule({ date: `${yyyy}-${mm}-${dd}` }); // pre-fill correctly localized
                setShowScheduleModal(true);
              }}
              onCancelSchedule={(scheduleId, reason) => {
                cancelSchedule(scheduleId, reason);
              }}
            />
          </div>

  );
}
