/**
 * Editor soạn tin tức nội bộ — bold/heading/list/link/ảnh.
 * Dùng contentEditable + execCommand với trạng thái Active nổi bật cho Toolbar.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3,
  Link2, ImagePlus, AlignLeft, AlignCenter, Quote,
} from 'lucide-react';

function ToolbarBtn({ onClick, title, children, disabled, active }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // giữ selection trong editor
        onClick?.();
      }}
      className={`p-1.5 rounded-lg transition-all duration-150 disabled:opacity-40 flex items-center justify-center min-w-[28px] h-7 text-xs ${
        active
          ? 'bg-blue-600 text-white font-bold shadow-sm ring-1 ring-blue-400 scale-105'
          : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

const NewsRichEditor = forwardRef(function NewsRichEditor(
  { value = '', onChange, disabled = false, onRequestImage },
  ref,
) {
  const elRef = useRef(null);
  const lastHtml = useRef('');

  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    h2: false,
    h3: false,
    blockquote: false,
    ul: false,
    ol: false,
    center: false,
  });

  const checkActiveStates = useCallback(() => {
    if (!elRef.current) return;
    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');
      const isUnderline = document.queryCommandState('underline');
      const isUl = document.queryCommandState('insertUnorderedList');
      const isOl = document.queryCommandState('insertOrderedList');
      const isCenter = document.queryCommandState('justifyCenter');

      let blockTag = '';
      try {
        blockTag = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      } catch {}

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node = sel.getRangeAt(0).startContainer;
        while (node && node !== elRef.current) {
          if (node.nodeType === 1) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'h2' || tag === 'h3' || tag === 'blockquote') {
              blockTag = tag;
              break;
            }
          }
          node = node.parentNode;
        }
      }

      setActiveStates({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        h2: blockTag === 'h2',
        h3: blockTag === 'h3',
        blockquote: blockTag === 'blockquote',
        ul: isUl,
        ol: isOl,
        center: isCenter,
      });
    } catch {}
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const next = value || '';
    if (next !== lastHtml.current && next !== el.innerHTML) {
      el.innerHTML = next;
      lastHtml.current = next;
    }
  }, [value]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (document.activeElement === elRef.current || elRef.current?.contains(document.activeElement)) {
        checkActiveStates();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [checkActiveStates]);

  const emit = () => {
    const html = elRef.current?.innerHTML || '';
    lastHtml.current = html;
    onChange?.(html);
    checkActiveStates();
  };

  const run = (cmd, arg = null) => {
    if (disabled) return;
    elRef.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
    setTimeout(checkActiveStates, 20);
  };

  const insertImageAtCursor = (url, alt = '') => {
    if (!url || disabled) return;
    elRef.current?.focus();
    const safeUrl = String(url).replace(/"/g, '&quot;');
    const safeAlt = String(alt || '').replace(/"/g, '&quot;');
    document.execCommand(
      'insertHTML',
      false,
      `<p><img src="${safeUrl}" alt="${safeAlt}" style="max-width:100%;height:auto;border-radius:12px" /></p><p><br></p>`,
    );
    emit();
  };

  useImperativeHandle(ref, () => ({
    insertImage: insertImageAtCursor,
    focus: () => elRef.current?.focus(),
    getHtml: () => elRef.current?.innerHTML || '',
  }));

  const addLink = () => {
    const url = window.prompt('Nhập link (https://…)');
    if (!url) return;
    run('createLink', url.trim());
  };

  return (
    <div className={`rounded-xl border border-slate-200 overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        <ToolbarBtn title="In đậm" disabled={disabled} active={activeStates.bold} onClick={() => run('bold')}>
          <Bold size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Nghiêng" disabled={disabled} active={activeStates.italic} onClick={() => run('italic')}>
          <Italic size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Gạch chân" disabled={disabled} active={activeStates.underline} onClick={() => run('underline')}>
          <Underline size={15} />
        </ToolbarBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn title="Tiêu đề lớn" disabled={disabled} active={activeStates.h2} onClick={() => run('formatBlock', 'h2')}>
          <Heading2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Tiêu đề nhỏ" disabled={disabled} active={activeStates.h3} onClick={() => run('formatBlock', 'h3')}>
          <Heading3 size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Trích dẫn" disabled={disabled} active={activeStates.blockquote} onClick={() => run('formatBlock', 'blockquote')}>
          <Quote size={15} />
        </ToolbarBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn title="Danh sách" disabled={disabled} active={activeStates.ul} onClick={() => run('insertUnorderedList')}>
          <List size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Danh sách số" disabled={disabled} active={activeStates.ol} onClick={() => run('insertOrderedList')}>
          <ListOrdered size={15} />
        </ToolbarBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn title="Căn trái" disabled={disabled} active={!activeStates.center} onClick={() => run('justifyLeft')}>
          <AlignLeft size={15} />
        </ToolbarBtn>
        <ToolbarBtn title="Căn giữa" disabled={disabled} active={activeStates.center} onClick={() => run('justifyCenter')}>
          <AlignCenter size={15} />
        </ToolbarBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn title="Chèn link" disabled={disabled} onClick={addLink}>
          <Link2 size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Chèn ảnh vào bài"
          disabled={disabled}
          onClick={() => onRequestImage?.()}
        >
          <ImagePlus size={15} />
        </ToolbarBtn>
      </div>
      <div
        ref={elRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={emit}
        onBlur={emit}
        onKeyUp={checkActiveStates}
        onMouseUp={checkActiveStates}
        onFocus={checkActiveStates}
        data-placeholder="Viết nội dung bài… Có thể chèn ảnh, tiêu đề, danh sách."
        className="min-h-[280px] max-h-[520px] overflow-y-auto px-4 py-3 text-sm text-slate-800 leading-relaxed outline-none
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none
          [&_h2]:text-xl [&_h2]:font-black [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1.5
          [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_blockquote]:border-l-4 [&_blockquote]:border-red-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600
          [&_a]:text-red-600 [&_a]:underline
          [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-2"
      />
    </div>
  );
});

export default NewsRichEditor;
