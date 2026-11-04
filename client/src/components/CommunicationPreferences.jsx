import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { communicationPreferencesAPI } from '../services/api';

const callPreference = {
  key: 'rejectCalls',
  title: 'Từ chối cuộc gọi',
  description: 'Khi bật, học viên và giảng viên khác không thể gọi cho bạn.',
};
const messagePreferenceByRole = {
  student: {
    key: 'rejectMessagesFromTeachers',
    title: 'Từ chối tin nhắn từ giảng viên',
    description: 'Người gửi sẽ được báo rằng bạn từ chối tin nhắn.',
  },
  teacher: {
    key: 'rejectMessagesFromStudents',
    title: 'Từ chối tin nhắn từ học viên',
    description: 'Người gửi sẽ được báo rằng bạn từ chối tin nhắn.',
  },
};
const defaultPreferences = {
  rejectCalls: false,
  rejectMessagesFromStudents: false,
  rejectMessagesFromTeachers: false,
};

export default function CommunicationPreferences({ role, compact = false }) {
  const messagePreference = messagePreferenceByRole[role];
  const preferenceRows = messagePreference ? [callPreference, messagePreference] : [];
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    communicationPreferencesAPI.get()
      .then((value) => {
        if (active) setPreferences(value);
      })
      .catch((cause) => {
        if (active) setError(cause?.message || 'Không thể tải tùy chọn liên lạc.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const toggle = async (key, value) => {
    setSavingKey(key);
    setError('');
    try {
      setPreferences(await communicationPreferencesAPI.update({ [key]: value }));
    } catch (cause) {
      setError(cause?.message || 'Không thể lưu tùy chọn liên lạc.');
    } finally {
      setSavingKey('');
    }
  };

  if (compact) {
    return (
      <section>
        <p className="text-[12px] font-bold leading-snug text-slate-800">Quyền riêng tư liên lạc</p>
        <p className="text-[10px] text-slate-500">Chọn ai có thể gọi hoặc nhắn tin cho bạn.</p>
        <div className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {preferenceRows.map(({ key, title, description }) => {
            const checked = preferences[key];
            const disabled = loading || Boolean(savingKey);
            return (
              <div key={key} className="flex items-center gap-2 px-2 py-1.5">
                {key === 'rejectCalls'
                  ? <Phone size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
                  : <MessageCircle size={13} className="shrink-0 text-slate-400" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold leading-snug text-slate-800">{title}</span>
                  <span className="block text-[10px] text-slate-500">{description}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={title}
                  disabled={disabled}
                  onClick={() => { void toggle(key, !checked); }}
                  style={{ boxShadow: 'none' }}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-red-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
        {error ? <p role="alert" className="mt-1 text-[10px] font-semibold text-red-600">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 lg:px-5 lg:py-4 border-b border-slate-100">
        <h3 className="text-sm lg:text-base font-extrabold text-slate-800">Quyền riêng tư liên lạc</h3>
        <p className="text-xs lg:text-sm text-slate-500 mt-1">Chọn ai có thể gọi hoặc nhắn tin cho bạn.</p>
      </div>
      {preferenceRows.map(({ key, title, description }) => {
        const checked = preferences[key];
        const disabled = loading || Boolean(savingKey);
        return (
          <div key={key} className="flex items-center gap-3 px-4 py-3.5 lg:px-5 border-b last:border-b-0 border-slate-100">
            <span className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
              {key === 'rejectCalls'
                ? <Phone size={16} aria-hidden="true" />
                : <MessageCircle size={16} aria-hidden="true" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-800">{title}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              aria-label={title}
              disabled={disabled}
              onClick={() => { void toggle(key, !checked); }}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 shrink-0 ${checked ? 'bg-red-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        );
      })}
      {error ? <p role="alert" className="px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
}
