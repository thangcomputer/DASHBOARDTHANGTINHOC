import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  Layers,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { dewskillStudentApi } from '../../../services/dewskillStudentApi';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { TIER_META } from '../dewskillClasses/dewskillClassConstants';
import { useToast } from '../../../utils/useToast';
import { cmsConfirmAction } from '../../../utils/cmsDialog';

const FILTER_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'free', label: 'Miễn phí' },
  { key: 'unlocked', label: 'Đã mở gói' },
  { key: 'locked', label: 'Đang khóa' },
];

const EMPTY_FORM = {
  name: '',
  zalo: '',
  email: '',
  password: '',
  freeUnlocked: false,
  planLabel: 'Gói DewSkill',
  planDays: 365,
  accountLocked: false,
  accountLockReason: '',
  gradeGroup: '',
  level: '',
};

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('vi-VN');
}

function DewskillRowActionMenu({
  student,
  deviceCount,
  isBusy,
  open,
  onToggle,
  onClose,
  onResetDevices,
  onToggleLock,
  onEdit,
  onDelete,
}) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setCoords((prev) => (prev == null ? prev : null));
      return undefined;
    }
    const place = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        setCoords((prev) => (prev == null ? prev : null));
        return;
      }
      const menuW = Math.min(220, window.innerWidth - 16);
      const approxH = menuRef.current?.offsetHeight || 200;
      const gap = 6;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < Math.min(approxH, 220) && spaceAbove > spaceBelow;
      let left = r.right - menuW;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      const maxH = Math.max(140, openUp ? spaceAbove : spaceBelow);
      const top = openUp
        ? Math.max(8, r.top - gap - Math.min(approxH, maxH))
        : r.bottom + gap;
      const next = {
        left: Math.round(left),
        top: Math.round(top),
        width: menuW,
        maxH: Math.round(maxH),
      };
      setCoords((prev) => (
        prev
        && prev.left === next.left
        && prev.top === next.top
        && prev.width === next.width
        && prev.maxH === next.maxH
          ? prev
          : next
      ));
    };
    place();
    const t = window.setTimeout(place, 0);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const itemCls =
    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold text-left whitespace-nowrap transition-colors';

  const menu = open && coords
    ? createPortal(
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[10060] bg-white border border-slate-200 rounded-2xl shadow-[0_16px_48px_rgba(15,23,42,0.18)] py-1.5 w-[220px] overflow-y-auto overscroll-contain"
        style={{
          left: coords.left,
          top: coords.top,
          width: coords.width,
          maxHeight: coords.maxH,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onResetDevices(student);
          }}
          className={`${itemCls} justify-between text-slate-700 hover:bg-amber-50 hover:text-amber-800`}
        >
          <span className="flex items-center gap-2.5">
            <Laptop size={15} className="shrink-0 text-amber-600" />
            <span>Reset thiết bị</span>
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              deviceCount >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {deviceCount}/2
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onToggleLock(student);
          }}
          className={`${itemCls} text-slate-700 hover:bg-slate-50`}
        >
          {student.accountLocked
            ? <><Unlock size={15} className="shrink-0 text-emerald-600" /><span>Mở khóa tài khoản</span></>
            : <><Lock size={15} className="shrink-0 text-slate-500" /><span>Khóa tài khoản</span></>}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onEdit(student);
          }}
          className={`${itemCls} text-slate-700 hover:bg-slate-50`}
        >
          <Pencil size={15} className="shrink-0 text-slate-500" />
          <span>Chỉnh sửa</span>
        </button>
        <div className="mt-1 border-t border-slate-100 pt-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onDelete(student);
            }}
            className={`${itemCls} text-rose-600 hover:bg-rose-50`}
          >
            <Trash2 size={15} className="shrink-0 text-rose-600" />
            <span>Xóa</span>
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={isBusy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Thao tác với ${student.name || 'học viên'}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`relative rounded-lg border p-1.5 transition ${
          open
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : deviceCount >= 2
              ? 'border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
        }`}
        title="Thao tác"
      >
        <MoreVertical size={15} />
      </button>
      {menu}
    </>
  );
}

export default function AdminDewskillStudentsTab() {
  const toast = useToast();

  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ all: 0, free: 0, unlocked: 0, locked: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');

  // Modal cấp lớp DewSkill cho học viên
  const [assignStudent, setAssignStudent] = useState(null);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [accessLevel, setAccessLevel] = useState('full');
  const [granting, setGranting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dewskillStudentApi.list({
        search: search.trim(),
        filter,
        page,
        limit: 25,
      });
      setStudents(res.items || []);
      setStats(res.stats || { all: 0, free: 0, unlocked: 0, locked: 0 });
      setPagination(res.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err?.message || 'Không tải được danh sách học viên DewSkill');
    } finally {
      setLoading(false);
    }
  }, [search, filter, page, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadStudents();
    }, 180);
    return () => clearTimeout(t);
  }, [loadStudents]);

  const openCreateModal = () => {
    setEditingStudent(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setForm({
      name: student.name || '',
      zalo: student.zalo || '',
      email: student.email || '',
      password: '',
      freeUnlocked: Boolean(student.freeUnlocked),
      planLabel: student.subscription?.planLabel || 'Gói DewSkill',
      planDays: 365,
      accountLocked: Boolean(student.accountLocked),
      accountLockReason: student.accountLockReason || '',
      gradeGroup: student.freeSurvey?.gradeGroup || '',
      level: student.freeSurvey?.level || '',
    });
    setFormOpen(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập họ tên học viên.');
      return;
    }
    if (!form.zalo.trim() && !form.email.trim()) {
      toast.error('Vui lòng nhập số điện thoại (Zalo) hoặc Email.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        zalo: form.zalo.trim(),
        email: form.email.trim(),
        freeUnlocked: Boolean(form.freeUnlocked),
        planLabel: form.planLabel.trim() || 'Gói DewSkill',
        planDays: Number(form.planDays) || 0,
        accountLocked: Boolean(form.accountLocked),
        accountLockReason: form.accountLockReason.trim(),
        freeSurvey: {
          gradeGroup: form.gradeGroup.trim(),
          level: form.level.trim(),
        },
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      if (editingStudent?._id) {
        await dewskillStudentApi.update(editingStudent._id, payload);
        toast.success('Đã cập nhật tài khoản học viên DewSkill.');
      } else {
        await dewskillStudentApi.create(payload);
        toast.success('Đã tạo tài khoản học viên DewSkill.');
      }
      setFormOpen(false);
      await loadStudents();
    } catch (err) {
      toast.error(err?.message || 'Không lưu được thông tin học viên');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (student) => {
    const nextLocked = !student.accountLocked;
    if (nextLocked) {
      const ok = await cmsConfirmAction(
        `Khóa tài khoản DewSkill của "${student.name}" (${student.zalo || student.email || student.studentCode})?`,
        { confirmText: 'Khóa tài khoản', danger: true }
      );
      if (!ok) return;
    }
    setBusyId(student._id);
    try {
      await dewskillStudentApi.update(student._id, {
        accountLocked: nextLocked,
        accountLockReason: nextLocked ? 'Bị khóa bởi quản trị DewSkill' : '',
      });
      toast.success(nextLocked ? 'Đã khóa tài khoản học viên' : 'Đã mở khóa tài khoản học viên');
      await loadStudents();
    } catch (err) {
      toast.error(err?.message || 'Thao tác thất bại');
    } finally {
      setBusyId('');
    }
  };

  const handleTogglePackage = async (student) => {
    const nextUnlocked = !student.freeUnlocked;
    setBusyId(student._id);
    try {
      await dewskillStudentApi.update(student._id, {
        freeUnlocked: nextUnlocked,
        ...(nextUnlocked ? { planLabel: 'Gói DewSkill', planDays: 365 } : {}),
      });
      toast.success(nextUnlocked ? 'Đã kích hoạt gói học DewSkill' : 'Đã chuyển về tài khoản miễn phí');
      await loadStudents();
    } catch (err) {
      toast.error(err?.message || 'Không cập nhật được gói học');
    } finally {
      setBusyId('');
    }
  };

  const handleResetDevices = async (student) => {
    const ok = await cmsConfirmAction(
      `Xóa toàn bộ lịch sử thiết bị đã đăng nhập của "${student.name}" (bao gồm 2 thiết bị cố định và các phiên Web/Mobile cũ)? Học viên sẽ đăng xuất khỏi các máy cũ và đăng nhập lại để cập nhật máy mới.`,
      { confirmText: 'Reset thiết bị', danger: true }
    );
    if (!ok) return;

    setBusyId(student._id);
    try {
      const res = await dewskillStudentApi.resetDevices(student._id);
      toast.success(res?.message || 'Đã reset danh sách thiết bị');
      await loadStudents();
    } catch (err) {
      toast.error(err?.message || 'Không reset được thiết bị');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteStudent = async (student) => {
    const ok = await cmsConfirmAction(
      `Xóa vĩnh viễn tài khoản DewSkill "${student.name}" (${student.studentCode || student.zalo || ''})? Thao tác này không thể hoàn tác.`,
      { confirmText: 'Xóa tài khoản', danger: true }
    );
    if (!ok) return;

    setBusyId(student._id);
    try {
      await dewskillStudentApi.remove(student._id);
      toast.success(`Đã xóa học viên ${student.name}.`);
      await loadStudents();
    } catch (err) {
      toast.error(err?.message || 'Không xóa được học viên');
    } finally {
      setBusyId('');
    }
  };

  const openAssignClassesModal = async (student) => {
    setAssignStudent(student);
    const existingIds = (student.dewskillClasses || []).map((c) => String(c.classId));
    setSelectedClassIds(existingIds);
    setAccessLevel('full');
    setLoadingClasses(true);
    try {
      const res = await dewskillClassApi.list();
      const rows = res?.data?.items || res?.data?.classes || [];
      setAvailableClasses(Array.isArray(rows) ? rows : []);
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không tải được danh sách lớp học DewSkill'));
      setAvailableClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const toggleClassId = (id) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGrantClasses = async () => {
    if (!assignStudent?._id || selectedClassIds.length === 0 || granting) return;
    setGranting(true);
    try {
      await dewskillClassApi.grantAccess({
        studentIds: [assignStudent._id],
        classIds: selectedClassIds,
        accessLevel,
        autoEnableSelected: true,
      });
      toast.success(`Đã cấp ${selectedClassIds.length} lớp DewSkill cho ${assignStudent.name}`);
      setAssignStudent(null);
      await loadStudents();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không cấp được lớp học'));
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeClass = async (student, cls) => {
    const ok = await cmsConfirmAction(
      `Thu hồi quyền lớp "${cls.name}" khỏi học viên "${student.name}"?`,
      { confirmText: 'Thu hồi', danger: true }
    );
    if (!ok) return;
    setBusyId(student._id);
    try {
      await dewskillClassApi.revokeAccess(cls.accessId);
      toast.success(`Đã thu hồi lớp "${cls.name}"`);
      await loadStudents();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không thu hồi được lớp học'));
    } finally {
      setBusyId('');
    }
  };

  const groupedClasses = useMemo(() => {
    const map = new Map();
    for (const c of availableClasses) {
      const tier = c.tier || 'other';
      if (!map.has(tier)) map.set(tier, []);
      map.get(tier).push(c);
    }
    return [...map.entries()];
  }, [availableClasses]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <Sparkles size={13} /> Khu quản trị DewSkill
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-slate-900">
              Quản lý Học viên DewSkill
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Danh sách học viên thuộc hệ sinh thái DewSkill — tách biệt hoàn toàn khỏi danh sách học viên tại Trung tâm.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Plus size={16} /> Tạo học viên DewSkill
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
            <div className="text-xs font-semibold text-slate-500">Tổng học viên DewSkill</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{stats.all}</div>
          </div>
          <div className="rounded-xl border border-sky-200/80 bg-white p-3.5">
            <div className="text-xs font-semibold text-sky-600">Tài khoản miễn phí</div>
            <div className="mt-1 text-2xl font-extrabold text-sky-700">{stats.free}</div>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-white p-3.5">
            <div className="text-xs font-semibold text-emerald-600">Đã mở gói DewSkill</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">{stats.unlocked}</div>
          </div>
          <div className="rounded-xl border border-rose-200/80 bg-white p-3.5">
            <div className="text-xs font-semibold text-rose-600">Đang khóa</div>
            <div className="mt-1 text-2xl font-extrabold text-rose-700">{stats.locked}</div>
          </div>
        </div>
      </div>

      {/* Bộ lọc + Tìm kiếm */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((t) => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setFilter(t.key);
                  setPage(1);
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-80">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm tên, mã HV, SĐT, email..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Bảng danh sách */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-slate-500">
            <Loader2 size={18} className="animate-spin text-emerald-600" /> Đang tải danh sách học viên DewSkill...
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">Chưa có học viên DewSkill phù hợp</p>
            <p className="mt-1 text-xs text-slate-400">
              Nhấn &ldquo;Tạo học viên DewSkill&rdquo; hoặc thay đổi bộ lọc tìm kiếm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Liên hệ</th>
                  <th className="px-4 py-3">Lớp DewSkill đã cấp</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => {
                  const isBusy = busyId === st._id;
                  const classes = st.dewskillClasses || [];
                  const registeredDevices = Array.isArray(st.registeredDevices) ? st.registeredDevices : [];
                  const deviceCount = Number.isFinite(Number(st.registeredDeviceCount))
                    ? Number(st.registeredDeviceCount)
                    : registeredDevices.length;
                  const deviceTooltip = registeredDevices.length
                    ? registeredDevices
                        .map((d) => `Slot ${d.slot}: ${d.deviceLabel || d.os || d.platform || 'Thiết bị'}`)
                        .join(' · ')
                    : 'Chưa ghi nhận thiết bị cố định nào';
                  return (
                    <tr key={st._id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-slate-900">{st.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600">
                            {st.studentCode || 'Chưa có mã'}
                          </span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                            DewSkill
                          </span>
                          {st.freeSurvey?.gradeGroup && (
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                              {st.freeSurvey.gradeGroup}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-top text-xs text-slate-600">
                        {st.zalo && <div className="font-semibold text-slate-800">{st.zalo}</div>}
                        {st.email && <div className="mt-0.5 text-slate-500">{st.email}</div>}
                        <div className="mt-1 text-[11px] text-slate-400">
                          Tạo: {formatDate(st.createdAt) || '—'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {classes.map((c) => (
                            <span
                              key={c.accessId || c.classId}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                            >
                              {c.name}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleRevokeClass(st, c)}
                                title="Thu hồi lớp này"
                                className="ml-0.5 rounded text-emerald-600 hover:text-rose-600"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openAssignClassesModal(st)}
                            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                          >
                            <Layers size={12} /> Cấp lớp
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-col gap-1">
                          {st.accountLocked ? (
                            <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                              <Lock size={11} /> Đang khóa
                            </span>
                          ) : st.freeUnlocked ? (
                            <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={11} /> {st.subscription?.planLabel || 'Đã mở gói'}
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                              <UserCheck size={11} /> Miễn phí
                            </span>
                          )}
                          {st.freeUnlocked && st.subscription?.expiresAt && (
                            <span className="whitespace-nowrap text-[11px] text-slate-500">
                              HSD: {formatDate(st.subscription.expiresAt)}
                            </span>
                          )}
                          <span
                            title={deviceTooltip}
                            className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              deviceCount >= 2
                                ? 'border border-amber-200 bg-amber-50 text-amber-800'
                                : deviceCount > 0
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'text-slate-400'
                            }`}
                          >
                            <Laptop size={11} /> {deviceCount}/2 thiết bị
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleTogglePackage(st)}
                            title={st.freeUnlocked ? 'Chuyển về Miễn phí' : 'Mở gói DewSkill'}
                            className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                              st.freeUnlocked
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {st.freeUnlocked ? 'Tắt gói' : 'Mở gói'}
                          </button>
                          <DewskillRowActionMenu
                            student={st}
                            deviceCount={deviceCount}
                            isBusy={isBusy}
                            open={openMenuId === st._id}
                            onToggle={() => setOpenMenuId((cur) => (cur === st._id ? '' : st._id))}
                            onClose={() => setOpenMenuId('')}
                            onResetDevices={handleResetDevices}
                            onToggleLock={handleToggleLock}
                            onEdit={openEditModal}
                            onDelete={handleDeleteStudent}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang <strong>{pagination.page}</strong> / {pagination.totalPages} ({pagination.total} học viên)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 font-semibold disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 font-semibold disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tạo / Sửa học viên */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingStudent ? 'Cập nhật học viên DewSkill' : 'Tạo tài khoản học viên DewSkill'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Số điện thoại (Zalo)</label>
                  <input
                    type="text"
                    value={form.zalo}
                    onChange={(e) => setForm((f) => ({ ...f, zalo: e.target.value }))}
                    placeholder="09xxxxxxxx"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="hocvien@dewskill.vn"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <KeyRound size={13} />
                  {editingStudent ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu (mặc định là SĐT hoặc 123456 nếu để trống)'}
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editingStudent ? 'Nhập mật khẩu mới...' : 'Tối thiểu 4 ký tự...'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Cấp học / Nhóm đối tượng</label>
                  <input
                    type="text"
                    value={form.gradeGroup}
                    onChange={(e) => setForm((f) => ({ ...f, gradeGroup: e.target.value }))}
                    placeholder="VD: Cấp 2, MOS, Người đi làm"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Trình độ mục tiêu</label>
                  <input
                    type="text"
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    placeholder="VD: Lớp 7, Cơ bản..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.freeUnlocked}
                    onChange={(e) => setForm((f) => ({ ...f, freeUnlocked: e.target.checked }))}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Kích hoạt gói DewSkill (Mở toàn bộ bài tập & phòng thi)
                </label>

                {form.freeUnlocked && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">Tên gói</label>
                      <input
                        type="text"
                        value={form.planLabel}
                        onChange={(e) => setForm((f) => ({ ...f, planLabel: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">Số ngày hiệu lực</label>
                      <input
                        type="number"
                        min={0}
                        value={form.planDays}
                        onChange={(e) => setForm((f) => ({ ...f, planDays: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                )}

                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-rose-700">
                  <input
                    type="checkbox"
                    checked={form.accountLocked}
                    onChange={(e) => setForm((f) => ({ ...f, accountLocked: e.target.checked }))}
                    className="h-4 w-4 accent-rose-600"
                  />
                  Khóa tài khoản
                </label>
                {form.accountLocked && (
                  <input
                    type="text"
                    value={form.accountLockReason}
                    onChange={(e) => setForm((f) => ({ ...f, accountLockReason: e.target.value }))}
                    placeholder="Lý do khóa tài khoản..."
                    className="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingStudent ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cấp lớp DewSkill */}
      {assignStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Cấp lớp học DewSkill cho {assignStudent.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Chọn các lớp học được hiển thị trên Web & App của học viên này.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignStudent(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Mức truy cập:</span>
              <button
                type="button"
                onClick={() => setAccessLevel('full')}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${
                  accessLevel === 'full' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Mở toàn bộ lớp
              </button>
              <button
                type="button"
                onClick={() => setAccessLevel('preview')}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${
                  accessLevel === 'preview' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Chỉ học thử
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingClasses ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin text-emerald-600" /> Đang tải danh sách lớp...
                </div>
              ) : groupedClasses.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Chưa có lớp DewSkill nào. Vui lòng tạo lớp trong mục &ldquo;Quản lý lớp học&rdquo;.
                </div>
              ) : (
                groupedClasses.map(([tier, rows]) => (
                  <div key={tier} className="space-y-2">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      {TIER_META[tier]?.label || tier}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {rows.map((cls) => {
                        const checked = selectedClassIds.includes(String(cls._id));
                        return (
                          <label
                            key={cls._id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                              checked
                                ? 'border-emerald-500 bg-emerald-50/70'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleClassId(String(cls._id))}
                              className="mt-0.5 h-4 w-4 accent-emerald-600"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900">{cls.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {cls.code || 'Lớp DewSkill'} • {cls.visibilityMode}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
              <span className="text-xs font-semibold text-slate-500">
                Đã chọn {selectedClassIds.length} lớp học
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignStudent(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={selectedClassIds.length === 0 || granting}
                  onClick={handleGrantClasses}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {granting && <Loader2 size={14} className="animate-spin" />}
                  Cấp lớp đã chọn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
