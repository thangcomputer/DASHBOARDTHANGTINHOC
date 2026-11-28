import { useCallback, useEffect, useState } from 'react';
import { Gift, Loader2, RotateCcw, Save, ShieldCheck, Tag } from 'lucide-react';
import subscriptionApi from '../../../services/subscriptionApi';
import { useToast } from '../../../utils/useToast';
import { cmsConfirmAction } from '../../../utils/cmsDialog';

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const QUICK_DISCOUNT_PRESETS = [
  { label: '30K', value: 30000 },
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
  { label: '200K', value: 200000 },
];

function formatShortBadgeVnd(amount) {
  const val = Math.max(0, Math.round(Number(amount) || 0));
  if (val === 0) return '0đ';
  if (val >= 1000 && val % 1000 === 0) return `${val / 1000}K`;
  return `${val.toLocaleString('vi-VN')}đ`;
}

export default function AdminReferralConfigPanel() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscriptionApi.admin.getReferralConfig();
      setConfig(data?.config || null);
      setStats(data?.stats || null);
    } catch (err) {
      toast.error(err?.message || 'Không tải được cấu hình ưu đãi giới thiệu');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!config || saving) return;
    setSaving(true);
    try {
      const data = await subscriptionApi.admin.setReferralConfig(config);
      setConfig(data?.config || config);
      setStats(data?.stats || stats);
      toast.success('Đã lưu cấu hình ưu đãi giới thiệu bạn bè');
    } catch (err) {
      toast.error(err?.message || 'Không lưu được cấu hình ưu đãi');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await cmsConfirmAction(
      'Khôi phục cấu hình Giới thiệu bạn bè về mặc định (giảm 50.000đ khi được giới thiệu)?',
      {
        title: 'Khôi phục mặc định',
        type: 'info',
        confirmText: 'Khôi phục 50K',
      },
    );
    if (!ok) return;

    setResetting(true);
    try {
      const data = await subscriptionApi.admin.resetReferralConfig();
      setConfig(data?.config || null);
      setStats(data?.stats || stats);
      toast.success('Đã khôi phục mặc định giảm 50.000đ');
    } catch (err) {
      toast.error(err?.message || 'Không khôi phục được mặc định');
    } finally {
      setResetting(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="cms-card flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        <span>Đang tải cấu hình ưu đãi giới thiệu...</span>
      </div>
    );
  }

  const shortDiscount = formatShortBadgeVnd(config.discountAmountVnd);
  const shortReferrer = formatShortBadgeVnd(config.referrerRewardVnd);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/70">
              <Gift size={19} />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Ưu đãi Giới thiệu bạn bè (Giảm học phí)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Học viên nhập mã giới thiệu sẽ được tự động trừ tiền ưu đãi trực tiếp khi thanh toán VietQR.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(config.enabled)}
                onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>{config.enabled ? 'Đang bật chương trình' : 'Đang tạm tắt'}</span>
            </label>

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              <span>Khôi phục mặc định (50K)</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cms-btn cms-btn-primary !py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>

        {/* Thống kê nhanh */}
        {stats ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-slate-500">Lượt được giới thiệu</div>
              <div className="mt-0.5 text-lg font-black text-slate-900 tabular-nums">
                {stats.totalReferredStudents} học viên
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-amber-800">Ưu đãi đang chờ áp dụng</div>
              <div className="mt-0.5 text-lg font-black text-amber-900 tabular-nums">
                {Number(stats.totalAvailableDiscountVnd || 0).toLocaleString('vi-VN')}đ
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-emerald-800">Tổng tiền đã giảm cho HV</div>
              <div className="mt-0.5 text-lg font-black text-emerald-900 tabular-nums">
                {Number(stats.totalUsedDiscountVnd || 0).toLocaleString('vi-VN')}đ
              </div>
            </div>
          </div>
        ) : null}

        {/* Cấu hình mức giảm & điều kiện */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 lg:col-span-7">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700">
              <Tag size={14} className="text-emerald-600" />
              <span>Mức giảm giá &amp; Điều kiện áp dụng</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700" htmlFor="ref-discount-vnd">
                  Giảm cho người được giới thiệu (VNĐ)
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input
                    id="ref-discount-vnd"
                    type="number"
                    min={0}
                    max={5000000}
                    step={5000}
                    className={`${INPUT} sm:max-w-[200px]`}
                    value={config.discountAmountVnd ?? 50000}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        discountAmountVnd: Math.max(0, Math.round(Number(e.target.value) || 0)),
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_DISCOUNT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({ ...prev, discountAmountVnd: preset.value }))
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                          Number(config.discountAmountVnd) === preset.value
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-700">
                Thưởng giảm giá cho người giới thiệu (VNĐ)
                <input
                  type="number"
                  min={0}
                  max={5000000}
                  step={5000}
                  className={`${INPUT} mt-1`}
                  value={config.referrerRewardVnd ?? 50000}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      referrerRewardVnd: Math.max(0, Math.round(Number(e.target.value) || 0)),
                    }))
                  }
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-500">
                  Đặt 0 nếu chỉ giảm giá cho người được giới thiệu.
                </span>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Giá trị khóa học / đơn tối thiểu (VNĐ)
                <input
                  type="number"
                  min={0}
                  max={50000000}
                  step={10000}
                  className={`${INPUT} mt-1`}
                  value={config.minOrderAmountVnd ?? 100000}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      minOrderAmountVnd: Math.max(0, Math.round(Number(e.target.value) || 0)),
                    }))
                  }
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-500">
                  Khóa học có giá từ mức này trở lên mới được tự động trừ giảm giá.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200/70 pt-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={config.applyToCourses !== false}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, applyToCourses: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Áp dụng khi mua Khóa học DewSkill</span>
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(config.applyToAiPackages)}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, applyToAiPackages: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Áp dụng khi mua Gói Hỏi AI</span>
              </label>
            </div>
          </div>

          {/* Chống gian lận & Xem trước */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Giới hạn &amp; Xem trước bên Học viên</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Giới hạn bạn / tài khoản
                <input
                  type="number"
                  min={1}
                  max={500}
                  className={`${INPUT} mt-1`}
                  value={config.maxReferralsPerStudent ?? 10}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxReferralsPerStudent: Math.max(1, Math.round(Number(e.target.value) || 10)),
                    }))
                  }
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Giới hạn lượt / ngày
                <input
                  type="number"
                  min={1}
                  max={50}
                  className={`${INPUT} mt-1`}
                  value={config.maxReferralsPerDay ?? 2}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxReferralsPerDay: Math.max(1, Math.round(Number(e.target.value) || 2)),
                    }))
                  }
                />
              </label>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(config.requireFinishedSession)}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, requireFinishedSession: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Yêu cầu làm xong 1 bài luyện mới được nhập mã</span>
            </label>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                Xem trước hiển thị trên Tổng quan học viên
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900">
                  Giới thiệu bạn bè · Giảm {shortDiscount}
                </span>
                <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                  Nhận giảm {shortDiscount}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-slate-600">
                Người được giới thiệu được giảm{' '}
                <strong>{Number(config.discountAmountVnd || 0).toLocaleString('vi-VN')}đ</strong>
                {Number(config.referrerRewardVnd) > 0
                  ? ` · Người giới thiệu nhận thưởng giảm ${shortReferrer}`
                  : ''}
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
