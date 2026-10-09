import React from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { applyAnchorNewTabPolicy, sanitizeRichHtml } from '../../../utils/htmlContent';
import api, { resolveMediaUrl } from '../../../services/api';

function hydrateEditorHtml(html) {
  return String(html || '').replace(
    /(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
    (_, pre, src, post) => `${pre}${resolveMediaUrl(src) || src}${post}`,
  );
}

/** Giữ path /uploads/... khi lưu (payload nhỏ, không phụ thuộc origin). */
function normalizeEditorHtmlForSave(root) {
  if (!root) return '';
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const m = src.match(/\/uploads\/[^\s?#]+/i);
    if (m) img.setAttribute('src', m[0]);
  });
  return root.innerHTML;
}

function imageFileFromDataUrl(dataUrl, index) {
  return fetch(dataUrl).then((response) => response.blob()).then((blob) => (
    new File([blob], `pasted-image-${index + 1}`, { type: blob.type || 'image/png' })
  ));
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = React.useRef(null);
  const hasInitialized = React.useRef(false);
  const [showLinkInput, setShowLinkInput] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [headingPick, setHeadingPick] = React.useState('');
  const [imageUploading, setImageUploading] = React.useState(false);
  const savedSelection = React.useRef(null);

  React.useEffect(() => {
    if (editorRef.current && !hasInitialized.current) {
      editorRef.current.innerHTML = hydrateEditorHtml(value || '');
      hasInitialized.current = true;
    }
  }, []);

  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (!hasInitialized.current || value === '') {
        editorRef.current.innerHTML = hydrateEditorHtml(value || '');
        hasInitialized.current = true;
      }
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(cmd, false, val);
    saveSelection();
    handleInput();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    // Không đổi src trên DOM đang hiện — chỉ normalize bản clone khi lưu
    const clone = editorRef.current.cloneNode(true);
    onChange(normalizeEditorHtmlForSave(clone));
  };

  const handlePaste = async (event) => {
    const html = event.clipboardData?.getData('text/html') || '';
    const imageFiles = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === 'file' && String(item.type || '').startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    const container = document.createElement('div');
    if (html) container.innerHTML = html;
    const canInsertHtml = !!html;
    const pendingUploads = [];
    const pastedImages = [...container.querySelectorAll('img')];

    for (const [index, image] of pastedImages.entries()) {
      const clipboardFile = imageFiles[index];
      if (clipboardFile) {
        pendingUploads.push({ image, file: Promise.resolve(clipboardFile) });
        continue;
      }
      let src = String(image.getAttribute('src') || '').trim();
      const lazySrc = image.getAttribute('data-src')
        || image.getAttribute('data-original')
        || image.getAttribute('data-lazy-src')
        || '';
      if (lazySrc) {
        src = String(lazySrc).trim();
        image.setAttribute('src', src);
      }
      image.removeAttribute('srcset');
      if (/^data:image\//i.test(src)) {
        pendingUploads.push({ image, file: imageFileFromDataUrl(src, pendingUploads.length) });
      } else if (/^(?:blob|file|cid):/i.test(src) || !src) {
        image.remove();
      }
    }
    if (pastedImages.length === 0) {
      for (const file of imageFiles) {
        pendingUploads.push({ image: null, file: Promise.resolve(file) });
      }
    }

    if (!canInsertHtml && pendingUploads.length === 0) return;
    event.preventDefault();
    saveSelection();

    let uploadFailed = false;
    if (pendingUploads.length > 0) {
      setImageUploading(true);
      try {
        for (const pending of pendingUploads) {
          const file = await pending.file;
          const data = await api.settings.uploadTrainingFile(file);
          const storedUrl = String(data?.fileUrl || '').trim();
          if (!data?.success || !storedUrl) {
            throw new Error(data?.message || 'Upload ảnh dán thất bại');
          }
          const imageUrl = resolveMediaUrl(storedUrl) || storedUrl;
          if (pending.image) {
            pending.image.setAttribute('src', imageUrl);
            pending.image.removeAttribute('srcset');
          } else {
            const image = document.createElement('img');
            image.setAttribute('src', imageUrl);
            image.setAttribute('alt', '');
            container.appendChild(image);
          }
        }
      } catch (err) {
        window.alert?.(err?.message || 'Không tải được ảnh đã dán');
        uploadFailed = true;
      } finally {
        setImageUploading(false);
      }
    }

    if (uploadFailed) {
      container.querySelectorAll('img').forEach((image) => {
        const src = image.getAttribute('src') || '';
        if (!/^https?:\/\//i.test(src) && !src.startsWith('/uploads/')) image.remove();
      });
    }
    const safeHtml = sanitizeRichHtml(canInsertHtml || container.childNodes.length ? container.innerHTML : '');
    if (!safeHtml) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, safeHtml);
    saveSelection();
    handleInput();
  };

  // Color picker handlers
  const handleFgColor = (e) => {
    restoreSelection();
    exec('foreColor', e.target.value);
  };
  const handleBgColor = (e) => {
    restoreSelection();
    exec('hiliteColor', e.target.value);
  };

  // Image → upload /uploads (tránh base64 vượt JSON 50kb khi lưu training)
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      window.alert?.('Chỉ chọn file ảnh (JPG, PNG, WEBP, GIF).');
      return;
    }
    setImageUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      const storedUrl = String(data?.fileUrl || '').trim();
      if (!data?.success || !storedUrl) {
        throw new Error(data?.message || 'Upload ảnh thất bại');
      }
      restoreSelection();
      editorRef.current?.focus();
      const displayUrl = resolveMediaUrl(storedUrl) || storedUrl;
      document.execCommand('insertImage', false, displayUrl);
      handleInput();
    } catch (err) {
      window.alert?.(err?.message || 'Không tải được ảnh');
    } finally {
      setImageUploading(false);
    }
  };

  // Link insertion
  const openLinkInput = () => {
    saveSelection();
    setLinkUrl('');
    setShowLinkInput(true);
  };
  const applyLink = () => {
    if (linkUrl.trim()) {
      restoreSelection();
      exec('createLink', linkUrl.trim().startsWith('http') ? linkUrl.trim() : 'https://' + linkUrl.trim());
      if (editorRef.current) applyAnchorNewTabPolicy(editorRef.current);
      handleInput();
    }
    setShowLinkInput(false);
  };

  const btnClass = "p-1.5 rounded hover:bg-purple-100 text-gray-600 hover:text-purple-700 transition text-xs font-bold cursor-pointer select-none";

  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-400 transition relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-gray-50 border-b border-gray-200"
        onMouseDown={e => e.preventDefault()}>
        <CmsSelect
          value={headingPick}
          onMouseDown={e => { e.stopPropagation(); saveSelection(); }}
          onChange={e => {
            const v = e.target.value;
            if (v) {
              editorRef.current?.focus();
              restoreSelection();
              document.execCommand('formatBlock', false, v);
              saveSelection();
              handleInput();
            }
            setHeadingPick('');
          }}
          className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white mr-1 min-h-0 !py-1 !px-1.5 !rounded-lg"
          wrapperClassName="inline-block w-auto"
        >
          <option value="" disabled>Heading</option>
          <option value="h1">Tiêu đề 1</option>
          <option value="h2">Tiêu đề 2</option>
          <option value="h3">Tiêu đề 3</option>
          <option value="p">Bình thường</option>
        </CmsSelect>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Text formatting */}
        <button type="button" onClick={() => exec('bold')} className={btnClass} title="In đậm (Ctrl+B)"><b>B</b></button>
        <button type="button" onClick={() => exec('italic')} className={btnClass} title="In nghiêng (Ctrl+I)"><i>I</i></button>
        <button type="button" onClick={() => exec('underline')} className={btnClass} title="Gạch chân (Ctrl+U)"><u>U</u></button>
        <button type="button" onClick={() => exec('strikeThrough')} className={btnClass} title="Gạch ngang"><s>S</s></button>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Color pickers - native input[type=color] hidden behind buttons */}
        <label className={btnClass + " relative overflow-hidden"} title="Màu chữ" onMouseDown={e => e.stopPropagation()}>
          <span className="flex items-center gap-0.5">A<span className="w-3 h-1.5 rounded-sm bg-red-500 block" /></span>
          <input type="color" defaultValue="#ff0000"
            onMouseDown={e => { e.stopPropagation(); saveSelection(); }}
            onChange={handleFgColor}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </label>
        <label className={btnClass + " relative overflow-hidden"} title="Tô nền chữ" onMouseDown={e => e.stopPropagation()}>
          <span className="flex items-center gap-0.5">A<span className="w-3 h-1.5 rounded-sm bg-yellow-300 block" /></span>
          <input type="color" defaultValue="#ffff00"
            onMouseDown={e => { e.stopPropagation(); saveSelection(); }}
            onChange={handleBgColor}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </label>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Lists */}
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnClass} title="Danh sách chấm">• ≡</button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={btnClass} title="Danh sách số">1. ≡</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Link */}
        <button type="button" onClick={openLinkInput} className={btnClass} title="Chèn liên kết">🔗</button>

        {/* Image upload */}
        <label
          className={btnClass + ` relative overflow-hidden ${imageUploading ? 'opacity-50 pointer-events-none' : ''}`}
          title={imageUploading ? 'Đang tải ảnh...' : 'Chèn hình ảnh'}
          onMouseDown={e => e.stopPropagation()}
        >
          {imageUploading ? '…' : '🖼️'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={imageUploading}
            onMouseDown={e => { e.stopPropagation(); saveSelection(); }}
            onChange={handleImageUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </label>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Clear */}
        <button type="button" onClick={() => exec('removeFormat')} className={btnClass} title="Xoá định dạng">✕</button>
      </div>

      {/* Inline link input panel */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-200" onMouseDown={e => e.stopPropagation()}>
          <span className="text-xs font-bold text-blue-600">🔗 URL:</span>
          <input
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
            placeholder="https://example.com"
            className="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            autoFocus
          />
          <button type="button" onClick={applyLink}
            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition">Chèn</button>
          <button type="button" onClick={() => setShowLinkInput(false)}
            className="text-gray-400 hover:text-gray-600 text-xs">Huỷ</button>
        </div>
      )}

      {/* Editor area */}
      <div ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        className="min-h-[200px] px-4 py-3 text-sm text-gray-800 leading-relaxed outline-none"
        style={{ wordBreak: 'break-word' }}
        data-placeholder={placeholder || 'Nhập nội dung...'}
        suppressContentEditableWarning
      />
      <style>{`
        [data-placeholder]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }
        [contenteditable] img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
        [contenteditable] a { color: #6366f1; text-decoration: underline; }
        [contenteditable] ul { list-style: disc; padding-left: 1.5em; margin: 4px 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.5em; margin: 4px 0; }
        [contenteditable] li { margin: 2px 0; }
        [contenteditable] h1 { font-size: 1.75em; font-weight: 700; margin: 8px 0 4px; }
        [contenteditable] h2 { font-size: 1.4em; font-weight: 700; margin: 6px 0 3px; }
        [contenteditable] h3 { font-size: 1.15em; font-weight: 700; margin: 4px 0 2px; }
      `}</style>
    </div>
  );
};
