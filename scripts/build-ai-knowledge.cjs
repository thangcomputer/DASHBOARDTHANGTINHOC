#!/usr/bin/env node
'use strict';

/**
 * scripts/build-ai-knowledge.cjs
 *
 * Pipeline chuẩn hóa kho tri thức Tin học văn phòng (Read-Only đối với nguồn gốc).
 * - Quét các thư mục nguồn trên ổ D và ai-knowledge/sources
 * - Kiểm tra chính sách & quyền sử dụng trước khi lập chỉ mục (Quarantine nếu chưa duyệt)
 * - Loại trùng nội dung file bằng SHA-256 + loại trùng đoạn văn gần giống giữa DOCX/PDF
 * - Trích xuất văn bản từ PDF, DOCX, PPTX, XLSX, TXT giữ nguyên vị trí (page, slide, sheet, sectionTitle)
 * - Chia đoạn theo tiêu đề & ngữ nghĩa, gắn metadata phần mềm/phiên bản/loại tài liệu/nguồn
 * - Xuất index, manifest, quarantine manifest và báo cáo chi tiết
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { pathToFileURL } = require('url');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const AI_KNOWLEDGE_DIR = path.join(ROOT, 'ai-knowledge');
const SOURCES_DIR = path.join(AI_KNOWLEDGE_DIR, 'sources');
const INDEX_DIR = path.join(AI_KNOWLEDGE_DIR, 'index');
const MANIFESTS_DIR = path.join(AI_KNOWLEDGE_DIR, 'manifests');
const REPORTS_DIR = path.join(AI_KNOWLEDGE_DIR, 'reports');
const QUARANTINE_DIR = path.join(AI_KNOWLEDGE_DIR, 'quarantine');

const DEFAULT_INPUT_PATHS = [
  SOURCES_DIR,
  'D:\\LỘ TRÌNH TIN HỌC',
  'D:\\MẪU TRẮC NGHIỆM',
  'D:\\web\\WEB TỔNG HỢP\\GIASUAI\\data\\knowledge',
  'D:\\GIÁO TRÌNH SỬ DỤNG MÁY TÍNH THẮNG TIN HOC.pdf',
  'D:\\GIÁO TRÌNH SỬ DỤNG MT CHUẨN.pptx',
];

const SUPPORTED_DOC_EXTS = new Set(['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md']);
const QUARANTINE_CANDIDATE_EXTS = new Set(['.doc', '.rtf', '.csv', '.xml', '.json']);
const IGNORED_NON_TEXT_EXTS = new Set([
  '.mp4', '.wmv', '.mov', '.avi', '.mkv', '.wav', '.mp3',
  '.trec', '.tscproj', '.tscshadervid', '.glb',
  '.zip', '.rar', '.7z',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.ico', '.svg',
  '.ppsx', '.odp', '.exe', '.dat', '.tmp',
]);

const MAX_CHUNK_CHARS = 850;
const MIN_CHUNK_CHARS = 45;
const CHUNK_OVERLAP_CHARS = 120;

const KNOWN_EXCEL_FUNCTIONS = [
  'VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'LOOKUP',
  'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUBTOTAL', 'AGGREGATE',
  'AVERAGE', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS',
  'MAX', 'MIN', 'LARGE', 'SMALL', 'RANK', 'MEDIAN', 'MODE', 'STDEV',
  'IF', 'IFS', 'AND', 'OR', 'NOT', 'IFERROR', 'IFNA', 'SWITCH',
  'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'CONCAT', 'CONCATENATE', 'TEXTJOIN', 'FIND', 'SEARCH', 'SUBSTITUTE', 'REPLACE', 'VALUE', 'TEXT',
  'DATE', 'TODAY', 'NOW', 'DAY', 'MONTH', 'YEAR', 'WEEKDAY', 'DATEDIF', 'EOMONTH', 'NETWORKDAYS', 'TIME', 'HOUR', 'MINUTE',
  'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'INT', 'MOD', 'ABS', 'RAND', 'RANDBETWEEN', 'SEQUENCE', 'SORT', 'UNIQUE', 'FILTER', 'PMT', 'FV', 'PV',
];

const EXCEL_FN_RE = new RegExp(`\\b(${KNOWN_EXCEL_FUNCTIONS.join('|')})\\b`, 'gi');
const SHORTCUT_RE = /\b(?:ctrl|alt|shift|cmd|command|win|windows|fn)(?:\s*\+\s*(?:ctrl|alt|shift|cmd|command|win|f\d{1,2}|[a-z0-9`=+\-[\];',./\\]|tab|enter|esc|space|backspace|delete|home|end|pageup|pagedown|up|down|left|right)){1,3}|\bf(?:[1-9]|1[0-2])\b/gi;

// Polyfill DOMMatrix/ImageData/Path2D for pdfjs-dist on Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

let cachedPdfJs = null;
async function getPdfJs() {
  if (cachedPdfJs) return cachedPdfJs;
  const resolved = require.resolve('pdfjs-dist/legacy/build/pdf.mjs', {
    paths: [ROOT, path.join(ROOT, 'node_modules'), 'D:\\web\\WEB TỔNG HỢP\\GIASUAI\\node_modules'],
  });
  // Suppress noisy @napi-rs/canvas polyfill warning on stderr/console during pdfjs module import
  const origWarn = console.warn;
  console.warn = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('@napi-rs/canvas') || msg.includes('DOMMatrix') || msg.includes('ImageData') || msg.includes('Path2D')) return;
    origWarn.apply(console, args);
  };
  try {
    cachedPdfJs = await import(pathToFileURL(resolved).href);
  } finally {
    console.warn = origWarn;
  }
  return cachedPdfJs;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function normalizePathSlashes(p) {
  return String(p || '').replace(/\\/g, '/');
}

function normalizeVietnamese(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Pure-Node ZIP reader reading Central Directory to safely support files with data descriptors.
 */
function readZipEntries(buffer) {
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP: End of Central Directory not found');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  let offset = cdOffset;

  for (let idx = 0; idx < totalEntries && offset + 46 <= buffer.length; idx += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    offset += 46 + nameLen + extraLen + commentLen;

    if (!name || name.endsWith('/')) continue;
    entries.set(name, {
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      readBuffer() {
        if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
          throw new Error(`Invalid local header for ${name}`);
        }
        const lfNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
        const lfExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen;
        const slice = buffer.subarray(dataStart, dataStart + compressedSize);
        if (method === 0) return slice;
        if (method === 8) return zlib.inflateRawSync(slice);
        throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
      },
    });
  }
  return entries;
}

/**
 * Policy & Copyright Gatekeeper (chạy trước khi trích xuất / lập chỉ mục).
 */
function classifyDocumentPolicy(filePath) {
  const norm = normalizePathSlashes(filePath);
  const lower = norm.toLowerCase();
  const base = path.basename(filePath);
  const baseLower = base.toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  if (base.startsWith('~$') || baseLower === 'thumbs.db' || baseLower === '.ds_store') {
    return { action: 'ignore', reason: 'system_or_temp_file' };
  }
  if (IGNORED_NON_TEXT_EXTS.has(ext)) {
    return { action: 'ignore', reason: 'non_text_media_or_archive' };
  }
  if (QUARANTINE_CANDIDATE_EXTS.has(ext)) {
    const reason = ext === '.doc'
      ? 'legacy_binary_doc_requires_conversion'
      : ext === '.json'
        ? 'camtasia_ui_animation_json'
        : 'third_party_mos_practice_data_asset';
    return { action: 'quarantine', reason };
  }
  if (!SUPPORTED_DOC_EXTS.has(ext)) {
    return { action: 'ignore', reason: 'unsupported_extension' };
  }

  // Quarantine rules (tài liệu bên thứ 3 thương mại, phôi bài tập MOS, link không phù hợp, đề chưa xác minh)
  if (/mos_2016_study_guide_/i.test(baseLower)) {
    return { action: 'quarantine', reason: 'third_party_commercial_book_microsoft_press' };
  }
  if (lower.includes('/lộ trình ôn mos/mos/')) {
    return { action: 'quarantine', reason: 'third_party_mos_practice_asset' };
  }
  if (/link tải phần mềm\.txt/i.test(baseLower)) {
    return { action: 'quarantine', reason: 'contains_unverified_external_crack_links' };
  }
  if (/(^|\/)(de_tham_khao_|de-tham-khao-|bai-tap-word-1-tinhocnghephothong|đề thi 2024|đề 2024)/i.test(lower)) {
    return { action: 'quarantine', reason: 'unverified_third_party_exam_paper' };
  }

  // Tier 1: Giáo trình nội bộ Thắng Tin Học / DewSkill (Ưu tiên cao nhất)
  const isInternal = (
    lower.includes('/ai-knowledge/sources/')
    || lower.includes('d:/mẫu trắc nghiệm/')
    || /thắng tin học|thang tin hoc|giáo trình sách|giáo trình word mới 2026|giáo trình powerpoint|giáo trình sử dụng|lộ trình excel|giao_trinh_|lộ trình học máy vi tính|lộ trình tin học trẻ em|120 phím tắt|250 phím tắt|phím tắt|thủ thuật cơ bản máy tính|huong-dan-su-dung-zalo|bài tập thực hành file word chuẩn|đề thi thực hành kỹ năng microsoft|mục lục lộ trình ôn thi mos|lộ trình ôn thi mos word|thực hành animation|thực hành transition|file bài tập excel (cơ bản|nâng cao)/i.test(lower)
    || /^(word|excel|powerpoint)\s*365\.docx$/i.test(baseLower)
  );
  if (isInternal) {
    return {
      action: 'approve',
      tier: 1,
      sourceOrigin: 'internal_thangtinhoc',
      priorityWeight: 1.35,
      accessLevel: 'student',
    };
  }

  // Tier 2: Hướng dẫn chính thức & Đề cương kỹ năng Microsoft / MOS
  const isOfficialSpec = (
    /^microsoft-(word|excel|powerpoint)-huong-dan-chinh-thuc\.txt$/i.test(baseLower)
    || /^(mo-100|mo-200|mo-300|exam-mo-400|exam-mo-500|mos-2019-curriculum)/i.test(baseLower)
    || /^microsoft\s+(word|excel|powerpoint|outlook)\s+(365|expert|2019)/i.test(baseLower)
    || /^cấu trúc đề mos/i.test(baseLower)
    || /^(word|excel|outlook|powerpoint)[-\s]2019\.(docx|pdf)$/i.test(baseLower)
    || /^exam[-\s]?[123](-2-2019)?\.docx$/i.test(baseLower)
  );
  if (isOfficialSpec) {
    return {
      action: 'approve',
      tier: 2,
      sourceOrigin: 'microsoft_official_spec',
      priorityWeight: 1.15,
      accessLevel: 'student',
    };
  }

  // Tier 3: Tài liệu chuyên đề theo Tab / Module kỹ năng CNTT đã duyệt tham khảo
  const isApprovedTopicRef = (
    /^(tab (data|file|formula|home|insert|page layout|view)|interface - |word-(tab|insert|references|review)-|reference-index|ppt-|powerpoint-tab-|zoom-slide-|tài liệu (excel|word|powerpoint) mos 2019|20201020-modul-|tài liệu excel\.pdf|tài liệu kỹ năng máy tính\.pdf|bai tap thuc hanh word 25-26|bài tập tổng hợp thi chứng chỉ|đề ôn tập)/i.test(baseLower)
  );
  if (isApprovedTopicRef) {
    return {
      action: 'approve',
      tier: 3,
      sourceOrigin: 'approved_topic_reference',
      priorityWeight: 1.0,
      accessLevel: 'student',
    };
  }

  return { action: 'quarantine', reason: 'unapproved_unclassified_document' };
}

function inferMetadata(filePath, policy) {
  const norm = normalizePathSlashes(filePath);
  const lower = norm.toLowerCase();
  const base = path.basename(filePath);
  const baseLower = base.toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  let software = 'general_it';
  if (/excel|bảng tính|subtotal|aggregate|vlookup|xlookup|pivot|formula|sheet|macbook_excel/i.test(lower)) {
    software = 'excel';
  } else if (/powerpoint|\bppt\b|slide|animation|transition|zoom-slide|macbook_powerpoint/i.test(lower)) {
    software = 'powerpoint';
  } else if (/\bword\b|soạn thảo|văn bản|toc|footnote|citation|restrict-editing|trackings-and-changes|macbook_word/i.test(lower)) {
    software = 'word';
  } else if (/outlook|mo-400/i.test(lower)) {
    software = 'outlook';
  } else if (/access|mo-500|77-730/i.test(lower)) {
    software = 'access';
  } else if (/zalo/i.test(lower)) {
    software = 'zalo';
  } else if (/ic3|gs6/i.test(lower)) {
    software = 'ic3';
  } else if (/máy tính|may_vi_tinh|macbook_may_vi_tinh|modul-01|modul-02|modul-06|sử dụng mt|thủ thuật cơ bản/i.test(lower)) {
    software = 'windows';
  } else if (/phím tắt|phim tat/i.test(lower)) {
    software = 'shortcuts';
  } else if (/\bmos\b/i.test(lower)) {
    software = 'mos';
  }

  let officeVersion = 'all';
  if (/\b2016\b|\b77-72[5-9]\b|\b77-730\b/.test(baseLower) || lower.includes('/mos 2016/')) officeVersion = '2016';
  else if (/\b2019\b|\bmo-[1-5]00\b/.test(baseLower) || lower.includes('/mos 2019/')) officeVersion = '2019';
  else if (/\b365\b|\b2026\b/.test(baseLower) || lower.includes('/mos 365/')) officeVersion = '365';

  let docType = 'topic_reference';
  if (lower.includes('d:/mẫu trắc nghiệm/') || /trắc nghiệm|tracnghiem|câu hỏi/i.test(baseLower)) {
    docType = 'quiz_bank';
  } else if (/phím tắt/i.test(baseLower)) {
    docType = 'cheatsheet';
  } else if (/giáo trình|lộ trình|sử dụng mt|giao_trinh|huong-dan|chuan-ky-nang/i.test(baseLower) || /^(word|excel|powerpoint)\s*365\.docx$/i.test(baseLower)) {
    docType = 'curriculum';
  } else if (policy.sourceOrigin === 'microsoft_official_spec') {
    docType = 'official_spec';
  } else if (/đề thi|đề ôn|exam|thực hành|bài tập/i.test(baseLower)) {
    docType = 'exam_guide';
  }

  const docTitle = base.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const isMac = /macbook|macos/i.test(baseLower);

  return {
    fileName: base,
    docTitle,
    ext,
    software,
    officeVersion,
    docType,
    isMac,
    sourceOrigin: policy.sourceOrigin,
    tier: policy.tier,
    priorityWeight: policy.priorityWeight,
    accessLevel: policy.accessLevel,
  };
}

function isLikelyHeadingLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 3 || s.length > 95) return false;
  if (/^(PHẦN|CHƯƠNG|BÀI|BUỔI|MODULE|MODUN|MỤC|BƯỚC|PART|UNIT|PROJECT|TASK)\b/i.test(s)) return true;
  if (/^\d+(?:\.\d+){0,3}\.?\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯ]/u.test(s) && !/[.;]$/.test(s)) return true;
  const letters = s.replace(/[^a-zA-ZÀ-ỹ]/g, '');
  if (letters.length >= 5 && letters === letters.toUpperCase() && !/[.;,]$/.test(s)) return true;
  return false;
}

function extractParagraphXmlText(pXml) {
  const normalized = pXml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<a:br\b[^>]*\/>/g, '\n');
  const runs = [];
  const tRe = /<(?:w|a):t\b[^>]*>([\s\S]*?)<\/(?:w|a):t>/g;
  let m;
  while ((m = tRe.exec(normalized)) !== null) {
    runs.push(decodeXmlEntities(m[1]));
  }
  return runs.join('').replace(/[ \t]+/g, ' ').trim();
}

async function extractDocxSegments(filePath) {
  const buf = fs.readFileSync(filePath);
  const entries = readZipEntries(buf);
  const docEntry = entries.get('word/document.xml');
  if (!docEntry) {
    throw new Error('DOCX missing word/document.xml');
  }
  const xml = docEntry.readBuffer().toString('utf8');
  const segments = [];
  let currentSection = 'Nội dung chính';

  // Tokenize tables and standalone paragraphs in order
  const blockRe = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let match;
  let paraIndex = 0;

  while ((match = blockRe.exec(xml)) !== null) {
    const block = match[0];
    if (block.startsWith('<w:tbl')) {
      const rowTexts = [];
      const trRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let trM;
      while ((trM = trRe.exec(block)) !== null) {
        const cellTexts = [];
        const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
        let tcM;
        while ((tcM = tcRe.exec(trM[0])) !== null) {
          const cellParts = [];
          const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
          let pM;
          while ((pM = pRe.exec(tcM[0])) !== null) {
            const pt = extractParagraphXmlText(pM[0]);
            if (pt) cellParts.push(pt);
          }
          cellTexts.push(cellParts.join(' / '));
        }
        const rowLine = cellTexts.filter(Boolean).join(' | ').trim();
        if (rowLine) rowTexts.push(rowLine);
      }
      if (rowTexts.length) {
        paraIndex += 1;
        segments.push({
          text: rowTexts.join('\n'),
          location: { sectionTitle: currentSection, blockIndex: paraIndex },
        });
      }
      continue;
    }

    const styleM = block.match(/<w:pStyle\s+w:val="([^"]+)"/i);
    const styleVal = styleM ? styleM[1] : '';
    const text = extractParagraphXmlText(block);
    if (!text) continue;
    paraIndex += 1;

    const isXmlHeading = /Heading|Title|Subtitle|TieuDe/i.test(styleVal);
    if ((isXmlHeading || isLikelyHeadingLine(text)) && text.length <= 120) {
      currentSection = text;
    }
    segments.push({
      text,
      isHeading: isXmlHeading || isLikelyHeadingLine(text),
      location: { sectionTitle: currentSection, blockIndex: paraIndex },
    });
  }

  return { segments, unextractablePages: [], totalUnits: paraIndex };
}

async function extractPptxSegments(filePath) {
  const buf = fs.readFileSync(filePath);
  const entries = readZipEntries(buf);
  const slideEntries = [];
  for (const [name, entry] of entries.entries()) {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (m) slideEntries.push({ slideNum: Number(m[1]), entry });
  }
  slideEntries.sort((a, b) => a.slideNum - b.slideNum);

  const segments = [];
  const unextractableSlides = [];

  for (const { slideNum, entry } of slideEntries) {
    const xml = entry.readBuffer().toString('utf8');
    const paras = [];
    const pRe = /<a:p\b[\s\S]*?<\/a:p>/g;
    let m;
    while ((m = pRe.exec(xml)) !== null) {
      const t = extractParagraphXmlText(m[0]);
      if (t) paras.push(t);
    }

    // Check slide notes if available
    const notesEntry = entries.get(`ppt/notesSlides/notesSlide${slideNum}.xml`);
    if (notesEntry) {
      const notesXml = notesEntry.readBuffer().toString('utf8');
      const noteParas = [];
      let nm;
      while ((nm = pRe.exec(notesXml)) !== null) {
        const nt = extractParagraphXmlText(nm[0]);
        if (nt && !/^\d+$/.test(nt)) noteParas.push(nt);
      }
      if (noteParas.length) {
        paras.push(`Ghi chú slide: ${noteParas.join(' ')}`);
      }
    }

    const joined = paras.join('\n').trim();
    if (joined.length < 10) {
      unextractableSlides.push(slideNum);
      continue;
    }
    const sectionTitle = paras[0] ? paras[0].slice(0, 100) : `Slide ${slideNum}`;
    segments.push({
      text: joined,
      isHeading: true,
      location: { slide: slideNum, sectionTitle },
    });
  }

  return { segments, unextractablePages: unextractableSlides, totalUnits: slideEntries.length };
}

function formatCellValue(cell) {
  if (!cell) return '';
  let v = '';
  if (cell.w !== undefined && cell.w !== null && String(cell.w).trim() !== '') {
    v = String(cell.w).trim();
  } else if (cell.v !== undefined && cell.v !== null) {
    v = String(cell.v).trim();
  }
  if (cell.f && !String(v).startsWith('=')) {
    const formula = String(cell.f).trim();
    return v ? `${v} [=${formula}]` : `=${formula}`;
  }
  return v;
}

function extractXlsxSegments(filePath) {
  const wb = XLSX.readFile(filePath, { cellStyles: false, cellHTML: false, cellFormula: true });
  const segments = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // Sparse scan of populated keys to avoid O(rows*cols) blowup on overly formatted sheets
    const rowMap = new Map();
    for (const key of Object.keys(ws)) {
      if (key.startsWith('!')) continue;
      const decoded = XLSX.utils.decode_cell(key);
      const val = formatCellValue(ws[key]);
      if (!val) continue;
      if (!rowMap.has(decoded.r)) rowMap.set(decoded.r, []);
      rowMap.get(decoded.r).push({ c: decoded.c, val });
    }
    const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);
    if (!sortedRows.length) continue;

    // Detect if first populated row is a quiz header row
    const firstCells = rowMap.get(sortedRows[0]).sort((a, b) => a.c - b.c);
    const headerByCol = new Map(firstCells.map((x) => [x.c, x.val]));
    const isQuizSheet = firstCells.some((x) => /câu hỏi|question/i.test(x.val))
      && firstCells.some((x) => /đáp án/i.test(x.val));

    let currentSection = sheetName;
    const lines = [];
    for (let idx = 0; idx < sortedRows.length; idx += 1) {
      const r = sortedRows[idx];
      const cells = rowMap.get(r).sort((a, b) => a.c - b.c);
      if (isQuizSheet && idx > 0) {
        const qaParts = cells.map((cell) => {
          const h = headerByCol.get(cell.c);
          return h ? `${h}: ${cell.val}` : cell.val;
        });
        const line = qaParts.join(' | ');
        if (line) {
          segments.push({
            text: line,
            location: { sheet: sheetName, row: r + 1, sectionTitle: `Câu hỏi ${sheetName}` },
          });
        }
        continue;
      }

      const rowVals = cells.map((x) => x.val).filter(Boolean);
      if (!rowVals.length) continue;
      const line = rowVals.join(' | ');
      if (rowVals.length === 1 && isLikelyHeadingLine(rowVals[0])) {
        if (lines.length) {
          segments.push({
            text: lines.join('\n'),
            location: { sheet: sheetName, sectionTitle: currentSection },
          });
          lines.length = 0;
        }
        currentSection = rowVals[0];
      }
      lines.push(line);
    }

    if (lines.length) {
      segments.push({
        text: lines.join('\n'),
        location: { sheet: sheetName, sectionTitle: currentSection },
      });
    }
  }

  return { segments, unextractablePages: [], totalUnits: wb.SheetNames.length };
}

async function extractPdfSegments(filePath) {
  const pdfjsLib = await getPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;

  const segments = [];
  const unextractablePages = [];
  let currentSection = '';

  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const linesMap = new Map();
    for (const it of tc.items) {
      const str = String(it.str || '');
      if (!str.trim()) continue;
      const yBucket = Math.round((it.transform?.[5] || 0) / 3) * 3;
      const xPos = it.transform?.[4] || 0;
      if (!linesMap.has(yBucket)) linesMap.set(yBucket, []);
      linesMap.get(yBucket).push({ x: xPos, str });
    }
    const yKeys = [...linesMap.keys()].sort((a, b) => b - a);
    const lines = [];
    for (const y of yKeys) {
      const lineText = linesMap.get(y)
        .sort((a, b) => a.x - b.x)
        .map((it) => it.str)
        .join(' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      if (lineText) lines.push(lineText);
    }
    const pageText = lines.join('\n').trim();
    page.cleanup?.();

    if (pageText.replace(/\s+/g, '').length < 20) {
      unextractablePages.push(p);
      continue;
    }

    const firstHeading = lines.find((l) => isLikelyHeadingLine(l));
    if (firstHeading) currentSection = firstHeading;

    segments.push({
      text: pageText,
      location: { page: p, sectionTitle: currentSection || `Trang ${p}` },
    });
  }

  await doc.destroy?.();
  return { segments, unextractablePages, totalUnits: doc.numPages };
}

function extractTxtSegments(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const segments = [];
  let currentSection = 'Nội dung chính';
  let buf = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (buf.length) buf.push('');
      continue;
    }
    if (isLikelyHeadingLine(line) || /^#{1,4}\s+/.test(line)) {
      if (buf.length) {
        const joined = buf.join('\n').trim();
        if (joined) segments.push({ text: joined, location: { sectionTitle: currentSection } });
        buf = [];
      }
      currentSection = line.replace(/^#{1,4}\s+/, '').trim();
    }
    buf.push(line);
  }
  if (buf.length) {
    const joined = buf.join('\n').trim();
    if (joined) segments.push({ text: joined, location: { sectionTitle: currentSection } });
  }
  return { segments, unextractablePages: [], totalUnits: segments.length };
}

async function extractDocumentSegments(filePath, ext) {
  if (ext === '.docx') return extractDocxSegments(filePath);
  if (ext === '.pptx') return extractPptxSegments(filePath);
  if (ext === '.xlsx') return extractXlsxSegments(filePath);
  if (ext === '.pdf') return extractPdfSegments(filePath);
  if (ext === '.txt' || ext === '.md') return extractTxtSegments(filePath);
  throw new Error(`Unsupported parser extension: ${ext}`);
}

function cleanText(raw) {
  return String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLongTextWithOverlap(text, maxLen = MAX_CHUNK_CHARS, overlap = CHUNK_OVERLAP_CHARS) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units = [];

  for (const p of paras) {
    if (p.length <= maxLen) {
      units.push(p);
      continue;
    }
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
    let cur = '';
    for (const line of lines) {
      if (line.length > maxLen) {
        if (cur) { units.push(cur); cur = ''; }
        const sentences = line.split(/(?<=[.!?])\s+/);
        let sBuf = '';
        for (const s of sentences) {
          if ((sBuf + ' ' + s).length > maxLen && sBuf) {
            units.push(sBuf.trim());
            sBuf = sBuf.slice(-overlap) + ' ' + s;
          } else {
            sBuf += (sBuf ? ' ' : '') + s;
          }
        }
        if (sBuf.trim()) units.push(sBuf.trim());
      } else if ((cur + '\n' + line).length > maxLen && cur) {
        units.push(cur.trim());
        cur = cur.slice(-Math.min(overlap, 80)) + '\n' + line;
      } else {
        cur += (cur ? '\n' : '') + line;
      }
    }
    if (cur.trim()) units.push(cur.trim());
  }

  const merged = [];
  let buf = '';
  for (const u of units) {
    if (!buf || (buf.length + u.length + 2) <= maxLen) {
      buf = buf ? `${buf}\n\n${u}` : u;
    } else {
      if (buf.length >= MIN_CHUNK_CHARS) merged.push(buf);
      buf = u;
    }
  }
  if (buf.length >= MIN_CHUNK_CHARS) merged.push(buf);
  return merged;
}

function buildChunksFromSegments(segments, meta) {
  const chunks = [];
  let pendingText = '';
  let pendingLocation = null;

  const flushPending = () => {
    const cleaned = cleanText(pendingText);
    if (cleaned.length < MIN_CHUNK_CHARS) {
      pendingText = '';
      pendingLocation = null;
      return;
    }
    const parts = splitLongTextWithOverlap(cleaned);
    for (const part of parts) {
      chunks.push({
        text: part,
        location: pendingLocation || { sectionTitle: meta.docTitle },
      });
    }
    pendingText = '';
    pendingLocation = null;
  };

  for (const seg of segments) {
    const text = cleanText(seg.text);
    if (!text) continue;
    const loc = seg.location || { sectionTitle: meta.docTitle };

    const boundaryChanged = pendingLocation && (
      pendingLocation.page !== loc.page
      || pendingLocation.slide !== loc.slide
      || pendingLocation.sheet !== loc.sheet
      || (seg.isHeading && pendingText.length > 260)
    );

    if (boundaryChanged || (pendingText.length + text.length + 2 > MAX_CHUNK_CHARS && pendingText.length >= 220)) {
      flushPending();
    }

    if (!pendingLocation) pendingLocation = loc;
    pendingText = pendingText ? `${pendingText}\n${text}` : text;
  }
  flushPending();

  return chunks;
}

function extractTechnicalSignals(text, title) {
  const blob = `${title || ''}\n${text || ''}`;
  const fnSet = new Set();
  let m;
  EXCEL_FN_RE.lastIndex = 0;
  while ((m = EXCEL_FN_RE.exec(blob)) !== null) {
    fnSet.add(m[1].toUpperCase());
  }

  const scSet = new Set();
  SHORTCUT_RE.lastIndex = 0;
  while ((m = SHORTCUT_RE.exec(blob)) !== null) {
    scSet.add(m[0].toLowerCase().replace(/\s*\+\s*/g, '+').replace(/\bcommand\b/g, 'cmd'));
  }

  return {
    functions: [...fnSet].slice(0, 20),
    shortcuts: [...scSet].slice(0, 15),
  };
}

function textFingerprint(text) {
  return normalizeVietnamese(text).replace(/[^a-z0-9]+/g, ' ').trim();
}

function walkFiles(inputs) {
  const found = [];
  const stack = [...inputs];
  const visitedReal = new Set();

  while (stack.length) {
    const cur = stack.shift();
    if (!fs.existsSync(cur)) continue;
    let stat;
    try {
      stat = fs.statSync(cur);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      found.push(cur);
      continue;
    }
    if (stat.isDirectory()) {
      const real = fs.realpathSync(cur);
      if (visitedReal.has(real)) continue;
      visitedReal.add(real);
      let entries;
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        const full = path.join(cur, ent.name);
        if (ent.isDirectory()) stack.push(full);
        else if (ent.isFile()) found.push(full);
      }
    }
  }
  return found;
}

async function main() {
  const tStart = Date.now();
  fs.mkdirSync(SOURCES_DIR, { recursive: true });
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });

  console.log('==============================================================');
  console.log('  THANG TIN HOC AI KNOWLEDGE PIPELINE (READ-ONLY SOURCE SCAN)');
  console.log('==============================================================');

  const allFiles = walkFiles(DEFAULT_INPUT_PATHS);
  const candidates = [];
  const quarantined = [];
  const ignoredStats = {};

  for (const filePath of allFiles) {
    const policy = classifyDocumentPolicy(filePath);
    if (policy.action === 'ignore') {
      const ext = path.extname(filePath).toLowerCase() || '(none)';
      ignoredStats[ext] = (ignoredStats[ext] || 0) + 1;
      continue;
    }
    if (policy.action === 'quarantine') {
      quarantined.push({
        filePath,
        fileName: path.basename(filePath),
        ext: path.extname(filePath).toLowerCase(),
        reason: policy.reason,
        sizeBytes: fs.statSync(filePath).size,
      });
      continue;
    }
    candidates.push({ filePath, policy, meta: inferMetadata(filePath, policy) });
  }

  // Prefer higher-priority sources and editable formats (.docx/.pptx/.xlsx/.txt) over exported .pdf
  const extPriority = { '.docx': 1, '.txt': 2, '.md': 2, '.xlsx': 3, '.pptx': 4, '.pdf': 5 };
  candidates.sort((a, b) => {
    if (a.policy.tier !== b.policy.tier) return a.policy.tier - b.policy.tier;
    const ea = extPriority[a.meta.ext] || 9;
    const eb = extPriority[b.meta.ext] || 9;
    if (ea !== eb) return ea - eb;
    return a.filePath.localeCompare(b.filePath);
  });

  // Deduplicate by SHA-256
  const hashMap = new Map();
  const uniqueApproved = [];
  const duplicates = [];

  for (const item of candidates) {
    const sha256 = sha256File(item.filePath);
    const sizeBytes = fs.statSync(item.filePath).size;
    if (hashMap.has(sha256)) {
      duplicates.push({
        filePath: item.filePath,
        fileName: item.meta.fileName,
        sha256,
        sizeBytes,
        duplicateOf: hashMap.get(sha256).filePath,
      });
      continue;
    }
    const entry = { ...item, sha256, sizeBytes };
    hashMap.set(sha256, entry);
    uniqueApproved.push(entry);
  }

  console.log(`Scanned total files : ${allFiles.length}`);
  console.log(`Approved candidates : ${candidates.length}`);
  console.log(`SHA-256 duplicates  : ${duplicates.length}`);
  console.log(`Unique approved     : ${uniqueApproved.length}`);
  console.log(`Quarantined         : ${quarantined.length}`);
  console.log('');

  const indexedDocs = [];
  const allChunks = [];
  const unreadableFiles = [];
  const partialUnextractableFiles = [];
  const seenChunkFingerprints = new Set();
  let nearDuplicateChunksSkipped = 0;

  for (let i = 0; i < uniqueApproved.length; i += 1) {
    const item = uniqueApproved[i];
    const docId = `doc_${item.sha256.slice(0, 12)}`;
    try {
      const extracted = await extractDocumentSegments(item.filePath, item.meta.ext);
      const headSample = extracted.segments.slice(0, 8).map((s) => s.text).join('\n');
      if (/(?:microsoft\s+press|pearson\s+education|published\s+with\s+the\s+authorization\s+of\s+microsoft\s+corporation|ebook\s+edition\s+of\s+this\s+book)/i.test(headSample)) {
        quarantined.push({
          filePath: item.filePath,
          fileName: item.meta.fileName,
          ext: item.meta.ext,
          reason: 'third_party_commercial_book_microsoft_press',
          sizeBytes: item.sizeBytes,
        });
        console.log(`  [QUARANTINE-CONTENT] ${item.meta.fileName} -> third_party_commercial_book_microsoft_press`);
        continue;
      }

      const rawChunks = buildChunksFromSegments(extracted.segments, item.meta);

      const totalChars = rawChunks.reduce((acc, c) => acc + c.text.length, 0);
      if (!rawChunks.length || totalChars < 60) {
        unreadableFiles.push({
          docId,
          filePath: item.filePath,
          fileName: item.meta.fileName,
          ext: item.meta.ext,
          reason: 'NO_EXTRACTABLE_TEXT_OR_IMAGE_ONLY',
          unextractablePages: extracted.unextractablePages,
        });
        console.log(`  [UNREADABLE] ${item.meta.fileName} (pages/units: ${extracted.totalUnits}, unextractable: ${extracted.unextractablePages.length})`);
        continue;
      }

      if (extracted.unextractablePages.length > 0) {
        partialUnextractableFiles.push({
          docId,
          fileName: item.meta.fileName,
          filePath: item.filePath,
          totalUnits: extracted.totalUnits,
          unextractablePages: extracted.unextractablePages,
        });
      }

      let docChunksCount = 0;
      for (let cIdx = 0; cIdx < rawChunks.length; cIdx += 1) {
        const chunk = rawChunks[cIdx];
        const fp = textFingerprint(chunk.text);
        if (fp.length >= 60 && seenChunkFingerprints.has(fp)) {
          nearDuplicateChunksSkipped += 1;
          continue;
        }
        if (fp.length >= 60) seenChunkFingerprints.add(fp);

        const signals = extractTechnicalSignals(chunk.text, item.meta.docTitle);
        const chunkId = `${docId}_c${String(cIdx + 1).padStart(4, '0')}`;
        allChunks.push({
          id: chunkId,
          docId,
          fileName: item.meta.fileName,
          docTitle: item.meta.docTitle,
          software: item.meta.software,
          officeVersion: item.meta.officeVersion,
          docType: item.meta.docType,
          isMac: item.meta.isMac,
          sourceOrigin: item.meta.sourceOrigin,
          tier: item.meta.tier,
          priorityWeight: item.meta.priorityWeight,
          accessLevel: item.meta.accessLevel,
          location: chunk.location,
          functions: signals.functions,
          shortcuts: signals.shortcuts,
          text: chunk.text,
        });
        docChunksCount += 1;
      }

      indexedDocs.push({
        docId,
        fileName: item.meta.fileName,
        docTitle: item.meta.docTitle,
        sourcePath: item.filePath,
        sha256: item.sha256,
        sizeBytes: item.sizeBytes,
        software: item.meta.software,
        officeVersion: item.meta.officeVersion,
        docType: item.meta.docType,
        sourceOrigin: item.meta.sourceOrigin,
        tier: item.meta.tier,
        accessLevel: item.meta.accessLevel,
        chunksCount: docChunksCount,
        totalUnits: extracted.totalUnits,
        unextractablePages: extracted.unextractablePages,
      });

      console.log(`  [OK] [T${item.meta.tier}/${item.meta.software}/${item.meta.officeVersion}] ${item.meta.fileName} -> ${docChunksCount} chunks`);
    } catch (err) {
      unreadableFiles.push({
        docId,
        filePath: item.filePath,
        fileName: item.meta.fileName,
        ext: item.meta.ext,
        reason: 'PARSE_ERROR',
        error: String(err.message || err).slice(0, 300),
      });
      console.warn(`  [ERR] ${item.meta.fileName}: ${err.message}`);
    }
  }

  // Reconcile unreadable files against clean successfully indexed twins (read-only binary magic check)
  const cleanByFileName = new Map();
  for (const d of indexedDocs) {
    const key = d.fileName.toLowerCase();
    if (!cleanByFileName.has(key)) cleanByFileName.set(key, d);
  }
  for (const u of unreadableFiles) {
    const twin = cleanByFileName.get(String(u.fileName || '').toLowerCase());
    if (twin) {
      u.status = 'SUPERSEDED_BY_CLEAN_TWIN';
      u.cleanTwinPath = twin.sourcePath;
      u.cleanTwinChunks = twin.chunksCount;
    } else {
      u.status = 'UNRECOVERABLE_CORRUPT_BINARY';
      try {
        const fd = fs.openSync(u.filePath, 'r');
        const head = Buffer.alloc(16);
        const bytesRead = fs.readSync(fd, head, 0, 16, 0);
        fs.closeSync(fd);
        u.magicHex16 = head.subarray(0, bytesRead).toString('hex');
      } catch {
        u.magicHex16 = null;
      }
    }
  }
  const supersededCorruptCopiesCount = unreadableFiles.filter((u) => u.status === 'SUPERSEDED_BY_CLEAN_TWIN').length;
  const unrecoverableFilesCount = unreadableFiles.filter((u) => u.status === 'UNRECOVERABLE_CORRUPT_BINARY').length;

  const builtAt = new Date().toISOString();
  const knowledgeVersion = crypto
    .createHash('sha256')
    .update(`${builtAt}:${allChunks.length}:${indexedDocs.length}`)
    .digest('hex')
    .slice(0, 12);

  const indexPayload = {
    version: knowledgeVersion,
    builtAt,
    publishedToStudents: false,
    hasVectors: false,
    stats: {
      totalSourceFilesScanned: allFiles.length,
      approvedCandidates: candidates.length,
      sha256DuplicatesRemoved: duplicates.length,
      uniqueApprovedFiles: uniqueApproved.length,
      processedSuccessFiles: indexedDocs.length,
      unreadableFilesCount: unreadableFiles.length,
      supersededCorruptCopiesCount,
      unrecoverableFilesCount,
      quarantinedFilesCount: quarantined.length,
      nearDuplicateChunksSkipped,
      totalSearchableChunks: allChunks.length,
      buildDurationMs: Date.now() - tStart,
    },
    documents: indexedDocs.map((d) => ({
      docId: d.docId,
      docTitle: d.docTitle,
      fileName: d.fileName,
      software: d.software,
      officeVersion: d.officeVersion,
      docType: d.docType,
      sourceOrigin: d.sourceOrigin,
      tier: d.tier,
      accessLevel: d.accessLevel,
      chunksCount: d.chunksCount,
    })),
    chunks: allChunks,
  };

  const manifestPayload = {
    version: knowledgeVersion,
    builtAt,
    sourcesScanned: DEFAULT_INPUT_PATHS,
    approvedDocuments: indexedDocs,
    sha256Duplicates: duplicates,
  };

  const quarantinePayload = {
    builtAt,
    totalQuarantined: quarantined.length,
    byReason: quarantined.reduce((acc, q) => {
      acc[q.reason] = (acc[q.reason] || 0) + 1;
      return acc;
    }, {}),
    files: quarantined,
  };

  const reportPayload = {
    builtAt,
    knowledgeVersion,
    durationMs: Date.now() - tStart,
    summary: indexPayload.stats,
    bySoftware: allChunks.reduce((acc, c) => {
      acc[c.software] = (acc[c.software] || 0) + 1;
      return acc;
    }, {}),
    byOfficeVersion: allChunks.reduce((acc, c) => {
      acc[c.officeVersion] = (acc[c.officeVersion] || 0) + 1;
      return acc;
    }, {}),
    byTier: allChunks.reduce((acc, c) => {
      const k = `tier_${c.tier}_${c.sourceOrigin}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    ignoredNonTextByExt: ignoredStats,
    unreadableFiles,
    partialUnextractableFiles,
    quarantineSummary: quarantinePayload.byReason,
  };

  fs.writeFileSync(path.join(INDEX_DIR, 'knowledgeIndex.json'), JSON.stringify(indexPayload, null, 2), 'utf8');
  fs.writeFileSync(path.join(MANIFESTS_DIR, 'ingestion-manifest.json'), JSON.stringify(manifestPayload, null, 2), 'utf8');
  fs.writeFileSync(path.join(QUARANTINE_DIR, 'quarantine-manifest.json'), JSON.stringify(quarantinePayload, null, 2), 'utf8');
  fs.writeFileSync(path.join(REPORTS_DIR, 'ingestion-report.json'), JSON.stringify(reportPayload, null, 2), 'utf8');

  const mdLines = [
    '# Báo Cáo Pipeline Nạp Kho Tri Thức AI',
    '',
    `- **Thời gian tạo:** ${builtAt}`,
    `- **Phiên bản kho tri thức:** \`${knowledgeVersion}\``,
    `- **Thời gian xử lý:** ${reportPayload.durationMs} ms`,
    `- **Tổng file quét được:** ${indexPayload.stats.totalSourceFilesScanned}`,
    `- **Tài liệu được phê duyệt (trước loại trùng):** ${indexPayload.stats.approvedCandidates}`,
    `- **Bản trùng SHA-256 đã loại:** ${indexPayload.stats.sha256DuplicatesRemoved}`,
    `- **Tài liệu xử lý thành công:** ${indexPayload.stats.processedSuccessFiles}`,
    `- **Tài liệu lỗi / không đọc được chữ:** ${indexPayload.stats.unreadableFilesCount} (trong đó ${indexPayload.stats.supersededCorruptCopiesCount} bản sao hỏng đã có bản gốc sạch thay thế, ${indexPayload.stats.unrecoverableFilesCount} file hỏng không thể khôi phục)`,
    `- **Tài liệu đưa vào Quarantine (chưa duyệt / bên thứ 3 / phôi):** ${indexPayload.stats.quarantinedFilesCount}`,
    `- **Số đoạn (chunks) gần trùng bỏ qua:** ${nearDuplicateChunksSkipped}`,
    `- **Tổng số đoạn (chunks) sẵn sàng tìm kiếm RAG:** ${indexPayload.stats.totalSearchableChunks}`,
    '',
    '## Phân bố Chunks theo Phần mềm / Chủ đề',
    ...Object.entries(reportPayload.bySoftware).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- \`${k}\`: ${v} chunks`),
    '',
    '## Phân bố Chunks theo Phiên bản Office',
    ...Object.entries(reportPayload.byOfficeVersion).map(([k, v]) => `- \`${k}\`: ${v} chunks`),
    '',
    '## Tài liệu Quarantine theo Lý do',
    ...Object.entries(quarantinePayload.byReason).map(([k, v]) => `- \`${k}\`: ${v} files`),
    '',
    '## Tài liệu lỗi / không trích xuất được',
    ...(unreadableFiles.length
      ? unreadableFiles.map((f) => `- \`${f.fileName}\` [${f.status}] (${f.reason}${f.error ? `: ${f.error}` : ''})${f.cleanTwinPath ? ` -> Đã có bản sạch thay thế: \`${f.cleanTwinPath}\` (${f.cleanTwinChunks} chunks)` : ''}${f.magicHex16 ? ` [magic=${f.magicHex16}]` : ''}`)
      : ['- Không có tài liệu lỗi.']),
  ];
  fs.writeFileSync(path.join(REPORTS_DIR, 'ingestion-report.md'), mdLines.join('\n'), 'utf8');

  console.log('');
  console.log('=== HOAN TAT BUILD KHO TRI THUC ===');
  console.log(JSON.stringify(indexPayload.stats, null, 2));
}

main().catch((err) => {
  console.error('[FATAL build-ai-knowledge]', err);
  process.exit(1);
});
