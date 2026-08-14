import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import TestSettingsPanel from './components/TestSettingsPanel';
import CertPrepConfirmDialog from './CertPrepConfirmDialog';

const BLANK = {
  name: '',
  locale: 'vi',
  timeLimitMinutes: 50,
  questionCount: 45,
  passingScore: 700,
  allowRetake: true,
  maxAttempts: null,
  sortOrder: 0,
  isActive: true,
};

function validateTestForm(v) {
  const errors = {};
  if (!String(v.name || '').trim()) errors.name = 'Tên đề bắt buộc';
  const time = Number(v.timeLimitMinutes);
  if (!Number.isFinite(time) || time <= 0) errors.timeLimitMinutes = 'Thời gian phải lớn hơn 0';
  const count = Number(v.questionCount);
  if (!Number.isInteger(count) || count <= 0) errors.questionCount = 'Số câu phải lớn hơn 0';
  const pass = Number(v.passingScore);
  if (!Number.isFinite(pass) || pass < 0 || pass > 1000) errors.passingScore = 'Điểm đạt phải từ 0 đến 1000';
  if (v.maxAttempts != null && v.maxAttempts !== '') {
    const max = Number(v.maxAttempts);
    if (!Number.isInteger(max) || max < 1) errors.maxAttempts = 'Số lần thi tối đa phải ≥ 1';
  }
  return errors;
}

export default function CertPrepTestForm({ test, saving, onSave, onClose }) {
  const [form, setForm] = useState(test ? { ...BLANK, ...test, maxAttempts: test.maxAttempts ?? null } : BLANK);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [dirtyConfirm, setDirtyConfirm] = useState(false);

  return (
    <div className="cms-modal-shell">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = validateTestForm(form);
          setErrors(next);
          if (Object.keys(next).length) return;
          onSave({
            ...form,
            name: String(form.name).trim(),
            timeLimitMinutes: Number(form.timeLimitMinutes),
            questionCount: Number(form.questionCount),
            passingScore: Number(form.passingScore),
            maxAttempts: form.maxAttempts == null || form.maxAttempts === '' ? null : Number(form.maxAttempts),
            sortOrder: Number(form.sortOrder) || 0,
          });
        }}
        className="cms-modal-panel max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-prep-test-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 id="cert-prep-test-title" className="text-base font-bold">{test ? 'Sửa đề thi' : 'Thêm đề thi'}</h3>
          <button type="button" aria-label="Đóng" onClick={() => (dirty ? setDirtyConfirm(true) : onClose())} className="w-10 h-10 rounded-xl hover:bg-slate-50"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <TestSettingsPanel
            value={form}
            onChange={(next) => { setDirty(true); setForm(next); }}
            disabled={saving}
          />
          {Object.values(errors).map((msg) => (
            <p key={msg} className="text-sm text-red-600 font-semibold">{msg}</p>
          ))}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button type="button" onClick={() => (dirty ? setDirtyConfirm(true) : onClose())} className="min-h-11 px-4 rounded-xl font-bold text-sm">Hủy</button>
          <button type="submit" disabled={saving} className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60 inline-flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null} Lưu
          </button>
        </div>
      </form>
      <CertPrepConfirmDialog open={dirtyConfirm} title="Thay đổi chưa lưu" message="Bạn có thay đổi chưa lưu." confirmText="Đóng" onCancel={() => setDirtyConfirm(false)} onConfirm={() => { setDirtyConfirm(false); onClose(); }} />
    </div>
  );
}
