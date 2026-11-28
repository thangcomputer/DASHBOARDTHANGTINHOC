'use strict';

const zlib = require('zlib');
const XLSX = require('xlsx');

const MAX_EXTRACTED_CHARS = 28000;
const MAX_SHEETS = 12;
const MAX_ROWS_PER_SHEET = 180;
const MAX_COLS_PER_ROW = 40;
const MAX_ZIP_ENTRIES = 400;
const MAX_ZIP_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const PDF_EXT_RE = /\.pdf$/i;
const EXCEL_EXT_RE = /\.(xlsx|xlsm|xls|ods)$/i;
const DOCX_EXT_RE = /\.docx$/i;
const PPTX_EXT_RE = /\.pptx$/i;
const ODT_EXT_RE = /\.odt$/i;
const LEGACY_OFFICE_EXT_RE = /\.(doc|ppt)$/i;

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripAllXmlTags(xml) {
  return decodeXmlEntities(String(xml || '').replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n');
}

/**
 * Pure Node ZIP parser (supports method 0 stored & method 8 deflate via zlib) with bomb caps.
 * @param {Buffer} buffer
 * @returns {Map<string, Buffer>}
 */
function readZipEntries(buffer) {
  const entries = new Map();
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) return entries;

  const minOffset = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Không tìm thấy cấu trúc ZIP hợp lệ trong tệp đính kèm.');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`Tệp nén chứa quá nhiều mục (${totalEntries}).`);
  }
  if (centralDirOffset + centralDirSize > buffer.length) {
    throw new Error('Cấu trúc tệp nén bị lỗi hoặc chưa tải đủ dữ liệu.');
  }

  let offset = centralDirOffset;
  let totalUncompressed = 0;

  for (let idx = 0; idx < totalEntries && offset + 46 <= centralDirOffset + centralDirSize; idx += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLen).toString('utf8');
    offset += 46 + fileNameLen + extraLen + commentLen;

    if (!fileName || fileName.endsWith('/')) continue;

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error('Dung lượng dữ liệu giải nén vượt quá giới hạn cho phép.');
    }

    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      continue;
    }

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = Math.min(buffer.length, dataStart + compressedSize);
    const rawSlice = buffer.slice(dataStart, dataEnd);

    if (method === 0) {
      entries.set(fileName, rawSlice);
    } else if (method === 8) {
      try {
        entries.set(fileName, zlib.inflateRawSync(rawSlice));
      } catch {
        // Bỏ qua entry nén lỗi để vẫn đọc được phần còn lại
      }
    }
  }

  return entries;
}

function formatCellValue(cell) {
  if (!cell) return '';
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    const yyyy = cell.v.getFullYear();
    const mm = String(cell.v.getMonth() + 1).padStart(2, '0');
    const dd = String(cell.v.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const formatted = cell.w !== undefined && cell.w !== null ? String(cell.w).trim() : '';
  const rawVal = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
  if (cell.f) {
    const valStr = formatted || rawVal;
    return valStr !== '' ? `=${cell.f} [=> ${valStr}]` : `=${cell.f}`;
  }
  return (formatted || rawVal).replace(/\s+/g, ' ');
}

function parseSpreadsheetBuffer(buffer, fileName = 'workbook.xlsx') {
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: true,
    cellDates: true,
    cellNF: true,
  });

  const sheetNames = (wb.SheetNames || []).slice(0, MAX_SHEETS);
  if (sheetNames.length === 0) {
    return {
      extractedText: `Tệp bảng tính "${fileName}" không có sheet dữ liệu nào.`,
      meta: { sheetCount: 0 },
    };
  }

  const lines = [`=== FILE BẢNG TÍNH: ${fileName} (${sheetNames.length} sheet) ===`];
  let totalRowsRendered = 0;
  let truncated = false;

  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const ref = String(ws['!ref'] || '').trim();
    lines.push('');
    lines.push(`=== SHEET: ${sheetName}${ref ? ` (Phạm vi: ${ref})` : ''} ===`);

    if (!ref) {
      lines.push('(Sheet trống)');
      continue;
    }

    const merges = Array.isArray(ws['!merges']) ? ws['!merges'] : [];
    if (merges.length > 0) {
      const mergeStr = merges
        .slice(0, 20)
        .map((m) => XLSX.utils.encode_range(m))
        .join(', ');
      lines.push(`Ô gộp (Merged cells): ${mergeStr}${merges.length > 20 ? ', ...' : ''}`);
    }

    const range = XLSX.utils.decode_range(ref);
    const maxC = Math.min(range.e.c, range.s.c + MAX_COLS_PER_ROW - 1);
    let rowsInSheet = 0;

    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const rowCells = [];
      for (let c = range.s.c; c <= maxC; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        const valText = formatCellValue(cell);
        if (!valText) continue;
        rowCells.push(`${addr}: ${valText}`);
      }
      if (!rowCells.length) continue;

      rowsInSheet += 1;
      totalRowsRendered += 1;
      if (rowsInSheet > MAX_ROWS_PER_SHEET) {
        truncated = true;
        lines.push(`... (Sheet "${sheetName}" còn nhiều dòng hơn, đã dừng ở ${MAX_ROWS_PER_SHEET} dòng có dữ liệu)`);
        break;
      }
      lines.push(rowCells.join(' | '));
      if (lines.join('\n').length >= MAX_EXTRACTED_CHARS) {
        truncated = true;
        break;
      }
    }

    if (rowsInSheet === 0) {
      lines.push('(Không có dữ liệu trong sheet)');
    }
    if (truncated) break;
  }

  const outText = lines.join('\n').slice(0, MAX_EXTRACTED_CHARS);
  return {
    extractedText: outText,
    meta: {
      sheetCount: sheetNames.length,
      totalRowsRendered,
      truncated,
    },
  };
}

function extractWordTextFromRun(xmlFragment) {
  return decodeXmlEntities(
    String(xmlFragment || '')
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/?>/g, '\n')
      .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, '$1')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseWordParagraphBlock(pXml) {
  const styleMatch = String(pXml || '').match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
  const styleVal = styleMatch ? String(styleMatch[1]) : '';
  const hasNumPr = /<w:numPr\b/i.test(pXml || '');
  const text = extractWordTextFromRun(pXml);
  if (!text) return '';
  if (/^heading\s*([1-6])|title/i.test(styleVal)) {
    const levelMatch = styleVal.match(/([1-6])/);
    const hashes = '#'.repeat(Math.min(4, Math.max(2, Number(levelMatch?.[1] || 2))));
    return `${hashes} ${text}`;
  }
  if (hasNumPr) return `- ${text}`;
  return text;
}

function parseWordTableBlock(tblXml) {
  const rowMatches = String(tblXml || '').match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (!rowMatches.length) return '';
  const rows = [];
  let maxCols = 0;

  for (const rowXml of rowMatches) {
    const cellMatches = rowXml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const cells = cellMatches.map((tcXml) => {
      const pMatches = tcXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
      const joined = pMatches.map((p) => extractWordTextFromRun(p)).filter(Boolean).join(' / ');
      return (joined || extractWordTextFromRun(tcXml)).replace(/\|/g, '\\|');
    });
    if (cells.length) {
      maxCols = Math.max(maxCols, cells.length);
      rows.push(cells);
    }
  }

  if (!rows.length || !maxCols) return '';
  const padRow = (r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return `| ${padded.join(' | ')} |`;
  };
  const out = [padRow(rows[0]), `| ${Array(maxCols).fill('---').join(' | ')} |`];
  for (let i = 1; i < rows.length; i += 1) {
    out.push(padRow(rows[i]));
  }
  return out.join('\n');
}

function parseWordXmlBody(xmlStr) {
  const bodyMatch = String(xmlStr || '').match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/i);
  const body = bodyMatch ? bodyMatch[1] : String(xmlStr || '');
  const blocks = [];
  const tokenRe = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let match;
  let inTableDepth = false;

  // Vì regex không phân biệt <w:p> nằm trong <w:tbl>, xử lý theo lát cắt ngoài bảng
  let cursor = 0;
  const tblRe = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  while ((match = tblRe.exec(body)) !== null) {
    const before = body.slice(cursor, match.index);
    const pBefore = before.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
    for (const pXml of pBefore) {
      const line = parseWordParagraphBlock(pXml);
      if (line) blocks.push(line);
    }
    const mdTbl = parseWordTableBlock(match[0]);
    if (mdTbl) blocks.push(mdTbl);
    cursor = match.index + match[0].length;
    inTableDepth = true;
  }
  const rest = body.slice(cursor);
  const pRest = rest.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  for (const pXml of pRest) {
    const line = parseWordParagraphBlock(pXml);
    if (line) blocks.push(line);
  }
  if (!inTableDepth && blocks.length === 0) {
    const fallback = stripAllXmlTags(body).trim();
    if (fallback) blocks.push(fallback);
  }
  void tokenRe;
  return blocks;
}

function parseDocxBuffer(buffer, fileName = 'document.docx') {
  const entries = readZipEntries(buffer);
  const docBuf = entries.get('word/document.xml');
  if (!docBuf) {
    throw new Error(`Không tìm thấy nội dung word/document.xml trong "${fileName}".`);
  }

  const lines = [`=== FILE WORD (.DOCX): ${fileName} ===`];
  const bodyBlocks = parseWordXmlBody(docBuf.toString('utf8'));
  lines.push(...bodyBlocks);

  const extraXmlNames = [...entries.keys()]
    .filter((k) => /^word\/(header|footer)\d*\.xml$/i.test(k) || k === 'word/comments.xml')
    .sort();
  for (const name of extraXmlNames) {
    const buf = entries.get(name);
    if (!buf) continue;
    const extraBlocks = parseWordXmlBody(buf.toString('utf8'));
    if (extraBlocks.length) {
      lines.push('');
      lines.push(`[${name.replace('word/', '').replace('.xml', '').toUpperCase()}]`);
      lines.push(...extraBlocks);
    }
  }

  const extractedText = lines.join('\n\n').slice(0, MAX_EXTRACTED_CHARS);
  return {
    extractedText,
    meta: { paragraphAndTableBlocks: bodyBlocks.length },
  };
}

function extractDrawingParagraphs(xmlStr) {
  const pMatches = String(xmlStr || '').match(/<a:p\b[\s\S]*?<\/a:p>/g) || [];
  const lines = [];
  for (const pXml of pMatches) {
    const textMatches = pXml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || [];
    const line = textMatches
      .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '')))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) lines.push(line);
  }
  return lines;
}

function parsePptxBuffer(buffer, fileName = 'presentation.pptx') {
  const entries = readZipEntries(buffer);
  const slideNames = [...entries.keys()]
    .filter((k) => /^ppt\/slides\/slide(\d+)\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return na - nb;
    });

  if (!slideNames.length) {
    throw new Error(`Không tìm thấy slide nào trong tệp PowerPoint "${fileName}".`);
  }

  const lines = [`=== FILE POWERPOINT (.PPTX): ${fileName} (${slideNames.length} slides) ===`];
  for (const slidePath of slideNames) {
    const num = slidePath.match(/slide(\d+)\.xml/i)?.[1] || '?';
    const slideBuf = entries.get(slidePath);
    if (!slideBuf) continue;
    const slideLines = extractDrawingParagraphs(slideBuf.toString('utf8'));
    lines.push('');
    lines.push(`=== SLIDE ${num} ===`);
    if (slideLines.length) {
      lines.push(...slideLines.map((l) => `- ${l}`));
    } else {
      lines.push('(Slide không có văn bản)');
    }

    const notePath = `ppt/notesSlides/notesSlide${num}.xml`;
    const noteBuf = entries.get(notePath);
    if (noteBuf) {
      const noteLines = extractDrawingParagraphs(noteBuf.toString('utf8')).filter((l) => l !== String(num));
      if (noteLines.length) {
        lines.push(`Ghi chú Slide ${num}: ${noteLines.join(' ')}`);
      }
    }
    if (lines.join('\n').length >= MAX_EXTRACTED_CHARS) break;
  }

  return {
    extractedText: lines.join('\n').slice(0, MAX_EXTRACTED_CHARS),
    meta: { slideCount: slideNames.length },
  };
}

function parseOdtBuffer(buffer, fileName = 'document.odt') {
  const entries = readZipEntries(buffer);
  const contentBuf = entries.get('content.xml');
  if (!contentBuf) {
    throw new Error(`Không đọc được content.xml trong tệp "${fileName}".`);
  }
  const xml = contentBuf.toString('utf8');
  const pMatches = xml.match(/<text:(?:h|p)\b[\s\S]*?<\/text:(?:h|p)>/g) || [];
  const lines = [`=== FILE VĂN BẢN (.ODT): ${fileName} ===`];
  for (const block of pMatches) {
    const clean = stripAllXmlTags(block).replace(/\s+/g, ' ').trim();
    if (clean) lines.push(clean);
  }
  return {
    extractedText: lines.join('\n\n').slice(0, MAX_EXTRACTED_CHARS),
    meta: { blocks: lines.length - 1 },
  };
}

function extractAttachmentForAi(att) {
  if (!att || typeof att !== 'object') return null;
  const name = String(att.name || 'attachment').trim();
  const mime = String(att.mimeType || '').trim().toLowerCase();
  const dataBase64 = String(att.dataBase64 || '').trim();
  const rawTextContent = String(att.textContent || '').trim();

  // 1. Hình ảnh chụp màn hình / ảnh đề bài
  if (mime.startsWith('image/') || IMAGE_EXT_RE.test(name)) {
    return {
      kind: 'image',
      isVision: true,
      mimeType: mime || 'image/png',
      dataBase64,
      extractedText: rawTextContent,
      meta: { name },
    };
  }

  // 2. Tài liệu PDF (gửi native PDF vision lên Gemini Pro)
  if (mime === 'application/pdf' || PDF_EXT_RE.test(name)) {
    return {
      kind: 'pdf',
      isVision: true,
      mimeType: 'application/pdf',
      dataBase64,
      extractedText: rawTextContent,
      meta: { name },
    };
  }

  // 3. Tệp Excel / Bảng tính
  if (EXCEL_EXT_RE.test(name) || /spreadsheetml|ms-excel|opendocument\.spreadsheet/i.test(mime)) {
    if (!dataBase64) {
      return {
        kind: 'excel',
        isVision: false,
        extractedText: rawTextContent,
        meta: { name },
      };
    }
    try {
      const buf = Buffer.from(dataBase64, 'base64');
      const parsed = parseSpreadsheetBuffer(buf, name);
      return {
        kind: 'excel',
        isVision: false,
        extractedText: parsed.extractedText,
        meta: { name, ...parsed.meta },
      };
    } catch (err) {
      return {
        kind: 'excel',
        isVision: false,
        unsupportedReason: `Không đọc được tệp Excel "${name}" (${err?.message || 'lỗi định dạng'}). Bạn hãy kiểm tra xem file có bị đặt mật khẩu hoặc thử lưu lại dạng .xlsx chuẩn rồi gửi lại nhé.`,
        meta: { name },
      };
    }
  }

  // 4. Tệp Word .docx
  if (DOCX_EXT_RE.test(name) || /wordprocessingml/i.test(mime)) {
    if (!dataBase64) {
      return {
        kind: 'word',
        isVision: false,
        extractedText: rawTextContent,
        meta: { name },
      };
    }
    try {
      const buf = Buffer.from(dataBase64, 'base64');
      const parsed = parseDocxBuffer(buf, name);
      return {
        kind: 'word',
        isVision: false,
        extractedText: parsed.extractedText,
        meta: { name, ...parsed.meta },
      };
    } catch (err) {
      return {
        kind: 'word',
        isVision: false,
        unsupportedReason: `Không đọc được tệp Word "${name}" (${err?.message || 'lỗi định dạng'}). Bạn thử lưu lại dưới dạng .docx hoặc xuất PDF rồi tải lên nhé.`,
        meta: { name },
      };
    }
  }

  // 5. Tệp PowerPoint .pptx
  if (PPTX_EXT_RE.test(name) || /presentationml/i.test(mime)) {
    if (!dataBase64) {
      return {
        kind: 'powerpoint',
        isVision: false,
        extractedText: rawTextContent,
        meta: { name },
      };
    }
    try {
      const buf = Buffer.from(dataBase64, 'base64');
      const parsed = parsePptxBuffer(buf, name);
      return {
        kind: 'powerpoint',
        isVision: false,
        extractedText: parsed.extractedText,
        meta: { name, ...parsed.meta },
      };
    } catch (err) {
      return {
        kind: 'powerpoint',
        isVision: false,
        unsupportedReason: `Không đọc được tệp PowerPoint "${name}" (${err?.message || 'lỗi định dạng'}). Bạn thử lưu lại dưới dạng .pptx hoặc PDF rồi gửi lại nhé.`,
        meta: { name },
      };
    }
  }

  // 6. Tệp .odt
  if (ODT_EXT_RE.test(name) || /opendocument\.text/i.test(mime)) {
    if (dataBase64) {
      try {
        const parsed = parseOdtBuffer(Buffer.from(dataBase64, 'base64'), name);
        return {
          kind: 'word',
          isVision: false,
          extractedText: parsed.extractedText,
          meta: { name, ...parsed.meta },
        };
      } catch (err) {
        return {
          kind: 'word',
          isVision: false,
          unsupportedReason: `Không đọc được tệp "${name}" (${err?.message || 'lỗi định dạng'}).`,
          meta: { name },
        };
      }
    }
  }

  // 7. Định dạng nhị phân cũ (.doc / .ppt) chưa hỗ trợ trực tiếp nếu không có text
  if (LEGACY_OFFICE_EXT_RE.test(name)) {
    return {
      kind: 'office_legacy',
      isVision: false,
      unsupportedReason: `Tệp "${name}" đang ở định dạng Office cũ (.doc / .ppt) nên hệ thống chưa trích xuất trực tiếp được. Bạn hãy mở tệp và chọn **Save As → .docx / .pptx** (hoặc **PDF**), sau đó tải lên lại để DewSkill AI đọc trọn vẹn nội dung và giải chính xác nhé.`,
      meta: { name },
    };
  }

  // 8. Văn bản / CSV / code
  let text = rawTextContent;
  if (!text && dataBase64) {
    try {
      text = Buffer.from(dataBase64, 'base64').toString('utf8').trim();
    } catch {
      text = '';
    }
  }
  return {
    kind: 'text',
    isVision: false,
    extractedText: text.slice(0, MAX_EXTRACTED_CHARS),
    meta: { name },
  };
}

module.exports = {
  readZipEntries,
  parseSpreadsheetBuffer,
  parseDocxBuffer,
  parsePptxBuffer,
  parseOdtBuffer,
  extractAttachmentForAi,
};
