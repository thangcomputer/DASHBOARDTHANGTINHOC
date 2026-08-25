import React, { useState } from 'react';
import { ExternalLink, Download, Link2, BookOpen, ChevronLeft } from 'lucide-react';
import { sanitizeRichHtml, htmlToPlainText, resolveRichHtmlMedia } from '../utils/htmlContent';
import { resolveMediaUrl } from '../services/api';

function hasInstallGuide(raw) {
  const s = String(raw || '');
  if (!s.trim()) return false;
  return Boolean(htmlToPlainText(s) || /<img\b/i.test(s));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML từ editor, hoặc plain text cũ → đoạn văn để đọc như bài viết. */
function toArticleHtml(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const html = /<[a-z][\s\S]*>/i.test(s)
    ? s
    : s
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
  return resolveRichHtmlMedia(sanitizeRichHtml(html), resolveMediaUrl);
}

/**
 * Bảng Link phần mềm — bấm "Xem hướng dẫn" mở bài viết đầy đủ (như Tin tức).
 */
export default function SoftwareLinksTable({
  items = [],
  title = 'Tải phần mềm',
  emptyText = 'Chưa có link phần mềm nào.',
}) {
  const rows = Array.isArray(items) ? items : [];
  const [article, setArticle] = useState(null);

  if (article) {
    const name = String(article.title || article.name || 'Phần mềm').trim();
    const desc = String(article.description || article.desc || '').trim();
    const href = String(article.linkUrl || article.url || '').trim();
    const bodyHtml = toArticleHtml(article.installGuide || article.guide || '');

    return (
      <div className="w-full animate-in fade-in slide-in-from-right-2 duration-300 pb-8">
        <article className="w-full bg-white rounded-2xl border border-slate-100 p-5 sm:p-8 shadow-sm space-y-6 text-left">
          <button
            type="button"
            onClick={() => setArticle(null)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-red-600 transition-colors"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Quay lại danh sách
          </button>

          <header className="space-y-3 border-b border-slate-100 pb-5">
            <p className="text-[11px] font-black uppercase tracking-wider text-red-600">
              Hướng dẫn cài đặt
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
              {name}
            </h1>
            {desc ? (
              <p className="text-base text-slate-600 font-medium border-l-4 border-red-500 pl-4 leading-relaxed">
                {desc}
              </p>
            ) : null}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
              >
                <Download size={16} aria-hidden="true" />
                Tải / Mở phần mềm
                <ExternalLink size={14} className="opacity-80" aria-hidden="true" />
              </a>
            ) : null}
          </header>

          <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-[15px] sm:text-base
              [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-3
              [&_h2]:text-xl [&_h2]:font-black [&_h2]:mt-5 [&_h2]:mb-2
              [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1.5
              [&_p]:mb-3 [&_p]:leading-relaxed
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3
              [&_li]:mb-1
              [&_blockquote]:border-l-4 [&_blockquote]:border-red-400 [&_blockquote]:pl-3 [&_blockquote]:italic
              [&_a]:text-red-600 [&_a]:underline
              [&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:mx-auto [&_img]:block [&_img]:shadow-sm [&_img]:border [&_img]:border-slate-100"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
              >
                <Download size={16} aria-hidden="true" />
                Tải / Mở link
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => setArticle(null)}
              className="inline-flex items-center justify-center min-h-11 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition-colors"
            >
              Quay lại danh sách
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-300">
      {title ? (
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Link2 size={22} className="text-sky-600 shrink-0" aria-hidden="true" />
            {title}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Tải / mở phần mềm học tập và xem hướng dẫn cài đặt
          </p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
          <Link2 size={40} className="mx-auto mb-3 text-slate-200" aria-hidden="true" />
          <p className="font-bold">{emptyText}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 w-[28%]">Link / Phần mềm</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 w-[42%]">Mô tả</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 w-[30%]">Hướng dẫn cài đặt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const href = String(row.linkUrl || row.url || '').trim();
                  const name = String(row.title || row.name || 'Phần mềm').trim();
                  const guideRaw = String(row.installGuide || row.guide || '');
                  const canViewGuide = hasInstallGuide(guideRaw);
                  return (
                    <tr key={row.id || href || name} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-bold text-slate-800 mb-2">{name}</p>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                          >
                            <Download size={14} aria-hidden="true" />
                            Tải / Mở link
                            <ExternalLink size={12} className="opacity-80" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Chưa có link</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {String(row.description || row.desc || '').trim() || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {canViewGuide ? (
                          <button
                            type="button"
                            onClick={() => setArticle(row)}
                            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition-colors"
                          >
                            <BookOpen size={14} aria-hidden="true" />
                            Xem hướng dẫn
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Chưa có hướng dẫn</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
