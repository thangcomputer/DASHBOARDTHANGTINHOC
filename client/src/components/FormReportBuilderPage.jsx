import React, { useCallback, useEffect, useState } from 'react';
import {
  FormInput, FileSpreadsheet, Loader2, Plus, Trash2, RefreshCw,
  Download, Eye, Check, X,
} from 'lucide-react';
import { builderAPI } from '../services/api';
import { useToast } from '../utils/toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
];

function emptyField() {
  return { key: '', label: '', type: 'text', required: false, options: [], placeholder: '' };
}

export default function FormReportBuilderPage() {
  const toast = useToast();
  const [tab, setTab] = useState('forms');
  const [loading, setLoading] = useState(true);

  // forms
  const [forms, setForms] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState('draft');
  const [fields, setFields] = useState([emptyField()]);
  const [subs, setSubs] = useState(null);
  const [saving, setSaving] = useState(false);

  // reports
  const [reports, setReports] = useState([]);
  const [sources, setSources] = useState([]);
  const [repName, setRepName] = useState('');
  const [repSource, setRepSource] = useState('students');
  const [repColumns, setRepColumns] = useState([]);
  const [runResult, setRunResult] = useState(null);
  const [formsForReport, setFormsForReport] = useState([]);

  const loadForms = useCallback(async () => {
    const res = await builderAPI.listForms();
    if (res.success) setForms(res.data || []);
  }, []);

  const loadReports = useCallback(async () => {
    const [r, s, f] = await Promise.all([
      builderAPI.listReports(),
      builderAPI.listReportSources(),
      builderAPI.listForms('published'),
    ]);
    if (r.success) setReports(r.data || []);
    if (s.success) setSources(s.data || []);
    if (f.success) setFormsForReport(f.data || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadForms(), loadReports()]);
    } catch {
      toast.error('Không tải được builder');
    } finally {
      setLoading(false);
    }
  }, [loadForms, loadReports, toast]);

  useEffect(() => { load(); }, [load]);

  const startNewForm = () => {
    setEditing('new');
    setFormName('');
    setFormDesc('');
    setFormStatus('draft');
    setFields([emptyField()]);
    setSubs(null);
  };

  const editForm = (f) => {
    setEditing(f._id);
    setFormName(f.name);
    setFormDesc(f.description || '');
    setFormStatus(f.status);
    setFields(f.fields?.length ? f.fields.map((x) => ({ ...x, options: x.options || [] })) : [emptyField()]);
    setSubs(null);
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDesc,
        status: formStatus,
        fields: fields.filter((f) => f.label.trim()),
      };
      const res = editing === 'new'
        ? await builderAPI.createForm(payload)
        : await builderAPI.updateForm(editing, payload);
      if (res.success) {
        toast.success('Đã lưu form');
        setEditing(null);
        await loadForms();
      } else toast.error(res.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const removeForm = async (id) => {
    if (!window.confirm('Xóa form và toàn bộ bài nộp?')) return;
    const res = await builderAPI.deleteForm(id);
    if (res.success) {
      toast.success('Đã xóa');
      if (editing === id) setEditing(null);
      loadForms();
    }
  };

  const viewSubs = async (f) => {
    const res = await builderAPI.listSubmissions(f._id);
    if (res.success) setSubs({ form: f, ...res });
  };

  const sourceMeta = sources.find((s) => s.key === repSource) || sources.find((s) => s.key === 'students');
  const availableColumns = repSource.startsWith('form:')
    ? ['createdAt', 'submittedBy', ...(formsForReport.find((f) => `form:${f._id}` === repSource)?.fields || []).map((x) => x.key)]
    : (sourceMeta?.columns || []);

  const toggleCol = (col) => {
    setRepColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const saveReport = async () => {
    setSaving(true);
    try {
      const res = await builderAPI.createReport({
        name: repName,
        source: repSource,
        columns: repColumns,
      });
      if (res.success) {
        toast.success('Đã tạo báo cáo');
        setRepName('');
        setRepColumns([]);
        await loadReports();
      } else toast.error(res.message || 'Lỗi');
    } finally {
      setSaving(false);
    }
  };

  const runReport = async (id) => {
    const res = await builderAPI.runReport(id);
    if (res.success) setRunResult(res.data);
    else toast.error(res.message || 'Chạy báo cáo thất bại');
  };

  if (loading) {
    return <div className="p-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <FormInput className="text-sky-600" size={22} /> Form & Report Builder
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">Tạo form thu thập · báo cáo CSV từ dữ liệu hệ thống</p>
        </div>
        <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('forms')} className={`px-3 py-2 rounded-xl text-xs font-bold border ${tab === 'forms' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-gray-200'}`}>Forms</button>
        <button type="button" onClick={() => setTab('reports')} className={`px-3 py-2 rounded-xl text-xs font-bold border ${tab === 'reports' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-gray-200'}`}>Reports</button>
      </div>

      {tab === 'forms' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <button type="button" onClick={startNewForm} className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold flex items-center justify-center gap-2">
              <Plus size={16} /> Form mới
            </button>
            <ul className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
              {forms.length === 0 ? (
                <li className="p-6 text-center text-xs text-gray-400 font-bold">Chưa có form</li>
              ) : forms.map((f) => (
                <li key={f._id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{f.slug} · {f.status} · {f.fields?.length || 0} fields</p>
                  </div>
                  <button type="button" onClick={() => editForm(f)} className="text-xs font-bold text-sky-600 px-2">Sửa</button>
                  <button type="button" onClick={() => viewSubs(f)} className="p-1.5 text-gray-400 hover:text-sky-600"><Eye size={14} /></button>
                  <button type="button" onClick={() => builderAPI.exportSubmissions(f._id, f.slug)} className="p-1.5 text-gray-400 hover:text-emerald-600"><Download size={14} /></button>
                  <button type="button" onClick={() => removeForm(f._id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {subs && (
              <div className="bg-white border border-gray-100 rounded-2xl p-3 text-xs">
                <p className="font-black text-gray-700 mb-2">Bài nộp: {subs.form.name} ({subs.pagination?.total || 0})</p>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {(subs.data || []).map((s) => (
                    <li key={s._id} className="border border-gray-50 rounded-lg p-2 font-mono text-[10px] text-gray-600">
                      {JSON.stringify(s.answers)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {editing && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
              <p className="text-sm font-black text-gray-800">{editing === 'new' ? 'Tạo form' : 'Sửa form'}</p>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Tên form" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Mô tả" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold">
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase">Fields</p>
                {fields.map((f, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-2 space-y-1">
                    <div className="flex gap-2">
                      <input value={f.label} onChange={(e) => {
                        const next = [...fields];
                        next[i] = { ...f, label: e.target.value, key: f.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') };
                        setFields(next);
                      }} placeholder="Label" className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold" />
                      <select value={f.type} onChange={(e) => {
                        const next = [...fields];
                        next[i] = { ...f, type: e.target.value };
                        setFields(next);
                      }} className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
                        {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                        <input type="checkbox" checked={f.required} onChange={(e) => {
                          const next = [...fields];
                          next[i] = { ...f, required: e.target.checked };
                          setFields(next);
                        }} /> req
                      </label>
                      <button type="button" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="text-red-400"><X size={14} /></button>
                    </div>
                    {f.type === 'select' && (
                      <input
                        value={(f.options || []).join(', ')}
                        onChange={(e) => {
                          const next = [...fields];
                          next[i] = { ...f, options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) };
                          setFields(next);
                        }}
                        placeholder="Options: A, B, C"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs"
                      />
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setFields([...fields, emptyField()])} className="text-xs font-bold text-sky-600 flex items-center gap-1">
                  <Plus size={12} /> Thêm field
                </button>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={saveForm} disabled={saving} className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40">
                  {saving ? <Loader2 className="animate-spin inline" size={14} /> : <Check size={14} className="inline" />} Lưu
                </button>
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold">Hủy</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
            <p className="text-sm font-black text-gray-800 flex items-center gap-2"><FileSpreadsheet size={16} /> Tạo báo cáo</p>
            <input value={repName} onChange={(e) => setRepName(e.target.value)} placeholder="Tên báo cáo" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
            <select
              value={repSource}
              onChange={(e) => { setRepSource(e.target.value); setRepColumns([]); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
            >
              {sources.filter((s) => s.key !== 'form').map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
              {formsForReport.map((f) => (
                <option key={f._id} value={`form:${f._id}`}>Form: {f.name}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {availableColumns.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggleCol(col)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${repColumns.includes(col) ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  {col}
                </button>
              ))}
            </div>
            <button type="button" onClick={saveReport} disabled={saving || !repName || !repColumns.length} className="w-full py-2 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40">
              Lưu báo cáo
            </button>
          </div>

          <div className="space-y-3">
            <ul className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
              {reports.length === 0 ? (
                <li className="p-6 text-center text-xs text-gray-400 font-bold">Chưa có báo cáo</li>
              ) : reports.map((r) => (
                <li key={r._id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{r.source} · {(r.columns || []).length} cột</p>
                  </div>
                  <button type="button" onClick={() => runReport(r._id)} className="text-xs font-bold text-sky-600">Chạy</button>
                  <button type="button" onClick={() => builderAPI.exportReport(r._id, r.name)} className="p-1.5 text-gray-400 hover:text-emerald-600"><Download size={14} /></button>
                  <button type="button" onClick={async () => { await builderAPI.deleteReport(r._id); loadReports(); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>

            {runResult && (
              <div className="bg-white border border-gray-100 rounded-2xl p-3 overflow-x-auto">
                <p className="text-xs font-black text-gray-700 mb-2">{runResult.report?.name} · {runResult.total} dòng</p>
                <table className="text-[10px] w-full">
                  <thead>
                    <tr className="text-left text-gray-400">
                      {(runResult.columns || []).map((c) => <th key={c} className="pr-2 pb-1">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(runResult.rows || []).slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-gray-50 text-gray-700">
                        {(runResult.columns || []).map((c) => <td key={c} className="pr-2 py-1 max-w-[120px] truncate">{String(row[c] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}