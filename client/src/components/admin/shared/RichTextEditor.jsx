import React from 'react';
import { applyAnchorNewTabPolicy } from '../../../utils/htmlContent';

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = React.useRef(null);
  const hasInitialized = React.useRef(false);
  const [showLinkInput, setShowLinkInput] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const savedSelection = React.useRef(null);

  React.useEffect(() => {
    if (editorRef.current && !hasInitialized.current) {
      editorRef.current.innerHTML = value || '';
      hasInitialized.current = true;
    }
  }, []);

  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (!hasInitialized.current || value === '') {
        editorRef.current.innerHTML = value || '';
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
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
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

  // Image upload → base64
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      restoreSelection();
      editorRef.current?.focus();
      document.execCommand('insertImage', false, ev.target.result);
      handleInput();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
        <select
          onMouseDown={e => { e.stopPropagation(); saveSelection(); }}
          onChange={e => { if (e.target.value) { editorRef.current?.focus(); restoreSelection(); document.execCommand('formatBlock', false, e.target.value); saveSelection(); handleInput(); } e.target.selectedIndex = 0; }}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white mr-1 cursor-pointer" defaultValue="">
          <option value="" disabled>Heading</option>
          <option value="h1">Tiêu đề 1</option>
          <option value="h2">Tiêu đề 2</option>
          <option value="h3">Tiêu đề 3</option>
          <option value="p">Bình thường</option>
        </select>
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
        <label className={btnClass + " relative overflow-hidden"} title="Chèn hình ảnh" onMouseDown={e => e.stopPropagation()}>
          🖼️
          <input type="file" accept="image/*"
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
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition">Chèn</button>
          <button type="button" onClick={() => setShowLinkInput(false)}
            className="text-gray-400 hover:text-gray-600 text-xs">Huỷ</button>
        </div>
      )}

      {/* Editor area */}
      <div ref={editorRef}
        contentEditable
        onInput={handleInput}
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
