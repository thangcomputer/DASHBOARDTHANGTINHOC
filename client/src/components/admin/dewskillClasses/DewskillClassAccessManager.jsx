import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Eye,
  EyeOff,
  Loader2,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserPlus,
} from 'lucide-react';
import CmsSelect from '../../ui/CmsSelect';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { cmsConfirmAction } from '../../../utils/cmsDialog';
import { TIER_META, VISIBILITY_META } from './dewskillClassConstants';

function formatDate(d) {
  if (!d) return 'Không giới hạn';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'Không giới hạn';
  return dt.toLocaleDateString('vi-VN');
}

function isRowExpired(row) {
  if (!row?.expiresAt) return false;
  return new Date(row.expiresAt).getTime() <= Date.now();
}

export default function DewskillClassAccessManager({
  classes,
  meta,
  preselectedClassId = '',
  onChanged,
  toast,
}) {
  // Bộ tìm kiếm & chọn học viên
  const [studentQuery, setStudentQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [studentHits, setStudentHits] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Bộ chọn lớp để cấp quyền
  const [classTierFilter, setClassTierFilter] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);

  // Tuỳ chọn cấp quyền
  const [accessLevel, setAccessLevel] = useState('full');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');
  const [autoEnableSelected, setAutoEnableSelected] = useState(true);
  const [granting, setGranting] = useState(false);

  // Danh sách đã cấp quyền
  const [filterClassId, setFilterClassId] = useState(preselectedClassId || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [accessQuery, setAccessQuery] = useState('');
  const [accessRows, setAccessRows] = useState([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [busyAccessId, setBusyAccessId] = useState('');

  useEffect(() => {
    if (preselectedClassId) {
      setFilterClassId(preselectedClassId);
      setSelectedClassIds((prev) =>
        prev.includes(preselectedClassId) ? prev : [...prev, preselectedClassId]
      );
    }
  }, [preselectedClassId]);

  const loadStudents = useCallback(async () => {
    setSearchingStudents(true);
    try {
      const res = await dewskillClassApi.searchStudents({
        q: studentQuery.trim(),
        accountFilter,
        limit: 40,
      });
      setStudentHits(res.data || []);
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không tải được danh sách học viên'));
    } finally {
      setSearchingStudents(false);
    }
  }, [studentQuery, accountFilter, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadStudents();
    }, 250);
    return () => clearTimeout(t);
  }, [loadStudents]);

  const loadAccessList = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await dewskillClassApi.listAccess({
        classId: filterClassId,
        status: filterStatus,
        q: accessQuery.trim(),
      });
      setAccessRows(res.data || []);
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không tải được danh sách phân quyền'));
    } finally {
      setLoadingAccess(false);
    }
  }, [filterClassId, filterStatus, accessQuery, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadAccessList();
    }, 200);
    return () => clearTimeout(t);
  }, [loadAccessList]);

  const filteredPickerClasses = useMemo(() => {
    if (!classTierFilter) return classes;
    return classes.filter((c) => c.tier === classTierFilter);
  }, [classes, classTierFilter]);

  const selectedHasHiddenClass = useMemo(
    () =>
      selectedClassIds.some((id) => {
        const found = classes.find((c) => String(c._id) === id);
        return found?.visibilityMode === 'hidden';
      }),
    [classes, selectedClassIds]
  );

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleClass = (id) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGrant = async () => {
    if (selectedStudentIds.length === 0 || selectedClassIds.length === 0 || granting) return;
    setGranting(true);
    try {
      const res = await dewskillClassApi.grantAccess({
        studentIds: selectedStudentIds,
        classIds: selectedClassIds,
        accessLevel,
        expiresAt: expiresAt || null,
        note: note.trim(),
        autoEnableSelected: selectedHasHiddenClass && autoEnableSelected,
      });
      const updatedHidden = res?.data?.updatedHiddenClassCount || 0;
      toast.success(
        updatedHidden > 0
          ? `Đã cấp quyền cho ${selectedStudentIds.length} học viên & mở ${updatedHidden} lớp sang chế độ "Theo từng HV"`
          : `Đã cấp quyền hiển thị cho ${selectedStudentIds.length} học viên`
      );
      setSelectedStudentIds([]);
      setNote('');
      await loadAccessList();
      await onChanged?.();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không cấp được quyền hiển thị'));
    } finally {
      setGranting(false);
    }
  };

  const handleToggleVisible = async (row) => {
    const id = String(row._id);
    setBusyAccessId(id);
    try {
      await dewskillClassApi.updateAccess(id, { isVisible: !row.isVisible });
      toast.success(row.isVisible ? 'Đã tạm ẩn lớp với học viên này' : 'Đã bật hiển thị lại');
      await loadAccessList();
      await onChanged?.();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setBusyAccessId('');
    }
  };

  const handleToggleLevel = async (row) => {
    const id = String(row._id);
    const nextLevel = row.accessLevel === 'preview' ? 'full' : 'preview';
    setBusyAccessId(id);
    try {
      await dewskillClassApi.updateAccess(id, { accessLevel: nextLevel });
      toast.success(
        nextLevel === 'full' ? 'Đã đổi sang Mở toàn bộ lớp' : 'Đã đổi sang Chỉ học thử'
      );
      await loadAccessList();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setBusyAccessId('');
    }
  };

  const handleRevoke = async (row) => {
    const studentName = row.studentId?.name || 'học viên';
    const className = row.classId?.name || 'lớp học';
    const ok = await cmsConfirmAction(
      `Thu hồi quyền hiển thị lớp "${className}" khỏi ${studentName}?`,
      {
        title: 'Thu hồi quyền hiển thị',
        type: 'danger',
        confirmText: 'Thu hồi',
      }
    );
    if (!ok) return;

    const id = String(row._id);
    setBusyAccessId(id);
    try {
      await dewskillClassApi.revokeAccess(id);
      toast.success('Đã thu hồi quyền hiển thị lớp học');
      await loadAccessList();
      await onChanged?.();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setBusyAccessId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Khối 1: Cấp quyền hiển thị lớp học */}
      <div className="cms-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserPlus size={16} />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Cấp quyền hiển thị lớp học cho học viên
              </h3>
              <p className="text-xs text-slate-500">
                Chọn 1 hoặc nhiều học viên bên trái, chọn lớp học bên phải rồi bấm cấp quyền.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Cột Trái: Chọn học viên */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-800">
                1. Chọn học viên ({selectedStudentIds.length} đã chọn)
              </span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'free', label: 'TK Miễn phí' },
                  { id: 'center', label: 'HV Trung tâm' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAccountFilter(f.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      accountFilter === f.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Tìm theo tên, SĐT hoặc mã học viên..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-400"
              />
            </div>

            <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
              {searchingStudents ? (
                <p className="py-6 text-center text-xs text-slate-400 inline-flex w-full justify-center items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Đang tải học viên...
                </p>
              ) : studentHits.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Không tìm thấy học viên phù hợp.
                </p>
              ) : (
                studentHits.map((s) => {
                  const id = String(s._id);
                  const checked = selectedStudentIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleStudent(id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                        checked
                          ? 'border-emerald-400 bg-emerald-50/70'
                          : 'border-slate-200/80 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {checked ? (
                          <CheckSquare size={15} className="shrink-0 text-emerald-600" />
                        ) : (
                          <Square size={15} className="shrink-0 text-slate-300" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900">{s.name}</div>
                          <div className="truncate text-[11px] text-slate-500">
                            {s.phone || 'Chưa có SĐT'} {s.studentCode ? `· ${s.studentCode}` : ''}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          s.freePortal
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.freePortal ? 'Miễn phí' : 'Trung tâm'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột Phải: Chọn lớp học */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-800">
                2. Chọn lớp học muốn cho hiển thị ({selectedClassIds.length} đã chọn)
              </span>
              <div className="w-44">
                <CmsSelect
                  value={classTierFilter}
                  aria-label="Lọc lớp theo cấp"
                  onChange={(e) => setClassTierFilter(e.target.value)}
                >
                  <option value="">Tất cả cấp bậc</option>
                  {(meta?.tiers || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortLabel}
                    </option>
                  ))}
                </CmsSelect>
              </div>
            </div>

            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {filteredPickerClasses.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Chưa có lớp học nào. Hãy tạo lớp học trước.
                </p>
              ) : (
                filteredPickerClasses.map((c) => {
                  const id = String(c._id);
                  const checked = selectedClassIds.includes(id);
                  const tierInfo = TIER_META[c.tier] || {
                    shortLabel: c.tier,
                    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
                  };
                  const visInfo = VISIBILITY_META[c.visibilityMode] || VISIBILITY_META.hidden;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleClass(id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                        checked
                          ? 'border-emerald-400 bg-emerald-50/70'
                          : 'border-slate-200/80 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {checked ? (
                          <CheckSquare size={15} className="shrink-0 text-emerald-600" />
                        ) : (
                          <Square size={15} className="shrink-0 text-slate-300" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900">{c.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${tierInfo.badgeClass}`}
                            >
                              {tierInfo.shortLabel}
                            </span>
                            {c.code ? (
                              <span className="text-[10px] font-semibold text-slate-400">
                                {c.code}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${visInfo.badgeClass}`}
                      >
                        {visInfo.shortLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Tuỳ chọn cấp quyền + Nút lưu */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-3">
            <span className="mb-1 block text-xs font-bold text-slate-600">Mức độ truy cập</span>
            <CmsSelect
              value={accessLevel}
              aria-label="Mức độ truy cập"
              onChange={(e) => setAccessLevel(e.target.value)}
            >
              <option value="full">Mở toàn bộ lớp</option>
              <option value="preview">Chỉ hiển thị &amp; học thử</option>
            </CmsSelect>
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor="dew-access-exp">
              Ngày hết hạn (bỏ trống = vĩnh viễn)
            </label>
            <input
              id="dew-access-exp"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor="dew-access-note">
              Ghi chú (tuỳ chọn)
            </label>
            <input
              id="dew-access-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Cho học thử trước lớp 6..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={
                granting || selectedStudentIds.length === 0 || selectedClassIds.length === 0
              }
              onClick={handleGrant}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {granting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>Cấp quyền</span>
            </button>
          </div>

          {selectedHasHiddenClass ? (
            <label className="sm:col-span-12 flex cursor-pointer items-center gap-2 pt-1 text-xs font-semibold text-amber-800">
              <input
                type="checkbox"
                checked={autoEnableSelected}
                onChange={(e) => setAutoEnableSelected(e.target.checked)}
                className="h-4 w-4 rounded border-amber-400 text-emerald-600"
              />
              <span>
                Tự chuyển các lớp đang &quot;Ẩn (Nháp)&quot; vừa chọn sang chế độ &quot;Chỉ học viên được cấp quyền&quot; để học viên thấy ngay
              </span>
            </label>
          ) : null}
        </div>
      </div>

      {/* Khối 2: Bảng danh sách phân quyền hiện tại */}
      <div className="cms-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Danh sách học viên được phép hiển thị ({accessRows.length})
            </h3>
            <p className="text-xs text-slate-500">
              Bật/tắt nhanh quyền nhìn thấy hoặc thu hồi quyền của từng học viên.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <CmsSelect
                value={filterClassId}
                aria-label="Lọc theo lớp học"
                onChange={(e) => setFilterClassId(e.target.value)}
              >
                <option value="">Tất cả lớp học</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </CmsSelect>
            </div>

            <div className="w-40">
              <CmsSelect
                value={filterStatus}
                aria-label="Lọc theo trạng thái"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="visible">Đang hiển thị</option>
                <option value="disabled">Đang tạm ẩn</option>
                <option value="expired">Đã hết hạn</option>
              </CmsSelect>
            </div>

            <input
              type="text"
              value={accessQuery}
              onChange={(e) => setAccessQuery(e.target.value)}
              placeholder="Tìm tên/SĐT/ghi chú..."
              className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {loadingAccess ? (
          <p className="py-8 text-center text-xs text-slate-400 inline-flex w-full justify-center items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Đang tải danh sách phân quyền...
          </p>
        ) : accessRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
            Chưa có bản ghi phân quyền nào khớp bộ lọc.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3">Học viên</th>
                  <th className="py-2.5 pr-3">Lớp học</th>
                  <th className="py-2.5 pr-3">Mức độ</th>
                  <th className="py-2.5 pr-3">Hạn dùng</th>
                  <th className="py-2.5 pr-3">Trạng thái</th>
                  <th className="py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accessRows.map((row) => {
                  const id = String(row._id);
                  const s = row.studentId || {};
                  const c = row.classId || {};
                  const tierInfo = TIER_META[c.tier] || { shortLabel: c.tier };
                  const expired = isRowExpired(row);
                  const busy = busyAccessId === id;

                  return (
                    <tr key={id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3">
                        <div className="font-bold text-slate-900">{s.name || '-'}</div>
                        <div className="text-[11px] text-slate-500">
                          {s.phone || '-'} {s.studentCode ? `· ${s.studentCode}` : ''}
                          <span
                            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              s.freePortal
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {s.freePortal ? 'Miễn phí' : 'Trung tâm'}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 pr-3">
                        <div className="font-bold text-slate-800">{c.name || '-'}</div>
                        <div className="text-[11px] text-slate-500">
                          {tierInfo.shortLabel}
                          {c.visibilityMode === 'hidden' ? (
                            <span className="ml-1.5 font-semibold text-amber-700">
                              (Lớp đang đặt Ẩn)
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleLevel(row)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                            row.accessLevel === 'full'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                          }`}
                          title="Nhấn để đổi mức truy cập"
                        >
                          {row.accessLevel === 'full' ? 'Toàn bộ lớp' : 'Chỉ học thử'}
                        </button>
                      </td>

                      <td className="py-2.5 pr-3 text-slate-600">
                        <div>{formatDate(row.expiresAt)}</div>
                        {row.note ? (
                          <div className="max-w-[160px] truncate text-[10.5px] text-slate-400">
                            {row.note}
                          </div>
                        ) : null}
                      </td>

                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleVisible(row)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                            !row.isVisible
                              ? 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : expired
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {row.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                          <span>
                            {!row.isVisible ? 'Đang tắt' : expired ? 'Hết hạn' : 'Đang hiển thị'}
                          </span>
                        </button>
                      </td>

                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRevoke(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                        >
                          <Trash2 size={12} />
                          <span>Thu hồi</span>
                        </button>
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
