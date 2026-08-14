import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import certPrepApi, { certPrepErrorMessage } from '../../../services/certPrepApi';

export default function CertPrepImageUploader({
  label,
  value,
  onChange,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const src = value ? resolveMediaUrl(value) : '';

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await certPrepApi.uploadImage(file);
      const url = res.data?.url || res.data?.fileUrl || '';
      if (!url) throw new Error('Upload không trả về URL');
      onChange(url);
    } catch (err) {
      setError(certPrepErrorMessage(err, 'Không tải được hình ảnh'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      {src ? (
        <div className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50">
          <img src={src} alt={label} className="max-h-40 w-full object-contain bg-white" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 h-24 flex items-center justify-center text-slate-400 text-xs">
          Chưa có hình
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="min-h-10 px-3 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-2 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
          {src ? 'Thay hình' : 'Chọn hình ảnh'}
        </button>
        {src ? (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => onChange('')}
            className="min-h-10 px-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
          >
            <Trash2 size={14} aria-hidden="true" />
            Xóa
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        aria-label={label}
        onChange={onPick}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
