import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Cpu, Info, Loader2, RotateCcw, Save, ShieldCheck, Sparkles,
} from 'lucide-react';
import { aiSupportAPI } from '../../../services/api';
import { useToast } from '../../../utils/useToast';
import { cmsConfirmAction } from '../../../utils/cmsDialog';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const TIER_ORDER = ['free', '1d', '1m', '3m', '6m', '12m', 'course_student'];

const TIER_BADGES = {
  free: { label: 'Miễn phí', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  '1d': { label: 'Gói Ngày', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  '1m': { label: 'Tiêu Chuẩn', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  '3m': { label: 'Tiêu Chuẩn', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  '6m': { label: 'Dài Hạn', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  '12m': { label: 'Dài Hạn', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  course_student: { label: 'HV Khóa học', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const THINKING_BUDGET_OPTIONS = [
  { value: 0, label: '0 (Tắt)' },
  { value: 512, label: '512 tokens' },
  { value: 1024, label: '1024 tokens' },
  { value: 1536, label: '1536 tokens' },
  { value: 2048, label: '2048 tokens (Tối đa)' },
];

function formatDateTimeVi(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminAiModelPolicyPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [tiers, setTiers] = useState(null);
  const [allowedModels, setAllowedModels] = useState(null);
  const [meta, setMeta] = useState({ updatedAt: null, updatedByName: '' });
  const [error, setError] = useState('');

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await aiSupportAPI.getAdminModelPolicy();
      setTiers(data?.policy?.tiers || data?.defaults?.tiers || null);
      setAllowedModels(data?.allowedModels || null);
      setMeta({
        updatedAt: data?.policy?.updatedAt || null,
        updatedByName: data?.policy?.updatedByName || '',
      });
    } catch (err) {
      const msg = err?.message || 'Không tải được cấu hình Model AI';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const updateTierField = (tierKey, field, value) => {
    setTiers((prev) => {
      if (!prev || !prev[tierKey]) return prev;
      return {
        ...prev,
        [tierKey]: {
          ...prev[tierKey],
          [field]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!tiers) return;
    setSaving(true);
    try {
      const data = await aiSupportAPI.updateAdminModelPolicy(tiers);
      setTiers(data?.policy?.tiers || tiers);
      setMeta({
        updatedAt: data?.policy?.updatedAt || new Date().toISOString(),
        updatedByName: data?.policy?.updatedByName || 'Admin',
      });
      toast.success('Đã lưu cấu hình phân tầng Model AI cho tất cả các gói');
    } catch (err) {
      toast.error(err?.message || 'Không lưu được cấu hình Model AI');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!(await cmsConfirmAction('Khôi phục toàn bộ phân tầng Model AI và hạn mức Fair-Use về cấu hình mặc định ban đầu?'))) {
      return;
    }
    setResetting(true);
    try {
      const data = await aiSupportAPI.resetAdminModelPolicy();
      setTiers(data?.policy?.tiers || data?.defaults?.tiers || null);
      setMeta({
        updatedAt: data?.policy?.updatedAt || new Date().toISOString(),
        updatedByName: data?.policy?.updatedByName || 'Admin',
      });
      toast.success('Đã khôi phục cấu hình Model AI về mặc định');
    } catch (err) {
      toast.error(err?.message || 'Không khôi phục được cấu hình mặc định');
    } finally {
      setResetting(false);
    }
  };

  const liteOptions = allowedModels?.lite || ['gemini-3.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-flash-lite-latest'];
  const standardOptions = allowedModels?.standard || ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.8-flash'];
  const fileProOptions = allowedModels?.filePro || ['gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Cpu size={16} className="text-emerald-600" />
            Phân tầng Model AI &amp; Hạn mức theo gói học viên
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Điều chỉnh model Google Gemini, số lượt ưu tiên mỗi ngày và chốt chặn Fair-Use cho từng gói 1 ngày → 12 tháng.
            {meta.updatedAt ? (
              <span className="ml-1.5 inline-flex items-center gap-1 font-semibold text-emerald-700">
                · Cập nhật lúc {formatDateTimeVi(meta.updatedAt)}
                {meta.updatedByName ? ` bởi ${meta.updatedByName}` : ''}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || saving || resetting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            <span>Khôi phục mặc định</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !tiers}
            className="cms-btn cms-btn-primary !py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Lưu cấu hình Model AI</span>
          </button>
        </div>
      </div>

      {/* Ghi chú chiến lược Fair-Use */}
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-950">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
        <div className="space-y-0.5 leading-relaxed">
          <div className="font-extrabold">
            Chiến lược &ldquo;Hỏi không giới hạn + Tự động hạ model khi hết lượt ưu tiên (Fair-Use)&rdquo;
          </div>
          <p className="text-[11.5px] text-emerald-800">
            Học viên đã mua gói (1 ngày, 1/3/6/12 tháng) <strong>luôn được hỏi văn bản không giới hạn</strong> bằng Model Nhanh. Khi dùng hết số lượt Model Mạnh (Câu khó/Ảnh hoặc Giải file Pro) trong ngày, hệ thống tự động hạ xuống Model Nhanh cho đến <strong>00:00 giờ VN</strong> hôm sau thay vì khóa cứng.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      ) : null}

      {loading || !tiers ? (
        <div className="flex items-center justify-center py-10 text-xs font-semibold text-slate-500">
          <Loader2 size={18} className="mr-2 animate-spin text-emerald-600" />
          Đang tải cấu hình phân tầng Model AI...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {TIER_ORDER.map((tierKey) => {
            const row = tiers[tierKey];
            if (!row) return null;
            const badge = TIER_BADGES[tierKey] || TIER_BADGES['1m'];
            return (
              <div
                key={tierKey}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{row.label}</h4>
                  </div>
                  <code className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                    {tierKey}
                  </code>
                </div>

                {/* Chọn Model cho 3 cấp */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Model nhanh (Text thường)
                    <select
                      className={`${INPUT} mt-1`}
                      value={row.liteModel}
                      onChange={(e) => updateTierField(tierKey, 'liteModel', e.target.value)}
                    >
                      {liteOptions.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Model Câu khó &amp; Ảnh
                    <select
                      className={`${INPUT} mt-1`}
                      value={row.standardModel}
                      onChange={(e) => updateTierField(tierKey, 'standardModel', e.target.value)}
                    >
                      {standardOptions.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Model Giải file Pro
                    <select
                      className={`${INPUT} mt-1`}
                      value={row.fileProModel}
                      onChange={(e) => updateTierField(tierKey, 'fileProModel', e.target.value)}
                    >
                      {fileProOptions.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Hạn mức lượt ưu tiên/ngày */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Lượt Câu khó/ngày
                    <input
                      type="number"
                      min="0"
                      max="500"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.standardDailyLimit}
                      onChange={(e) => updateTierField(tierKey, 'standardDailyLimit', Number(e.target.value))}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Lượt Ảnh/ngày
                    <input
                      type="number"
                      min="0"
                      max="200"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.imageDailyLimit}
                      onChange={(e) => updateTierField(tierKey, 'imageDailyLimit', Number(e.target.value))}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Giải file Flash/ngày
                    <input
                      type="number"
                      min="0"
                      max="200"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.fileFlashDailyLimit}
                      onChange={(e) => updateTierField(tierKey, 'fileFlashDailyLimit', Number(e.target.value))}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Giải file Pro/ngày
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.fileProDailyLimit}
                      onChange={(e) => updateTierField(tierKey, 'fileProDailyLimit', Number(e.target.value))}
                    />
                  </label>
                </div>

                {/* Chốt chặn kỹ thuật & Fair-Use */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Thinking Budget Pro
                    <select
                      className={`${INPUT} mt-1`}
                      value={row.fileProThinkingBudget}
                      onChange={(e) => updateTierField(tierKey, 'fileProThinkingBudget', Number(e.target.value))}
                    >
                      {THINKING_BUDGET_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Ngưỡng Fair-Use/ngày
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.fairUseDailySoftCap}
                      onChange={(e) => updateTierField(tierKey, 'fairUseDailySoftCap', Number(e.target.value))}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Ký tự file tối đa
                    <input
                      type="number"
                      min="1000"
                      max="40000"
                      step="500"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.maxAttachmentChars}
                      onChange={(e) => updateTierField(tierKey, 'maxAttachmentChars', Number(e.target.value))}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Tin lịch sử AI
                    <input
                      type="number"
                      min="2"
                      max="12"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.maxHistoryMessages}
                      onChange={(e) => updateTierField(tierKey, 'maxHistoryMessages', Number(e.target.value))}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-600">
                    Tốc độ (câu/phút)
                    <input
                      type="number"
                      min="0"
                      max="60"
                      className={`${INPUT} mt-1 tabular-nums`}
                      value={row.rateLimitPerMinute}
                      onChange={(e) => updateTierField(tierKey, 'rateLimitPerMinute', Number(e.target.value))}
                    />
                  </label>
                </div>

                {/* Token bounds & 3.8-flash toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(row.allow38Fallback)}
                      onChange={(e) => updateTierField(tierKey, 'allow38Fallback', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Cho phép fallback lên gemini-3.8-flash</span>
                  </label>

                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Info size={12} />
                    MaxTokens: thường {row.normalMaxTokens} · khó {row.standardMaxTokens} · file {row.fileMaxTokens}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
