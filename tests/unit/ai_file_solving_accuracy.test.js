'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const XLSX = require('xlsx');

const { extractAttachmentForAi } = require('../../services/ai/attachmentParser');
const modelRouter = require('../../services/ai/modelRouter');

/**
 * Tạo ZIP hợp lệ tối thiểu trong bộ nhớ (Stored/Deflate) để kiểm thử .docx / .pptx parser.
 */
function buildMiniZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, content } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const rawBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compBuf = zlib.deflateRawSync(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(8, 8); // Deflate
    localHeader.writeUInt32LE(compBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);

    const localRecord = Buffer.concat([localHeader, nameBuf, compBuf]);
    localParts.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(compBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localRecord.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

test('attachmentParser: trích xuất chính xác tọa độ ô, công thức Excel (.xlsx), bảng Word (.docx) và slide (.pptx)', () => {
  // 1. Excel .xlsx thực tế kèm công thức
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền'],
    ['Laptop Dell', 3, 15000000, null],
  ]);
  ws.D2 = { t: 'n', f: 'B2*C2', v: 45000000 };
  XLSX.utils.book_append_sheet(wb, ws, 'DoanhThu');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const excelRes = extractAttachmentForAi({
    name: 'bai-tap-excel.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dataBase64: xlsxBuf.toString('base64'),
  });
  assert.equal(excelRes.kind, 'excel');
  assert.equal(excelRes.isVision, false);
  assert.ok(excelRes.extractedText.includes('SHEET: DoanhThu'));
  assert.ok(excelRes.extractedText.includes('A1: Sản phẩm'));
  assert.ok(excelRes.extractedText.includes('D2: =B2*C2 [=> 45000000]'));

  // 2. Word .docx với Heading & bảng
  const docXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Bài tập căn lề Word</w:t></w:r></w:p>
        <w:p><w:r><w:t>Yêu cầu lập bảng danh sách thiết bị:</w:t></w:r></w:p>
        <w:tbl>
          <w:tr><w:tc><w:p><w:r><w:t>Tên</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Giá</w:t></w:r></w:p></w:tc></w:tr>
          <w:tr><w:tc><w:p><w:r><w:t>Chuột</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>120000</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
      </w:body>
    </w:document>`;
  const docxBuf = buildMiniZip([{ name: 'word/document.xml', content: docXml }]);
  const wordRes = extractAttachmentForAi({
    name: 'de-bai-word.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dataBase64: docxBuf.toString('base64'),
  });
  assert.equal(wordRes.kind, 'word');
  assert.equal(wordRes.isVision, false);
  assert.ok(wordRes.extractedText.includes('## Bài tập căn lề Word'));
  assert.ok(wordRes.extractedText.includes('| Tên | Giá |'));
  assert.ok(wordRes.extractedText.includes('| Chuột | 120000 |'));

  // 3. PowerPoint .pptx
  const slide1 = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide 1 Tổng quan Excel</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  const note1 = `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Nhấn F5 để trình chiếu</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
  const pptxBuf = buildMiniZip([
    { name: 'ppt/slides/slide1.xml', content: slide1 },
    { name: 'ppt/notesSlides/notesSlide1.xml', content: note1 },
  ]);
  const pptxRes = extractAttachmentForAi({
    name: 'bai-giang.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    dataBase64: pptxBuf.toString('base64'),
  });
  assert.equal(pptxRes.kind, 'powerpoint');
  assert.ok(pptxRes.extractedText.includes('SLIDE 1'));
  assert.ok(pptxRes.extractedText.includes('Slide 1 Tổng quan Excel'));
  assert.ok(pptxRes.extractedText.includes('Nhấn F5 để trình chiếu'));
});

test('modelRouter & quickAskAssistant: đính kèm file Excel tự động giải nén và định tuyến tới gemini-3.1-pro-preview', async () => {
  const fileProfile = modelRouter.getModelProfile('qa_file_solve');
  assert.equal(fileProfile.models[0], 'gemini-3.1-pro-preview');
  assert.equal(fileProfile.thinkingBudget, 2048);
  assert.equal(fileProfile.temperature, 0.1);
  assert.equal(fileProfile.maxTokens, 4096);
  assert.equal(fileProfile.timeoutMs, 45000);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Mã NV', 'Lương ngày', 'Ngày công', 'Tổng lương'],
    ['NV01', 350000, 26, null],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'BangLuong');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const origLlmEntry = require.cache[llmPath];
  const origSvcEntry = require.cache[svcPath];

  const calls = [];
  require.cache[llmPath] = {
    id: llmPath,
    filename: llmPath,
    loaded: true,
    exports: {
      isAiConfigured: () => true,
      chatCompletion: async (opts) => {
        calls.push(opts);
        return {
          content: 'Công thức chuẩn tại `D2` là `=B2*C2`, kết quả bằng **9.100.000**.',
          model: opts.model,
        };
      },
    },
  };
  delete require.cache[svcPath];

  try {
    const { quickAskAssistant } = require('../../services/aiSupportService');
    const res = await quickAskAssistant({
      user: { id: 'stu-file-pro', role: 'student', name: 'An' },
      question: 'Giải giúp mình cột Tổng lương ở D2 trong file Excel này',
      attachment: {
        name: 'tinh-luong.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dataBase64: xlsxBuf.toString('base64'),
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, 'gemini-3.1-pro-preview');
    assert.equal(calls[0].thinkingBudget, 2048);
    assert.equal(calls[0].temperature, 0.1);
    assert.equal(calls[0].images.length, 0);

    const sysMsg = calls[0].messages.find((m) => m.role === 'system')?.content || '';
    const usrMsg = calls[0].messages.find((m) => m.role === 'user')?.content || '';
    assert.ok(sysMsg.includes('[CHẾ ĐỘ ĐỌC FILE & GIẢI BÀI CHÍNH XÁC CAO]'));
    assert.ok(usrMsg.includes('SHEET: BangLuong'));
    assert.ok(usrMsg.includes('NV01'));
    assert.ok(usrMsg.includes('350000'));
    assert.ok(res.answer.includes('=B2*C2'));

    // PDF cũng phải định tuyến lên gemini-3.1-pro-preview + thinkingBudget=2048
    await quickAskAssistant({
      user: { id: 'stu-file-pro', role: 'student', name: 'An' },
      question: 'Giải đề bài trong file PDF này',
      attachment: {
        name: 'de-thi.pdf',
        mimeType: 'application/pdf',
        dataBase64: Buffer.from('%PDF-1.4\n').toString('base64'),
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].model, 'gemini-3.1-pro-preview');
    assert.equal(calls[1].thinkingBudget, 2048);
    assert.equal(calls[1].images.length, 1);
    assert.equal(calls[1].images[0].mimeType, 'application/pdf');
  } finally {
    if (origLlmEntry) require.cache[llmPath] = origLlmEntry;
    else delete require.cache[llmPath];
    if (origSvcEntry) require.cache[svcPath] = origSvcEntry;
    else delete require.cache[svcPath];
  }
});
