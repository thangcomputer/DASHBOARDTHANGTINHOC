import { useEffect, useMemo, useState } from 'react';
import { Loader2, Video, X } from 'lucide-react';
import meetClassApi from '../../../services/meetClassApi';
import subscriptionApi from '../../../services/subscriptionApi';
import { useToast } from '../../../utils/useToast';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100';

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function formatDay(day) {
  const [year, month, date] = String(day || '').split('-');
  if (!year || !month || !date) return day || '';
  return `${date}/${month}/${year}`;
}

export default function AdminMeetClassTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(todayKey);
  const [slot, setSlot] = useState('evening');
  const [customStart, setCustomStart] = useState('19:00');
  const [customEnd, setCustomEnd] = useState('21:00');
  const [note, setNote] = useState('');
  const [linkHoc, setLinkHoc] = useState('');
  const [inviteMode, setInviteMode] = useState('manual');
  const [eligibleCount, setEligibleCount] = useState(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [selected, setSelected] = useState([]);

  const load = () => {
    setLoading(true);
    meetClassApi.list()
      .then((data) => {
        setRows(data.data || []);
        setSlots(data.slots || {});
      })
      .catch((err) => toast.error(err.message || 'Không tải được lịch Meet'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (inviteMode !== 'all') {
      setEligibleCount(null);
      return undefined;
    }
    let cancelled = false;
    setEligibleLoading(true);
    meetClassApi.eligibleStudents()
      .then((res) => {
        if (!cancelled) setEligibleCount(res.count ?? (res.data || []).length);
      })
      .catch(() => { if (!cancelled) setEligibleCount(null); })
      .finally(() => { if (!cancelled) setEligibleLoading(false); });
    return () => { cancelled = true; };
  }, [inviteMode]);

  useEffect(() => {
    if (inviteMode !== 'manual') return undefined;
    const text = query.trim();
    if (text.length < 2) {
      setFound([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      subscriptionApi.admin.searchStudents(text)
        .then((list) => { if (!cancelled) setFound(Array.isArray(list) ? list : []); })
        .catch(() => { if (!cancelled) setFound([]); });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, inviteMode]);

  const slotList = useMemo(() => Object.entries(slots), [slots]);
  const chosenSlot = slot === 'custom' ? null : slots[slot];
  const isCustomSlot = slot === 'custom';

  const addStudent = (student) => {
    if (student?.freePortal !== true) {
      toast.error(`${student.name || 'Học viên'} không phải tài khoản miễn phí — không dùng gói Meet online`);
      return;
    }
    const sub = student?.subscription;
    const ok = sub && !sub.freeTier && sub.state !== 'expired';
    if (!ok) {
      toast.error(`${student.name || 'Học viên'} chưa có gói Meet`);
      return;
    }
    setSelected((prev) => (prev.some((item) => item.id === student.id) ? prev : [...prev, { id: student.id, name: student.name || 'Học viên', phone: student.phone || '' }]));
    setQuery('');
    setFound([]);
  };

  const canCreate = inviteMode === 'all'
    ? Boolean(eligibleCount) && linkHoc.trim()
    : selected.length > 0 && linkHoc.trim() && (!isCustomSlot || (customStart && customEnd));

  const create = async () => {
    setBusy(true);
    try {
      await meetClassApi.create({
        day,
        slot,
        ...(isCustomSlot ? { startTime: customStart, endTime: customEnd } : {}),
        note,
        linkHoc: linkHoc.trim(),
        allMeetPackage: inviteMode === 'all',
        studentIds: inviteMode === 'manual' ? selected.map((student) => student.id) : [],
      });
      toast.success('Đã tạo buổi Meet');
      setNote('');
      setSelected([]);
      setInviteMode('manual');
      load();
    } catch (err) {
      toast.error(err.message || 'Không tạo được buổi Meet');
    } finally {
      setBusy(false);
    }
  };

  const saveLink = async (id, nextLink) => {
    const trimmed = String(nextLink || '').trim();
    if (!trimmed) {
      toast.error('Hãy dán link Meet');
      return;
    }
    try {
      await meetClassApi.setLink(id, trimmed);
      toast.success('Đã lưu link Meet');
      load();
    } catch (err) {
      toast.error(err.message || 'Không lưu được link');
    }
  };

  const cancel = async (id) => {
    try {
      await meetClassApi.cancel(id);
      toast.success('Đã hủy buổi Meet');
      load();
    } catch (err) {
      toast.error(err.message || 'Không hủy được');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-black text-slate-900">
          <Video size={18} className="text-red-600" /> Xếp lịch Meet
        </h2>
        <p className="mb-4 text-sm font-semibold text-slate-500">Dán link Google Meet. Chỉ tài khoản miễn phí đã mua gói Meet — không gồm học viên đăng ký khóa học truyền thống.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-600">
            Ngày
            <input type="date" className={`${INPUT} mt-1`} value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Ca học
            <select className={`${INPUT} mt-1`} value={slot} onChange={(e) => setSlot(e.target.value)}>
              {(slotList.length ? slotList : [['evening', { label: 'Tối', startTime: '19:00', endTime: '21:00' }]]).map(([id, item]) => (
                <option key={id} value={id}>{item.label} {item.startTime}–{item.endTime}</option>
              ))}
              <option value="custom">Giờ tùy chọn</option>
            </select>
          </label>
          {isCustomSlot ? (
            <>
              <label className="block text-xs font-bold text-slate-600">
                Giờ bắt đầu
                <input type="time" className={`${INPUT} mt-1`} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Giờ kết thúc
                <input type="time" className={`${INPUT} mt-1`} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </label>
            </>
          ) : null}
          <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
            Link Google Meet
            <input className={`${INPUT} mt-1`} value={linkHoc} onChange={(e) => setLinkHoc(e.target.value)} placeholder="https://meet.google.com/..." />
          </label>
          <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
            Ghi chú
            <input className={`${INPUT} mt-1`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Word cơ bản" />
          </label>
        </div>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-bold text-slate-600">Học viên tham gia</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="radio" name="inviteMode" checked={inviteMode === 'all'} onChange={() => setInviteMode('all')} />
            Tất cả HV cổng miễn phí đang có gói Meet
            {inviteMode === 'all' && eligibleLoading ? <Loader2 size={14} className="animate-spin text-slate-400" /> : null}
            {inviteMode === 'all' && !eligibleLoading && eligibleCount != null ? (
              <span className="text-xs font-bold text-red-600">({eligibleCount} người, tối đa 100/buổi)</span>
            ) : null}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="radio" name="inviteMode" checked={inviteMode === 'manual'} onChange={() => setInviteMode('manual')} />
            Chọn thủ công
          </label>
        </fieldset>
        {inviteMode === 'manual' ? (
          <div className="mt-2">
            <input className={INPUT} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Gõ tên hoặc số điện thoại" />
            {found.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-auto rounded-xl border border-slate-100">
                {found.map((student) => (
                  <li key={student.id}>
                    <button type="button" onClick={() => addStudent(student)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-red-50">
                      <span className="font-bold text-slate-800">{student.name}</span>
                      <span className="text-xs text-slate-400">{student.phone || student.studentCode || ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map((student) => (
                  <span key={student.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {student.name}
                    <button type="button" aria-label={`Bỏ ${student.name}`} onClick={() => setSelected((prev) => prev.filter((item) => item.id !== student.id))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <button type="button" onClick={create} disabled={busy || !canCreate} className="cms-btn cms-btn-primary mt-4 !py-2 text-sm disabled:opacity-50">
          {busy && <Loader2 size={14} className="animate-spin" />} Tạo buổi Meet
        </button>
        {chosenSlot && <p className="mt-2 text-xs font-semibold text-slate-400">Ca {chosenSlot.label}: {chosenSlot.startTime}–{chosenSlot.endTime}</p>}
        {isCustomSlot && <p className="mt-2 text-xs font-semibold text-slate-400">Giờ tùy chọn: {customStart}–{customEnd}</p>}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-black text-slate-900">Buổi đã xếp</h3>
        {loading ? <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Đang tải…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm font-semibold text-slate-400">Chưa có buổi Meet.</p> : null}
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-100 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {formatDay(row.day)} · {row.slotLabel || 'Ca'} {row.startTime}–{row.endTime}
                    {row.inviteAllMeetPackage ? ' · Toàn bộ gói Meet' : ''}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {row.students?.length ? row.students.map((student) => student.name).join(', ') : `${row.studentCount} học viên`}
                  </p>
                  {row.status === 'scheduled' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        defaultValue={row.linkHoc || ''}
                        placeholder="Link Google Meet"
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== (row.linkHoc || '').trim()) saveLink(row.id, value);
                        }}
                      />
                      {row.linkHoc ? (
                        <a href={row.linkHoc} target="_blank" rel="noopener noreferrer" className="cms-btn cms-btn-primary !py-1.5 text-xs">Mở Meet</a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {row.status === 'scheduled' ? (
                  <button type="button" onClick={() => cancel(row.id)} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-600">Hủy buổi</button>
                ) : <span className="text-xs font-bold text-slate-400">Đã hủy</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
