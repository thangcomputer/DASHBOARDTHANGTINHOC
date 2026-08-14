import CmsSelect from '../../../ui/CmsSelect';

export default function TestSettingsPanel({ value, onChange, disabled = false }) {
  const v = value || {};
  const unlimited = v.maxAttempts == null || v.maxAttempts === '';

  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="block space-y-1 sm:col-span-2">
        <span className="text-xs font-bold text-slate-600">Tên đề</span>
        <input
          type="text"
          value={v.name || ''}
          disabled={disabled}
          onChange={(e) => set({ name: e.target.value })}
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Ngôn ngữ</span>
        <CmsSelect
          value={v.locale || 'vi'}
          disabled={disabled}
          aria-label="Ngôn ngữ đề thi"
          onChange={(e) => set({ locale: e.target.value })}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </CmsSelect>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Thời gian (phút)</span>
        <input
          type="number"
          min={1}
          value={v.timeLimitMinutes ?? 50}
          disabled={disabled}
          onChange={(e) => set({ timeLimitMinutes: e.target.value })}
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Số câu</span>
        <input
          type="number"
          min={1}
          value={v.questionCount ?? 45}
          disabled={disabled}
          onChange={(e) => set({ questionCount: e.target.value })}
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Điểm đạt (/1000)</span>
        <input
          type="number"
          min={0}
          max={1000}
          value={v.passingScore ?? 700}
          disabled={disabled}
          onChange={(e) => set({ passingScore: e.target.value })}
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Cho phép thi lại</span>
        <CmsSelect
          value={v.allowRetake === false ? 'no' : 'yes'}
          disabled={disabled}
          aria-label="Cho phép thi lại"
          onChange={(e) => set({ allowRetake: e.target.value !== 'no' })}
        >
          <option value="yes">Có</option>
          <option value="no">Không</option>
        </CmsSelect>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Số lần thi tối đa</span>
        <CmsSelect
          value={unlimited ? 'unlimited' : 'limited'}
          disabled={disabled}
          aria-label="Giới hạn số lần thi"
          onChange={(e) => set({ maxAttempts: e.target.value === 'unlimited' ? null : (v.maxAttempts || 1) })}
        >
          <option value="unlimited">Không giới hạn</option>
          <option value="limited">Giới hạn</option>
        </CmsSelect>
      </label>
      {!unlimited ? (
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Số lần</span>
          <input
            type="number"
            min={1}
            value={v.maxAttempts ?? 1}
            disabled={disabled}
            onChange={(e) => set({ maxAttempts: e.target.value })}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
          />
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-600">Thứ tự</span>
        <input
          type="number"
          value={v.sortOrder ?? 0}
          disabled={disabled}
          onChange={(e) => set({ sortOrder: e.target.value })}
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
      </label>
      <label className="flex items-center gap-2 mt-6 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={v.isActive !== false}
          disabled={disabled}
          onChange={(e) => set({ isActive: e.target.checked })}
        />
        Đang bật
      </label>
    </div>
  );
}
