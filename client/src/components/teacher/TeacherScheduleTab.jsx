import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import TeacherMonthlyCalendar from './TeacherMonthlyCalendar';

export default function TeacherScheduleTab({
  setEditingSchedule, setShowScheduleModal, mySchedules, startEditSchedule, cancelSchedule,
}) {
  return (
          <div className="px-4 md:px-0 py-6 md:py-8 space-y-6 w-full min-w-0 max-w-6xl mx-auto">
            <div className="cms-toolbar sm:flex-row sm:items-center sm:justify-between min-w-0 gap-3">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2 min-w-0">
                <Calendar size={20} className="text-blue-600 shrink-0" /> Lịch dạy
              </h2>
              <button onClick={() => { setEditingSchedule(null); setShowScheduleModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 md:px-5 rounded-xl text-sm font-medium shadow-sm transition flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 min-h-10">
                <Plus size={14} /> Xếp lịch mới
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
