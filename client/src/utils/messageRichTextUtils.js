import { stickerLabelFromToken } from './chatStickers';

export const CHAT_DEEP_LINK_RE = /⟦chat:(student|teacher|admin|staff):([^|⟧]+)\|([^⟧]+)⟧/g;
export const GO_LINK_RE = /⟦go:(\/[^|⟧]+)\|([^⟧]+)⟧/g;

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
  if (!/^\/(student|teacher)(\/|#|\?|$)/i.test(p)) return l;
  return `⟦go:${p}|${l}⟧`;
}

export function parseTableCells(line) {
  let text = String(line || '').trim().replace(/^Dòng\s*\d+\s*:\s*/i, '');
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  return text.split('|').map((cell) => cell.trim());
}

export function isSeparatorRow(line) {
  const cells = parseTableCells(line).filter(Boolean);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

export function isTableRow(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  if (isSeparatorRow(text)) return true;
  if (/^\|(.+)\|$/.test(text)) return (text.match(/\|/g) || []).length >= 2;
  const stripped = text.replace(/^Dòng\s*\d+\s*:\s*/i, '');
  return (stripped.match(/\|/g) || []).length >= 2;
}

export function excelColLabel(index) {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const STEP_ACTION_RE = /^(Vào|Vào menu|Mở|Chọn|Bấm|Nhấn|Click|Tạo|Điền|Gõ|Nhập|Lưu|Sắp xếp|Thiết lập|Kéo|Copy|Sao chép|Dán|Xóa|Chèn|Áp dụng|Kiểm tra|Viết|Bôi|Tô|Đặt|Gán|Format|Right-click|Chuột phải|Tab|Home|Insert)/i;

export function emphasizeStepLine(line) {
  const text = String(line || '');
  if (/^\s*\*\*Bước\s+\d+/i.test(text)) return text;
  if (/^\s*Bước\s+\d+\s*:/i.test(text)) {
    return text.replace(/^(\s*)(Bước\s+\d+\s*:)/i, '$1**$2**');
  }
  const match = text.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (match && STEP_ACTION_RE.test(match[3].trim())) {
    return `${match[1]}**Bước ${match[2]}:** ${match[3]}`;
  }
  return text;
}

function stripChatMarks(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export function copyableTextFromMessage(raw) {
  let text = String(raw || '');
  const stickerLabel = stickerLabelFromToken(text);
  if (stickerLabel) return `[Sticker: ${stickerLabel}]`;
  text = text.replace(CHAT_DEEP_LINK_RE, '$3').replace(GO_LINK_RE, '$2');
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let index = 0;
  while (index < lines.length) {
    if (isTableRow(lines[index])) {
      const block = [];
      while (index < lines.length && isTableRow(lines[index])) {
        block.push(lines[index]);
        index += 1;
      }
      const rows = block.filter((row) => !isSeparatorRow(row)).map(parseTableCells);
      if (rows.length >= 2) {
        const columns = Math.max(...rows.map((row) => row.length), 1);
        const letters = Array.from({ length: columns }, (_, column) => excelColLabel(column));
        output.push(['', ...letters].join('\t'));
        rows.forEach((row, rowIndex) => {
          const padded = [...row];
          while (padded.length < columns) padded.push('');
          output.push([String(rowIndex + 1), ...padded.map(stripChatMarks)].join('\t'));
        });
        continue;
      }
      block.forEach((line) => output.push(stripChatMarks(emphasizeStepLine(line))));
      continue;
    }
    output.push(stripChatMarks(emphasizeStepLine(lines[index])));
    index += 1;
  }
  return output.join('\n').trim();
}
