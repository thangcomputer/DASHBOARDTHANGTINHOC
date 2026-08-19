import React from 'react';
import { useNavigate } from 'react-router-dom';

/** Deep-link token embedded in chat text: ⟦chat:student:ID|Display Name⟧ */
export const CHAT_DEEP_LINK_RE = /⟦chat:(student|teacher|admin|staff):([^|⟧]+)\|([^⟧]+)⟧/g;
/** In-app LMS link: ⟦go:/student#materials|Học video⟧ */
export const GO_LINK_RE = /⟦go:(\/[^|⟧]+)\|([^⟧]+)⟧/g;
const EMBED_RE = /⟦chat:(student|teacher|admin|staff):([^|⟧]+)\|([^⟧]+)⟧|⟦go:(\/[^|⟧]+)\|([^⟧]+)⟧|⟦student_detail:([^|⟧:]+)(?::([^|⟧:]+))?(?::([^|⟧]+))?\|([^⟧]+)⟧/g;
const URL_RE = /(https?:\/\/[^\s<]+[^.,;:!?\s<])/gi;
const MARK_RE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
const GO_PATH_RE = /^\/(student|teacher)(\/|#|\?|$)/i;

export function buildChatDeepLinkToken({ role = 'student', id, name } = {}) {
  const rid = String(id || '').trim();
  if (!rid) return String(name || 'Học viên');
  const safeName = String(name || 'Học viên').replace(/[|⟦⟧]/g, ' ').trim() || 'Học viên';
  const safeRole = ['student', 'teacher', 'admin', 'staff'].includes(role) ? role : 'student';
  return `⟦chat:${safeRole}:${rid}|${safeName}⟧`;
}

export function buildStudentDetailDeepLinkToken({ id, name, tab = 'attendance', scheduleId = '' }) {
  const rid = String(id || '').trim();
  if (!rid) return String(name || 'Học viên');
  const safeName = String(name || 'Học viên').replace(/[|⟦⟧]/g, ' ').trim() || 'Học viên';
  const safeTab = String(tab || '').replace(/[|⟦⟧:]/g, '').trim();
  const safeScheduleId = String(scheduleId || '').replace(/[|⟦⟧:]/g, '').trim();
  let token = `⟦student_detail:${rid}`;
  if (safeTab) {
    token += `:${safeTab}`;
    if (safeScheduleId) token += `:${safeScheduleId}`;
  }
  token += `|${safeName}⟧`;
  return token;
}

export function buildGoLinkToken(path, label) {
  const p = String(path || '').trim();
  const l = String(label || p).replace(/[|⟦⟧]/g, ' ').trim() || p;
  if (!GO_PATH_RE.test(p)) return l;
  return `⟦go:${p}|${l}⟧`;
}

function openChatFromToken(person) {
  window.dispatchEvent(new CustomEvent('cms:open-chat', { detail: person }));
}

function openStudentDetailFromToken(id, tab, scheduleId) {
  window.dispatchEvent(new CustomEvent('open-student-detail', { detail: { id, tab, scheduleId } }));
}

function linkClass(mine) {
  return mine
    ? 'cms-fm-link is-mine underline font-bold'
    : 'cms-fm-link underline font-bold text-blue-700 hover:text-blue-900';
}

function fnClass(name) {
  const u = String(name || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (u.startsWith('SUM')) return 'bg-emerald-100 text-emerald-800';
  if (u.includes('LOOKUP')) return 'bg-violet-100 text-violet-800';
  if (u === 'IF' || u.startsWith('IF')) return 'bg-amber-100 text-amber-900';
  return 'bg-sky-100 text-sky-800';
}

function renderMarks(chunk, keyPrefix) {
  if (!chunk) return [];
  const out = [];
  let last = 0;
  const re = new RegExp(MARK_RE.source, 'g');
  let m;
  while ((m = re.exec(chunk)) !== null) {
    if (m.index > last) out.push(chunk.slice(last, m.index));
    const token = m[0];
    const k = `${keyPrefix}-${m.index}`;
    if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1);
      out.push(
        <span
          key={k}
          className={`inline-block font-mono font-bold text-[12px] px-1.5 py-0.5 rounded-md mx-0.5 align-baseline ${fnClass(inner)}`}
        >
          {inner}
        </span>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      out.push(<strong key={k} className="font-bold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      out.push(<em key={k} className="italic text-slate-600">{token.slice(1, -1)}</em>);
    } else {
      out.push(token);
    }
    last = m.index + token.length;
  }
  if (last < chunk.length) out.push(chunk.slice(last));
  return out;
}

function renderTextWithUrls(chunk, segIdx, mine) {
  const nodes = [];
  let tLast = 0;
  const urlRe = new RegExp(URL_RE.source, 'gi');
  let tMatch;
  while ((tMatch = urlRe.exec(chunk)) !== null) {
    if (tMatch.index > tLast) {
      nodes.push(...renderMarks(chunk.slice(tLast, tMatch.index), `m-${segIdx}-${tLast}`));
    }
    const url = tMatch[0];
    nodes.push(
      <a
        key={`url-${segIdx}-${tMatch.index}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className={mine ? 'cms-fm-link is-mine' : 'cms-fm-link'}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    tLast = tMatch.index + url.length;
  }
  if (tLast < chunk.length) {
    nodes.push(...renderMarks(chunk.slice(tLast), `m-${segIdx}-${tLast}`));
  }
  return nodes;
}

function parseTableCells(line) {
  let t = String(line || '').trim().replace(/^Dòng\s*\d+\s*:\s*/i, '');
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function isSeparatorRow(line) {
  const cells = parseTableCells(line).filter(Boolean);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function isTableRow(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (isSeparatorRow(t)) return true;
  if (/^\|(.+)\|$/.test(t)) return (t.match(/\|/g) || []).length >= 2;
  const stripped = t.replace(/^Dòng\s*\d+\s*:\s*/i, '');
  return (stripped.match(/\|/g) || []).length >= 2;
}

function excelColLabel(index) {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function renderMdTable(rawRows, key, mine) {
  const rows = [];
  rawRows.forEach((line) => {
    if (isSeparatorRow(line)) return;
    rows.push(parseTableCells(line));
  });
  if (rows.length < 2) return null;
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const pad = (row) => {
    const next = [...row];
    while (next.length < colCount) next.push('');
    return next.slice(0, colCount);
  };
  const line = mine ? 'border-white/50' : 'border-slate-300';
  const gutterBg = mine ? 'bg-white/20' : 'bg-[#e9edf2]';
  const gutterFg = mine ? 'text-white/90' : 'text-slate-500';
  const dataHeadBg = mine ? 'bg-white/10' : 'bg-[#f3f6fa]';
  const cell = `border border-dashed ${line} px-2 py-0.5 whitespace-normal text-left align-middle`;
  const gutter = `border border-dashed ${line} ${gutterBg} ${gutterFg} px-1.5 py-0.5 text-center font-semibold text-[10px] leading-none whitespace-nowrap select-none`;
  return (
    <div key={key} className="cms-xl-table-wrap my-1.5 max-w-full overflow-x-auto">
      <table className="border-collapse text-[12px] leading-snug font-normal">
        <thead>
          <tr>
            <th className={`${gutter} min-w-[1.4rem]`} aria-hidden="true" />
            {Array.from({ length: colCount }, (_, i) => (
              <th key={`${key}-col-${i}`} className={`${gutter} min-w-[3rem]`}>
                {excelColLabel(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={`${key}-r-${ri}`}>
              <th className={gutter}>{ri + 1}</th>
              {pad(row).map((c, ci) => {
                const isTitleRow = ri === 0;
                const Tag = isTitleRow ? 'th' : 'td';
                return (
                  <Tag
                    key={`${key}-r-${ri}-${ci}`}
                    className={`${cell} ${isTitleRow ? `${dataHeadBg} font-bold` : 'font-medium'}`}
                  >
                    {renderMarks(c, `${key}-r-${ri}-${ci}`)}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STEP_ACTION_RE = /^(Vào|Vào menu|Mở|Chọn|Bấm|Nhấn|Click|Tạo|Điền|Gõ|Nhập|Lưu|Sắp xếp|Thiết lập|Kéo|Copy|Sao chép|Dán|Xóa|Chèn|Áp dụng|Kiểm tra|Viết|Bôi|Tô|Đặt|Gán|Format|Right-click|Chuột phải|Tab|Home|Insert)/i;

function emphasizeStepLine(line) {
  const t = String(line || '');
  if (/^\s*\*\*Bước\s+\d+/i.test(t)) return t;
  if (/^\s*Bước\s+\d+\s*:/i.test(t)) {
    return t.replace(/^(\s*)(Bước\s+\d+\s*:)/i, '$1**$2**');
  }
  const m = t.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (m && STEP_ACTION_RE.test(m[3].trim())) {
    return `${m[1]}**Bước ${m[2]}:** ${m[3]}`;
  }
  return t;
}

function renderTextBlocks(chunk, segIdx, mine) {
  const lines = String(chunk || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i])) {
      const start = i;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      const dataRows = rows.filter((r) => !isSeparatorRow(r));
      if (dataRows.length >= 2) {
        const table = renderMdTable(rows, `tbl-${segIdx}-${start}`, mine);
        if (table) out.push(table);
        continue;
      }
      rows.forEach((line, li) => {
        out.push(...renderTextWithUrls(emphasizeStepLine(line), `${segIdx}-${start}-${li}`, mine));
        if (start + li < lines.length - 1) out.push('\n');
      });
      continue;
    }
    out.push(...renderTextWithUrls(emphasizeStepLine(lines[i]), `${segIdx}-${i}`, mine));
    if (i < lines.length - 1) out.push('\n');
    i += 1;
  }
  return out;
}

/**
 * Render message text: http(s) links, LMS go-links, chat tokens, **bold** *italic* `FUNC`, markdown tables.
 */
export function MessageRichText({ text, mine = false }) {
  const navigate = useNavigate();
  const raw = String(text || '');
  if (!raw) return null;

  const segments = [];
  const embedRe = new RegExp(EMBED_RE.source, 'g');
  let last = 0;
  let match;
  while ((match = embedRe.exec(raw)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: raw.slice(last, match.index) });
    }
    if (match[1]) {
      segments.push({
        type: 'chat',
        role: match[1],
        id: match[2],
        name: match[3],
        key: `chat-${match.index}`,
      });
    } else if (match[4]) {
      segments.push({
        type: 'go',
        path: match[4],
        label: match[5],
        key: `go-${match.index}`,
      });
    } else if (match[6]) {
      segments.push({
        type: 'student_detail',
        id: match[6],
        tab: match[7],
        scheduleId: match[8],
        name: match[9],
        key: `student_detail-${match.index}`,
      });
    }
    last = match.index + match[0].length;
  }
  if (last < raw.length) segments.push({ type: 'text', value: raw.slice(last) });

  const nodes = [];
  segments.forEach((seg, segIdx) => {
    if (seg.type === 'chat') {
      nodes.push(
        <button
          key={seg.key}
          type="button"
          className={`${linkClass(mine)} bg-transparent border-0 p-0 cursor-pointer inline`}
          title={`Nhắn tin với ${seg.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openChatFromToken({
              id: String(seg.id),
              name: seg.name,
              role: seg.role,
            });
          }}
        >
          {seg.name}
        </button>,
      );
      return;
    }
    if (seg.type === 'student_detail') {
      nodes.push(
        <button
          key={seg.key}
          type="button"
          className={`${linkClass(mine)} bg-transparent border-0 p-0 cursor-pointer inline`}
          title={`Xem hồ sơ: ${seg.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openStudentDetailFromToken(seg.id, seg.tab, seg.scheduleId);
          }}
        >
          {seg.name}
        </button>,
      );
      return;
    }
    if (seg.type === 'go') {
      const ok = GO_PATH_RE.test(String(seg.path || ''));
      if (!ok) {
        nodes.push(seg.label || seg.path);
        return;
      }
      nodes.push(
        <button
          key={seg.key}
          type="button"
          className={`${linkClass(mine)} bg-transparent border-0 p-0 cursor-pointer inline`}
          title={seg.path}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const raw = String(seg.path || '');
            const hashIdx = raw.indexOf('#');
            if (hashIdx === -1) {
              navigate(raw);
              return;
            }
            navigate({
              pathname: raw.slice(0, hashIdx) || '/',
              hash: raw.slice(hashIdx + 1),
            });
          }}
        >
          {seg.label}
        </button>,
      );
      return;
    }
    nodes.push(...renderTextBlocks(seg.value, segIdx, mine));
  });

  return <>{nodes.length ? nodes : raw}</>;
}

function stripChatMarks(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/** Plain text for clipboard: bảng dạng Excel (cột A B C + số hàng), bỏ token chat/LMS. */
export function copyableTextFromMessage(raw) {
  let t = String(raw || '');
  t = t.replace(CHAT_DEEP_LINK_RE, '$3').replace(GO_LINK_RE, '$2');
  const lines = t.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i])) {
      const start = i;
      const block = [];
      while (i < lines.length && isTableRow(lines[i])) {
        block.push(lines[i]);
        i += 1;
      }
      const data = block.filter((r) => !isSeparatorRow(r)).map(parseTableCells);
      if (data.length >= 2) {
        const cols = Math.max(...data.map((r) => r.length), 1);
        const letters = Array.from({ length: cols }, (_, idx) => excelColLabel(idx));
        out.push(['', ...letters].join('\t'));
        data.forEach((row, ri) => {
          const padded = [...row];
          while (padded.length < cols) padded.push('');
          out.push([String(ri + 1), ...padded.map(stripChatMarks)].join('\t'));
        });
        continue;
      }
      block.forEach((line) => out.push(stripChatMarks(emphasizeStepLine(line))));
      continue;
    }
    out.push(stripChatMarks(emphasizeStepLine(lines[i])));
    i += 1;
  }
  return out.join('\n').trim();
}
