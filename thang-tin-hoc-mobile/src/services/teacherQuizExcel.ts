import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { TeacherQuizQuestionInput } from './teacherQuizApi';

const headers = [
  'Loại',
  'Phần thi',
  'Độ khó',
  'Câu hỏi',
  'Đáp án A',
  'Đáp án B',
  'Đáp án C',
  'Đáp án D',
  'Đáp án đúng',
  'Gợi ý trả lời (tự luận)',
];

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
const MAX_EXCEL_BASE64_LENGTH = Math.ceil(MAX_EXCEL_BYTES / 3) * 4;
const MAX_DECOMPRESSED_XML_BYTES = 15 * 1024 * 1024;
const MAX_PARSED_ROWS = 1001;

type ParsedQuestionBank = {
  questions: TeacherQuizQuestionInput[];
  errors: string[];
};

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function cell(row: Record<string, unknown>, label: string) {
  const expected = normalizeHeader(label);
  const key = Object.keys(row).find((candidate) => normalizeHeader(candidate) === expected);
  return key ? String(row[key] ?? '').trim() : '';
}

function correctAnswerIndex(value: string) {
  const normalized = value.trim().toUpperCase();
  if (/^[A-D]$/.test(normalized)) return normalized.charCodeAt(0) - 65;
  const number = Number(normalized);
  if (!Number.isInteger(number)) return null;
  if (number >= 1 && number <= 4) return number - 1;
  if (number === 0) return 0;
  return null;
}

function escapeXml(value: string | number) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function spreadsheetColumn(index: number) {
  let column = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function columnLettersToIndex(letters: string) {
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    const code = letters.toUpperCase().charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const cleaned = String(base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((cleaned.length * 3) / 4 - padding);
  let outIndex = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = alphabet.indexOf(cleaned[i]);
    const b = alphabet.indexOf(cleaned[i + 1]);
    const c = cleaned[i + 2] === '=' ? 0 : alphabet.indexOf(cleaned[i + 2]);
    const d = cleaned[i + 3] === '=' ? 0 : alphabet.indexOf(cleaned[i + 3]);
    const triplet = (a << 18) | (b << 12) | (c << 6) | d;
    if (outIndex < out.length) out[outIndex++] = (triplet >> 16) & 0xff;
    if (outIndex < out.length) out[outIndex++] = (triplet >> 8) & 0xff;
    if (outIndex < out.length) out[outIndex++] = triplet & 0xff;
  }
  return out;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return globalThis.btoa(binary);
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += alphabet[(triplet >> 18) & 63];
    result += alphabet[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? alphabet[triplet & 63] : '=';
  }
  return result;
}

function extractTagAttributes(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z0-9:_-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    attrs[match[1]] = unescapeXml(match[2]);
  }
  return attrs;
}

function extractTextRuns(xmlFragment: string): string {
  const texts: string[] = [];
  const tRegex = /<(?:[a-zA-Z0-9_-]+:)?t(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?t>/g;
  let match: RegExpExecArray | null;
  while ((match = tRegex.exec(xmlFragment)) !== null) {
    texts.push(unescapeXml(match[1]));
  }
  return texts.join('');
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<(?:[a-zA-Z0-9_-]+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    strings.push(extractTextRuns(match[1]));
  }
  return strings;
}

function resolvePreferredWorksheetPath(files: Record<string, Uint8Array>): string {
  const sheetPaths = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name))
    .sort();
  if (!sheetPaths.length) return '';

  const workbookBytes = files['xl/workbook.xml'];
  const relsBytes = files['xl/_rels/workbook.xml.rels'];
  if (!workbookBytes || !relsBytes) return sheetPaths[0];

  const workbookXml = strFromU8(workbookBytes);
  const relsXml = strFromU8(relsBytes);
  const relTargetById = new Map<string, string>();
  const relRegex = /<Relationship\s+([^>]*?)\/>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    const attrs = extractTagAttributes(relMatch[1]);
    if (attrs.Id && attrs.Target) {
      const normalizedTarget = attrs.Target.replace(/^\/+/, '');
      relTargetById.set(
        attrs.Id,
        normalizedTarget.startsWith('xl/') ? normalizedTarget : `xl/${normalizedTarget}`,
      );
    }
  }

  let firstSheetPath = '';
  const sheetRegex = /<(?:[a-zA-Z0-9_-]+:)?sheet\s+([^>]*?)\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
    const attrs = extractTagAttributes(sheetMatch[1]);
    const relId = attrs['r:id'] || attrs.id || '';
    const resolvedPath = relTargetById.get(relId) || '';
    if (resolvedPath && files[resolvedPath]) {
      if (!firstSheetPath) firstSheetPath = resolvedPath;
      if (attrs.name && normalizeHeader(attrs.name).includes('cau hoi')) {
        return resolvedPath;
      }
    }
  }

  return firstSheetPath || sheetPaths[0];
}

function parseWorksheetRows(sheetXml: string, sharedStrings: string[]): Array<Record<string, unknown>> {
  const table: string[][] = [];
  const rowRegex = /<(?:[a-zA-Z0-9_-]+:)?row(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null && table.length < MAX_PARSED_ROWS) {
    const rowValues: string[] = [];
    let fallbackCol = 0;
    const cellRegex = /<(?:[a-zA-Z0-9_-]+:)?c\s*([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?c>)/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const attrs = extractTagAttributes(cellMatch[1] || '');
      const inner = cellMatch[2] || '';
      let colIndex = fallbackCol;
      if (attrs.r) {
        const colLetters = attrs.r.match(/^([A-Za-z]+)/)?.[1] || '';
        const parsedCol = columnLettersToIndex(colLetters);
        if (parsedCol >= 0) colIndex = parsedCol;
      }
      fallbackCol = colIndex + 1;

      const cellType = attrs.t || '';
      let value = '';
      if (cellType === 'inlineStr') {
        value = extractTextRuns(inner);
      } else {
        const vMatch = inner.match(/<(?:[a-zA-Z0-9_-]+:)?v(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?v>/);
        const rawV = vMatch ? unescapeXml(vMatch[1]) : '';
        if (cellType === 's') {
          const sIdx = parseInt(rawV, 10);
          value = Number.isInteger(sIdx) && sIdx >= 0 ? (sharedStrings[sIdx] ?? '') : '';
        } else {
          value = rawV;
        }
      }

      rowValues[colIndex] = value;
    }

    if (rowValues.some((entry) => String(entry || '').trim() !== '')) {
      table.push(rowValues);
    }
  }

  if (table.length <= 1) return [];
  const headerRow = table[0];
  return table.slice(1).map((cells) => {
    const record: Record<string, unknown> = {};
    headerRow.forEach((headerName, index) => {
      const key = String(headerName || '').trim();
      if (key) {
        record[key] = cells[index] ?? '';
      }
    });
    return record;
  });
}

export async function parseTeacherQuizQuestionsExcel(base64: string): Promise<ParsedQuestionBank> {
  if (!base64 || base64.length > MAX_EXCEL_BASE64_LENGTH) {
    return { questions: [], errors: ['Tệp Excel trống hoặc vượt quá giới hạn 5MB.'] };
  }

  let files: Record<string, Uint8Array>;
  try {
    const rawBytes = decodeBase64ToBytes(base64);
    let totalExtracted = 0;
    files = unzipSync(rawBytes, {
      filter(file) {
        totalExtracted += Number(file.originalSize || 0);
        return totalExtracted <= MAX_DECOMPRESSED_XML_BYTES
          && (/^xl\//i.test(file.name) || file.name === '[Content_Types].xml');
      },
    });
  } catch {
    return { questions: [], errors: ['Không đọc được tệp Excel.'] };
  }

  const sheetPath = resolvePreferredWorksheetPath(files);
  if (!sheetPath || !files[sheetPath]) {
    return { questions: [], errors: ['Tệp Excel không có trang tính câu hỏi.'] };
  }

  const sharedStrings = files['xl/sharedStrings.xml']
    ? parseSharedStrings(strFromU8(files['xl/sharedStrings.xml']))
    : [];
  const sheetXml = strFromU8(files[sheetPath]);
  const rows = parseWorksheetRows(sheetXml, sharedStrings);

  const questions: TeacherQuizQuestionInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const questionText = cell(row, 'Câu hỏi');
    if (!questionText) return;
    const type = normalizeHeader(cell(row, 'Loại'));
    if (type.includes('tu luan') || type.includes('essay')) return;

    const options = ['A', 'B', 'C', 'D'].map((letter) => cell(row, `Đáp án ${letter}`));
    const correctAnswer = correctAnswerIndex(cell(row, 'Đáp án đúng'));
    if (options.some((option) => !option) || correctAnswer === null || !options[correctAnswer]) {
      errors.push(`Dòng ${index + 2}: cần đủ 4 phương án và đáp án đúng A-D hoặc 1-4.`);
      return;
    }
    questions.push({
      questionText,
      options,
      correctAnswer,
      explanation: cell(row, 'Gợi ý trả lời (tự luận)'),
    });
  });
  return { questions: questions.slice(0, 200), errors };
}

export async function createTeacherQuizQuestionWorkbook(
  questions: TeacherQuizQuestionInput[],
  courseName: string,
  includeSample = false,
) {
  const rows: Array<Array<string>> = [headers];
  questions.forEach((question) => {
    rows.push([
      'Trắc nghiệm',
      courseName,
      'Trung bình',
      question.questionText,
      question.options[0] || '',
      question.options[1] || '',
      question.options[2] || '',
      question.options[3] || '',
      ['A', 'B', 'C', 'D'][question.correctAnswer] || 'A',
      question.explanation,
    ]);
  });
  if (includeSample) {
    rows.push([
      'Trắc nghiệm',
      courseName,
      'Trung bình',
      'Nội dung câu hỏi mẫu?',
      'Phương án A',
      'Phương án B',
      'Phương án C',
      'Phương án D',
      'B',
      '',
    ]);
  }

  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${spreadsheetColumn(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const xmlFiles: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cau hoi" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };

  const zipped = zipSync(
    Object.fromEntries(Object.entries(xmlFiles).map(([path, content]) => [path, strToU8(content)])),
  );
  return encodeBytesToBase64(zipped);
}
