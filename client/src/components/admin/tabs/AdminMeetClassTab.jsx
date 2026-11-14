import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, UserPlus, Users, Video, X } from 'lucide-react';
import meetClassApi from '../../../services/meetClassApi';
import subscriptionApi from '../../../services/subscriptionApi';
import { useToast } from '../../../utils/useToast';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

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
  const [subTab, setSubTab] = useState('schedule'); // 'schedule' | 'subscribers'
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
  const [meetStudents, setMeetStudents] = useState([]);
  const [meetStudentsLoading, setMeetStudentsLoading] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberFilter, setSubscriberFilter] = useState('all');
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

  const loadMeetStudents = () => {
    setMeetStudentsLoading(true);
    meetClassApi.eligibleStudents()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setMeetStudents(list);
        setEligibleCount(res?.count ?? list.length);
      })
      .catch((err) => toast.error(err.message || 'Không tải được danh sách học viên gói Meet'))
      .finally(() => setMeetStudentsLoading(false));
  };

  useEffect(() => {
    load();
    loadMeetStudents();
  }, []);

  useEffect(() => {
    if (inviteMode !== 'all') return undefined;
    let cancelled = false;
    setEligibleLoading(true);
    meetClassApi.eligibleStudents()
      .then((res) => {
        if (!cancelled) {
          const list = Array.isArray(res?.data) ? res.data : [];
          setMeetStudents(list);
          setEligibleCount(res.count ?? list.length);
        }
      })
      .catch(() => { if (!cancelled) setEligibleCount(null); })
      .finally(() => { if (!cancelled) setEligibleLoading(false); });
    return () => { cancelled = true; };
  }, [inviteMode]);

  const filteredMeetStudents = useMemo(() => {
    const q = subscriberSearch.trim().toLowerCase();
    return meetStudents
      .filter((st) => {
        const sub = st.subscription || {};
        if (subscriberFilter === 'lifetime' && sub.state !== 'lifetime' && !sub.meetLifetime) return false;
        if (subscriberFilter === 'expiring' && sub.state !== 'expiring') return false;
        if (subscriberFilter === 'active' && sub.state !== 'active') return false;
        if (!q) return true;
        return [st.name, st.phone, st.email, st.studentCode, sub.planLabel]
          .some((val) => String(val || '').toLowerCase().includes(q));
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
  }, [meetStudents, subscriberSearch, subscriberFilter]);

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
      toast.error(`${student.name || 'Học viên'} không phải tài khoản miễn phí - không dùng gói Meet online`);
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('schedule')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              subTab === 'schedule' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Video size={15} /> Xếp lịch &amp; Buổi Meet
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black ${
              subTab === 'schedule' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {rows.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('subscribers')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              subTab === 'subscribers' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users size={15} /> Học viên gói Meet
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black ${
              subTab === 'subscribers' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {meetStudents.length}
            </span>
          </button>
        </div>
        {subTab === 'subscribers' && (
          <button
            type="button"
            onClick={loadMeetStudents}
            disabled={meetStudentsLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {meetStudentsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Làm mới
          </button>
        )}
      </div>

      {subTab === 'subscribers' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${INPUT} pl-9`}
                value={subscriberSearch}
                onChange={(e) => setSubscriberSearch(e.target.value)}
                placeholder="Tìm theo tên, SĐT, email, mã HV, tên gói..."
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'lifetime', label: 'Vĩnh viễn' },
                { key: 'active', label: 'Đang hoạt động' },
                { key: 'expiring', label: 'Sắp hết hạn' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSubscriberFilter(opt.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    subscriberFilter === opt.key
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {meetStudentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Đang tải danh sách học viên gói Meet…
            </div>
          ) : filteredMeetStudents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm font-semibold text-slate-400">
              {meetStudents.length === 0
                ? 'Chưa có học viên Dewskill nào đăng ký gói Meet.'
                : 'Không tìm thấy học viên phù hợp với bộ lọc.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="w-12 px-3 py-3 text-center">STT</th>
                    <th className="px-3 py-3">Học viên</th>
                    <th className="px-3 py-3">Liên hệ</th>
                    <th className="px-3 py-3">Gói Meet</th>
                    <th className="px-3 py-3">Thời hạn</th>
                    <th className="px-3 py-3">Trạng thái</th>
                    <th className="w-36 px-3 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMeetStudents.map((st, idx) => {
                    const sub = st.subscription || {};
                    const isLifetime = sub.state === 'lifetime' || sub.meetLifetime;
                    const isExpiring = sub.state === 'expiring';
                    const expDate = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('vi-VN') : '';
                    return (
                      <tr key={st.id} className="align-middle transition hover:bg-emerald-50/30">
                        <td className="px-3 py-3 text-center text-xs font-black text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-slate-900">{st.name || 'Học viên'}</p>
                          {st.studentCode && (
                            <p className="text-[11px] font-semibold text-slate-400">{st.studentCode}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {st.phone && <p className="font-semibold text-slate-800">{st.phone}</p>}
                          {st.email && <p className="text-slate-500">{st.email}</p>}
                          {!st.phone && !st.email && <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {sub.planLabel || (isLifetime ? 'Vĩnh viễn' : 'Gói Meet')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {isLifetime ? (
                            <span className="font-bold text-amber-700">Không giới hạn</span>
                          ) : (
                            <span>
                              {expDate ? `${expDate} · ` : ''}
                              <strong>Còn {sub.daysLeft ?? 0} ngày</strong>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            isLifetime
                              ? 'bg-amber-100 text-amber-800'
                              : isExpiring
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isLifetime ? 'Vĩnh viễn' : isExpiring ? 'Sắp hết hạn' : 'Đang hoạt động'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setInviteMode('manual');
                              setSelected((prev) => (prev.some((x) => x.id === st.id)
                                ? prev
                                : [...prev, { id: st.id, name: st.name || 'Học viên', phone: st.phone || '' }]));
                              setSubTab('schedule');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            <UserPlus size={13} /> Mời học Meet
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <>
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-black text-slate-900">
          <Video size={18} className="text-red-600" /> Xếp lịch Meet
        </h2>
        <p className="mb-4 text-sm font-semibold text-slate-500">Dán link Google Meet. Chỉ học viên Dewskill đã mua gói Meet - không gồm học viên THANGTINHOC.</p>
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
        </>
      )}
    </div>
  );
}
