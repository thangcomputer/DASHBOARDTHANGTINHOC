import { useCallback, useEffect, useState } from 'react';
import {
  Sparkles, RefreshCw, ShieldAlert, CheckCircle2, Clock, XCircle,
  AlertTriangle, Loader2, Power, MessageSquareOff,
} from 'lucide-react';
import { aiAutoReplyAPI } from '../services/aiAutoReplyApi';
import { useToast } from '../utils/useToast';
import { AI_AUTO_REPLY_DELAY_OPTIONS } from './AiAutoReplyComposerControl';

const STATUS_BADGE_MAP = {
  sent: { label: 'Đã trả lời', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', Icon: CheckCircle2 },
  needs_human: { label: 'Cần hỗ trợ', cls: 'bg-amber-50 text-amber-800 border-amber-200/80', Icon: AlertTriangle },
  cancelled: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-600 border-slate-200', Icon: XCircle },
  pending: { label: 'Đang chờ', cls: 'bg-blue-50 text-blue-700 border-blue-200/80', Icon: Clock },
  processing: { label: 'Đang xử lý', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', Icon: Loader2 },
  failed: { label: 'Lỗi', cls: 'bg-red-50 text-red-700 border-red-200/80', Icon: AlertTriangle },
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiAutoReplyAdminPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disablingId, setDisablingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [globalCfg, setGlobalCfg] = useState({
    enabled: true,
    defaultDelayMinutes: 5,
    allowTeacherToggle: true,
    maxConsecutiveReplies: 2,
    maxDailyRepliesPerConversation: 10,
  });
  const [historyData, setHistoryData] = useState({
    items: [],
    total: 0,
    counts: { pending: 0, processing: 0, sent: 0, cancelled: 0, needs_human: 0, failed: 0 },
    enabledConversations: [],
  });

  const loadData = useCallback(async (filterStatus = statusFilter) => {
    setLoading(true);
    try {
      const res = await aiAutoReplyAPI.getHistory({ page: 1, limit: 30, status: filterStatus });
      if (res?.success && res.data) {
        setHistoryData({
          items: res.data.items || [],
          total: res.data.total || 0,
          counts: res.data.counts || {},
          enabledConversations: res.data.enabledConversations || [],
        });
        if (res.data.global) {
          setGlobalCfg((prev) => ({ ...prev, ...res.data.global }));
        }
      }
    } catch (err) {
      toast?.error(err?.message || 'Không tải được dữ liệu AI Tự động trả lời');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    void loadData('');
  }, []);

  const saveGlobal = async (patch) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await aiAutoReplyAPI.updateGlobal(patch);
      if (!res?.success) throw new Error(res?.message || 'Lưu thất bại');
      setGlobalCfg((prev) => ({ ...prev, ...res.data }));
      if (res.data?.enabled === false) {
        toast?.success(`Đã tắt AI toàn hệ thống (đã hủy ${res.data.cancelledPendingCount || 0} tác vụ chờ)`);
      } else {
        toast?.success('Đã cập nhật cấu hình AI Tự động trả lời');
      }
      await loadData(statusFilter);
    } catch (err) {
      toast?.error(err?.message || 'Không cập nhật được cấu hình AI');
    } finally {
      setSaving(false);
    }
  };

  const handleForceDisableConv = async (conversationId) => {
    if (!conversationId || disablingId) return;
    setDisablingId(conversationId);
    try {
      const res = await aiAutoReplyAPI.adminDisable(conversationId);
      if (!res?.success) throw new Error(res?.message || 'Không tắt được');
      toast?.success('Đã tắt AI trong cuộc hội thoại');
      await loadData(statusFilter);
    } catch (err) {
      toast?.error(err?.message || 'Lỗi khi tắt AI');
    } finally {
      setDisablingId('');
    }
  };

  const kpiCards = [
    {
      key: 'pending',
      label: 'Đang chờ',
      val: historyData.counts.pending || 0,
      Icon: Clock,
      iconWrap: 'bg-sky-50 text-sky-600 ring-sky-200/70',
      valCls: 'text-sky-700',
    },
    {
      key: 'sent',
      label: 'AI đã trả lời',
      val: historyData.counts.sent || 0,
      Icon: CheckCircle2,
      iconWrap: 'bg-emerald-50 text-emerald-600 ring-emerald-200/70',
      valCls: 'text-emerald-700',
    },
    {
      key: 'cancelled',
      label: 'Đã hủy',
      val: historyData.counts.cancelled || 0,
      Icon: XCircle,
      iconWrap: 'bg-slate-100 text-slate-500 ring-slate-200/80',
      valCls: 'text-slate-700',
    },
    {
      key: 'needs_human',
      label: 'Cần hỗ trợ tay',
      val: historyData.counts.needs_human || 0,
      Icon: AlertTriangle,
      iconWrap: 'bg-amber-50 text-amber-600 ring-amber-200/70',
      valCls: 'text-amber-700',
    },
    {
      key: 'active',
      label: 'Hội thoại đang bật',
      val: historyData.enabledConversations.length || 0,
      Icon: Sparkles,
      iconWrap: 'bg-teal-50 text-teal-600 ring-teal-200/70',
      valCls: 'text-teal-700',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/75 via-teal-50/35 to-white px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/20">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold tracking-[-0.01em] text-slate-900">
                DewSkill AI Auto-Reply toàn hệ thống
              </h3>
              <p className="text-[11.5px] font-normal text-slate-500">
                Admin kiểm soát tắt/mở khẩn cấp, thời gian chờ mặc định, giới hạn chống spam và lịch sử AI phản hồi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadData(statusFilter)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div
              className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors ${
                globalCfg.enabled
                  ? 'border-emerald-200/90 bg-emerald-50/40'
                  : 'border-red-200 bg-red-50/60'
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-800">
                  <Power size={14} className={globalCfg.enabled ? 'text-emerald-600' : 'text-red-500'} />
                  Bật tính năng AI Tự động trả lời toàn hệ thống
                </p>
                <p className="mt-0.5 text-[11.5px] font-normal text-slate-500">
                  Khi tắt, tất cả tác vụ đang chờ sẽ bị hủy ngay và giảng viên không thể tự bật lại.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={globalCfg.enabled}
                disabled={saving}
                onClick={() => void saveGlobal({ enabled: !globalCfg.enabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50 ${
                  globalCfg.enabled ? 'bg-emerald-600' : 'bg-red-400'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    globalCfg.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div
              className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors ${
                globalCfg.allowTeacherToggle
                  ? 'border-emerald-200/75 bg-emerald-50/25'
                  : 'border-slate-200/85 bg-slate-50/60'
              }`}
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-800">Cho phép giảng viên tự bật/tắt AI</p>
                <p className="mt-0.5 text-[11.5px] font-normal text-slate-500">
                  Nếu tắt, chỉ Admin mới có thể bật/tắt và chỉnh thời gian chờ trên từng hội thoại.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={globalCfg.allowTeacherToggle}
                disabled={saving}
                onClick={() => void saveGlobal({ allowTeacherToggle: !globalCfg.allowTeacherToggle })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50 ${
                  globalCfg.allowTeacherToggle ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    globalCfg.allowTeacherToggle ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/85 bg-slate-50/35 p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-slate-700">Thời gian chờ mặc định</p>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700 ring-1 ring-emerald-200/60">
                  {globalCfg.defaultDelayMinutes} phút
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {AI_AUTO_REPLY_DELAY_OPTIONS.map((mins) => {
                  const selected = Number(globalCfg.defaultDelayMinutes) === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      disabled={saving}
                      onClick={() => void saveGlobal({ defaultDelayMinutes: mins })}
                      className={`flex h-9 items-center justify-center rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
                        selected
                          ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                          : 'border border-slate-200/90 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700'
                      }`}
                    >
                      {mins} phút
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/85 bg-slate-50/35 p-4">
              <div>
                <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">
                  Tối đa lượt AI liên tiếp
                </label>
                <select
                  value={globalCfg.maxConsecutiveReplies}
                  disabled={saving}
                  onChange={(e) => void saveGlobal({ maxConsecutiveReplies: Number(e.target.value) })}
                  className="h-9 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} lượt liên tiếp</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">
                  Giới hạn AI / ngày / hội thoại
                </label>
                <select
                  value={globalCfg.maxDailyRepliesPerConversation}
                  disabled={saving}
                  onChange={(e) => void saveGlobal({ maxDailyRepliesPerConversation: Number(e.target.value) })}
                  className="h-9 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                >
                  {[3, 5, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>{n} lượt / ngày</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!globalCfg.enabled ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-xs font-medium text-red-800">
              <ShieldAlert size={16} className="shrink-0 text-red-600" />
              AI Tự động trả lời đang TẮT toàn hệ thống. Không có tin nhắn AI tự động nào được gửi cho đến khi Admin bật lại.
            </div>
          ) : null}
        </div>
      </div>

      {/* Thống kê KPI */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {kpiCards.map((card) => {
          const CardIcon = card.Icon;
          return (
            <div
              key={card.key}
              className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/85 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-500">{card.label}</p>
                <p className={`mt-0.5 text-xl font-extrabold tabular-nums tracking-tight ${card.valCls}`}>
                  {card.val}
                </p>
              </div>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${card.iconWrap}`}>
                <CardIcon size={15} aria-hidden="true" />
              </span>
            </div>
          );
        })}
      </div>

      {historyData.enabledConversations.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/85 bg-white p-4 shadow-sm sm:p-5">
          <h4 className="mb-3 text-[13px] font-bold text-slate-800">
            Hội thoại đang bật AI tự động trả lời ({historyData.enabledConversations.length})
          </h4>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {historyData.enabledConversations.map((conv) => (
              <div
                key={conv.conversationId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/75 bg-slate-50/65 px-3.5 py-2.5 text-xs transition hover:border-slate-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{conv.conversationId}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Chờ {conv.delayMinutes || 5} phút · Bật bởi {conv.updatedByName || conv.updatedBy || 'Admin'} ({formatDateTime(conv.updatedAt)})
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disablingId === conv.conversationId}
                  onClick={() => void handleForceDisableConv(conv.conversationId)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-red-50 disabled:opacity-50"
                >
                  <MessageSquareOff size={12} />
                  Tắt AI
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Lịch sử */}
      <div className="rounded-2xl border border-slate-200/85 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[13px] font-bold text-slate-800">Lịch sử AI tự động trả lời</h4>
          <select
            value={statusFilter}
            onChange={(e) => {
              const next = e.target.value;
              setStatusFilter(next);
              void loadData(next);
            }}
            className="h-8 rounded-xl border border-slate-200/90 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="sent">Đã trả lời</option>
            <option value="needs_human">Cần hỗ trợ</option>
            <option value="cancelled">Đã hủy</option>
            <option value="pending">Đang chờ</option>
          </select>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs font-medium text-slate-400">Đang tải lịch sử...</div>
        ) : historyData.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-xs font-medium text-slate-400">
            Chưa có lượt AI tự động trả lời nào.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/85 text-[11px] font-semibold text-slate-500">
                  <th className="px-3 py-2.5">Thời gian</th>
                  <th className="px-3 py-2.5">Học viên</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                  <th className="px-3 py-2.5">Chờ</th>
                  <th className="px-3 py-2.5">Nội dung / Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.items.map((item) => {
                  const meta = STATUS_BADGE_MAP[item.status] || STATUS_BADGE_MAP.cancelled;
                  const BadgeIcon = meta.Icon;
                  return (
                    <tr key={item._id} className="align-top transition-colors hover:bg-slate-50/65">
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 tabular-nums">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800">
                        {item.studentName || item.studentId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
                          <BadgeIcon size={11} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 tabular-nums">
                        {item.delayMinutes}p
                      </td>
                      <td className="max-w-sm px-3 py-2.5 text-slate-600">
                        <p className="line-clamp-2 leading-relaxed">{item.replyPreview || item.cancelReason || item.errorMessage || '—'}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
