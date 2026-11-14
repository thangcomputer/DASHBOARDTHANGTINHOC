import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../../services/api';

const FIELDS = [
  ['theory', 'Xong phần lý thuyết'],
  ['video', 'Xem video đủ ngưỡng'],
  ['practice', 'Xong bài thực hành'],
  ['assignment', 'Nộp bài tập'],
  ['exam80', 'Kiểm tra từ 80%'],
  ['exam90', 'Kiểm tra từ 90%'],
  ['exam100', 'Kiểm tra 100%'],
  ['subject', 'Xong một môn bài giảng'],
  ['course', 'Xong cả khóa bài giảng'],
  ['streak3', 'Học 3 ngày liên tiếp'],
  ['streak7', 'Học 7 ngày liên tiếp'],
  ['streak14', 'Học 14 ngày liên tiếp'],
  ['streak30', 'Học 30 ngày liên tiếp'],
];

async function read(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.message || 'Không lưu được');
  return body.data;
}

/** Sửa số XP học bài. Nằm trong trang Bài giảng, không đổi menu. */
export default function AdminLmsXpSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    apiFetch('/lms-progress/settings')
      .then(read)
      .then((data) => setForm({
        videoRatio: data.videoRatio,
        amounts: { ...data.amounts },
        badges: Object.fromEntries((data.badges || []).map((badge) => [badge.key, badge])),
      }))
      .catch((err) => setNotice(err.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      const data = await read(await apiFetch('/lms-progress/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      }));
      setForm({
        videoRatio: data.videoRatio,
        amounts: { ...data.amounts },
        badges: Object.fromEntries((data.badges || []).map((badge) => [badge.key, badge])),
      });
      setNotice('Đã lưu số XP.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <p className="text-sm text-slate-500">{notice || 'Đang tải số XP...'}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Mỗi việc chỉ cộng một lần. Video vẫn mở bài khi xem 70%; XP video chỉ cộng khi đạt ngưỡng bên dưới. Không đụng điểm luyện tập hằng ngày.
      </p>
      <label className="block max-w-xs text-sm font-bold text-slate-700">
        Ngưỡng xem video để được XP
        <input
          type="number"
          min="0.5"
          max="1"
          step="0.05"
          value={form.videoRatio}
          onChange={(event) => setForm({ ...form, videoRatio: event.target.value })}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="text-sm font-bold text-slate-700">
            {label}
            <input
              type="number"
              min="0"
              max="10000"
              value={form.amounts[key] ?? 0}
              onChange={(event) => setForm({
                ...form,
                amounts: { ...form.amounts, [key]: event.target.value },
              })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-800">Huy hiệu</p>
        {Object.values(form.badges || {}).map((badge) => (
          <label key={badge.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={badge.enabled !== false}
              onChange={(event) => setForm({
                ...form,
                badges: { ...form.badges, [badge.key]: { ...badge, enabled: event.target.checked } },
              })}
            />
            <input
              value={badge.title}
              onChange={(event) => setForm({
                ...form,
                badges: { ...form.badges, [badge.key]: { ...badge, title: event.target.value } },
              })}
              className="w-full rounded-xl border border-slate-200 px-3 py-1.5"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Lưu số XP'}
        </button>
        {notice && <p className="text-sm font-semibold text-slate-600">{notice}</p>}
      </div>
    </div>
  );
}
