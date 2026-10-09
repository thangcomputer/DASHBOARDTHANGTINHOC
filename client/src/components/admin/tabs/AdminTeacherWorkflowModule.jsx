import React, { useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import AdminEvaluationsTab from './AdminEvaluationsTab';
import AdminTrainingTab from './AdminTrainingTab';

export default function AdminTeacherWorkflowModule() {
  const [activeSection, setActiveSection] = useState('guides');

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
          {[
            { key: 'guides', label: 'Quy trình', icon: FileText },
            { key: 'evaluations', label: 'Đánh giá nội bộ', icon: AlertTriangle },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeSection === tab.key
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
        {activeSection === 'guides' ? (
          <AdminTrainingTab section="guides" />
        ) : (
          <AdminEvaluationsTab />
        )}
      </div>
    </div>
  );
}
