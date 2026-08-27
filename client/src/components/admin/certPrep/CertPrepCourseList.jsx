import { useRef, useState } from 'react';
import { Loader2, Pencil, Power, ChevronRight, Download, Upload } from 'lucide-react';
import CertPrepEmptyState from './CertPrepEmptyState';
import CertPrepConfirmDialog from './CertPrepConfirmDialog';

export default function CertPrepCourseList({
  courses,
  loading,
  onCreate,
  onEdit,
  onToggle,
  onOpen,
  onExport,
  onImport,
  busyCourseId = null,
}) {
  const fileRef = useRef(null);
  const [importTarget, setImportTarget] = useState(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const openImportPicker = (course) => {
    const cid = String(course._id || course.id);
    const keepReplace = replaceMode && String(importTarget?._id || importTarget?.id) === cid;
    setImportTarget(course);
    setReplaceMode(keepReplace);
    setPendingFile(null);
    setConfirmReplace(false);
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const onFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file || !importTarget) return;
    if (replaceMode) {
      setPendingFile(file);
      setConfirmReplace(true);
      return;
    }
    onImport?.(importTarget, file, { replace: false });
    setImportTarget(null);
  };

  if (loading) {
    return (
      <div className="cms-card flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} aria-hidden="true" /> Đang tải khóa học...
      </div>
    );
  }
  if (!courses?.length) {
    return (
      <CertPrepEmptyState
        title="Chưa có khóa học nào."
        hint="Tạo khóa MOS hoặc IC3 để bắt đầu ngân hàng ôn thi."
        actionLabel="Tạo khóa học"
        onAction={onCreate}
      />
    );
  }
  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={onFilePicked}
      />
      <div className="overflow-x-auto cms-card p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Mô tả</th>
              <th className="px-4 py-3">Thứ tự</th>
              <th className="px-4 py-3">Số Level</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const cid = c._id || c.id;
              const busy = String(busyCourseId || '') === String(cid);
              return (
                <tr key={cid} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.slug}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{c.description || '—'}</td>
                  <td className="px-4 py-3">{c.sortOrder}</td>
                  <td className="px-4 py-3">{c.levelCount ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${c.isActive === false ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {c.isActive === false ? 'Tắt' : 'Bật'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onExport?.(c)}
                        title="Xuất Excel câu hỏi"
                        aria-label={`Xuất Excel ${c.name}`}
                        className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-50 inline-flex items-center justify-center"
                      >
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openImportPicker(c)}
                        title="Nhập Excel câu hỏi"
                        aria-label={`Nhập Excel ${c.name}`}
                        className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-50 inline-flex items-center justify-center"
                      >
                        <Upload size={15} />
                      </button>
                      <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 px-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={replaceMode && String(importTarget?._id || importTarget?.id) === String(cid)}
                          onChange={(e) => {
                            setImportTarget(c);
                            setReplaceMode(e.target.checked);
                          }}
                          className="rounded border-slate-300"
                        />
                        Ghi đè
                      </label>
                      <button type="button" onClick={() => onOpen(c)} className="min-h-10 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                        Level <ChevronRight size={14} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onEdit(c)} aria-label={`Sửa ${c.name}`} className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-600">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => onToggle(c)} aria-label={c.isActive === false ? `Bật ${c.name}` : `Vô hiệu hóa ${c.name}`} className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-600">
                        <Power size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 px-1">
        Export/Import Excel theo môn (Level › Đề › Câu). Tick «Ghi đè» trước khi chọn file nếu muốn vô hiệu câu cũ rồi nhập lại.
      </p>
      <CertPrepConfirmDialog
        open={confirmReplace}
        title="Ghi đè toàn môn?"
        message={`Tất cả câu hỏi hiện có trong «${importTarget?.name || 'môn'}» sẽ bị vô hiệu hóa, rồi nhập lại từ file Excel. Bạn chắc chắn?`}
        confirmText="Ghi đè và nhập"
        loading={Boolean(busyCourseId)}
        onCancel={() => {
          setConfirmReplace(false);
          setPendingFile(null);
          setImportTarget(null);
          setReplaceMode(false);
        }}
        onConfirm={() => {
          if (importTarget && pendingFile) {
            onImport?.(importTarget, pendingFile, { replace: true });
          }
          setConfirmReplace(false);
          setPendingFile(null);
          setImportTarget(null);
          setReplaceMode(false);
        }}
      />
    </div>
  );
}
