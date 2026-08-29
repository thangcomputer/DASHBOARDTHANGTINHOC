import React from 'react';

export const showGlossyAlert = (message) => {
  window.dispatchEvent(new CustomEvent('show-glossy-alert', { detail: message }));
};

export const GlossyAlertProvider = () => {
  const [glossyAlert, setGlossyAlert] = React.useState({ isOpen: false, message: '' });
  
  React.useEffect(() => {
    const handler = (e) => setGlossyAlert({ isOpen: true, message: e.detail });
    window.addEventListener('show-glossy-alert', handler);
    return () => window.removeEventListener('show-glossy-alert', handler);
  }, []);
  
  if (!glossyAlert.isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onClick={() => setGlossyAlert({ isOpen: false, message: '' })}
    >
      <div
        className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)] rounded-3xl p-8 max-w-sm w-full text-center animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Thông báo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">Thông báo</h3>
        <p className="text-sm text-slate-600 font-medium mb-8 leading-relaxed">{glossyAlert.message}</p>
        <button 
          type="button"
          onClick={() => setGlossyAlert({ isOpen: false, message: '' })}
          className="w-full py-3.5 px-6 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
};

export const getDisplayName = (person, students = []) => {
  if (!person) return 'Không rõ';
  const raw = String(person.name || person.studentName || person.displayName || '').trim();
  if (raw && !/^\d{5,}$/.test(raw) && !raw.includes('*')) return raw;
  const id = String(person.studentId || person.id || person._id || '');
  if (id && Array.isArray(students) && students.length) {
    const found = students.find((s) => String(s._id || s.id) === id);
    const foundName = String(found?.name || '').trim();
    if (foundName && !/^\d{5,}$/.test(foundName)) return foundName;
  }
  if (raw) return raw;
  return person.email || person.phone || person.zalo || (id ? `HV-${id.slice(-4)}` : 'Học viên');
};
