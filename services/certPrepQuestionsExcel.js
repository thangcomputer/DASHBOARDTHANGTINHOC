'use strict';

const XLSX = require('xlsx');
const { validateQuestion, QUESTION_TYPES } = require('./certPrepQuestionValidation');

const SHEET_QUESTIONS = 'Cau hoi';
const SHEET_GUIDE = 'Huong dan';

const HEADERS = Object.freeze([
  'Level',
  'De thi',
  'Locale',
  'Loai',
  'Cau hoi',
  'Hinh cau hoi',
  'Goi y',
  'Hinh goi y',
  'Giai thich',
  'Hinh giai thich',
  'Thu tu',
  'Bat',
  'Dap an A',
  'Dap an B',
  'Dap an C',
  'Dap an D',
  'Dap an E',
  'Dap an F',
  'Hinh A',
  'Hinh B',
  'Hinh C',
  'Hinh D',
  'Hinh E',
  'Hinh F',
  'Dap an dung',
  'Min select',
  'Cot A',
  'Cot B',
  'Cap dung',
  'Nhan dinh',
]);

const TYPE_ALIASES = {
  single_choice: 'single_choice',
  'mot dap an': 'single_choice',
  'một đáp án': 'single_choice',
  '1 dap an': 'single_choice',
  multiple_choice: 'multiple_choice',
  'nhieu dap an': 'multiple_choice',
  'nhiều đáp án': 'multiple_choice',
  matching: 'matching',
  'ghep cau': 'matching',
  'ghép câu': 'matching',
  true_false_grid: 'true_false_grid',
  'dung / sai (nhieu dong)': 'true_false_grid',
  'đúng / sai (nhiều dòng)': 'true_false_grid',
  'dung sai': 'true_false_grid',
  'đúng sai': 'true_false_grid',
};

function stripVi(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function pick(row, aliases) {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const want = stripVi(alias);
    for (const [k, v] of entries) {
      if (stripVi(k) === want) return v;
    }
  }
  return undefined;
}

function cellStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function splitPipe(s) {
  return cellStr(s)
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}

function letterToIndex(letter) {
  const ch = String(letter || '').trim().toUpperCase();
  if (!/^[A-F]$/.test(ch)) return null;
  return ch.charCodeAt(0) - 65;
}

function indexToLetter(i) {
  return String.fromCharCode(65 + Number(i));
}

function parseType(raw) {
  const key = stripVi(raw);
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  if (QUESTION_TYPES.includes(key)) return key;
  return null;
}

function parseLocale(raw) {
  const s = stripVi(raw);
  if (s === 'en' || s === 'english' || s === 'tieng anh') return 'en';
  return 'vi';
}

function parseActive(raw) {
  if (raw == null || raw === '') return true;
  const s = stripVi(raw);
  if (['0', 'false', 'tat', 'off', 'no', 'khong'].includes(s)) return false;
  return true;
}

function serializeOptions(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  const row = {};
  for (let i = 0; i < 6; i += 1) {
    const letter = indexToLetter(i);
    row[`Dap an ${letter}`] = opts[i]?.text || '';
    row[`Hinh ${letter}`] = opts[i]?.imageUrl || '';
  }
  return row;
}

function serializeCorrect(q) {
  if (q.type === 'single_choice' && Number.isInteger(Number(q.correctAnswer))) {
    return indexToLetter(Number(q.correctAnswer));
  }
  if (q.type === 'multiple_choice') {
    return (q.correctIndices || [])
      .map((n) => indexToLetter(n))
      .filter(Boolean)
      .join(',');
  }
  return '';
}

function serializeMatching(q) {
  const items = q.matchingItems || [];
  const targets = q.matchingTargets || [];
  const pairs = q.matchingPairs || [];
  return {
    'Cot A': items.map((n) => n.text || '').join('|'),
    'Cot B': targets.map((n) => n.text || '').join('|'),
    'Cap dung': pairs.map((p) => {
      const ii = items.findIndex((n) => String(n.id) === String(p.itemId));
      const ti = targets.findIndex((n) => String(n.id) === String(p.targetId));
      if (ii < 0 || ti < 0) return '';
      return `A${ii + 1}=B${ti + 1}`;
    }).filter(Boolean).join('|'),
  };
}

function serializeStatements(q) {
  const statements = q.statements || [];
  return {
    'Nhan dinh': statements
      .map((s) => `${s.text || ''}=${s.correct === true ? 'true' : 'false'}`)
      .join('|'),
  };
}

function questionToRow({ levelTitle, testName, question: q }) {
  return {
    Level: levelTitle || '',
    'De thi': testName || '',
    Locale: q.locale || 'vi',
    Loai: q.type || '',
    'Cau hoi': q.questionText || '',
    'Hinh cau hoi': q.questionImage || '',
    'Goi y': q.hint || '',
    'Hinh goi y': q.hintImage || '',
    'Giai thich': q.explanation || '',
    'Hinh giai thich': q.explanationImage || '',
    'Thu tu': q.sortOrder != null ? q.sortOrder : 0,
    Bat: q.isActive === false ? 'Tat' : 'Bat',
    ...serializeOptions(q),
    'Dap an dung': serializeCorrect(q),
    'Min select': q.minSelect != null ? q.minSelect : '',
    ...serializeMatching(q),
    ...serializeStatements(q),
  };
}

function parseOptions(row) {
  const options = [];
  for (let i = 0; i < 6; i += 1) {
    const letter = indexToLetter(i);
    const text = cellStr(pick(row, [`Dap an ${letter}`, `Đáp án ${letter}`]));
    const imageUrl = cellStr(pick(row, [`Hinh ${letter}`, `Hình ${letter}`]));
    if (!text && !imageUrl) continue;
    options.push({ text, imageUrl });
  }
  return options;
}

function parseCorrectLetters(raw, optionsLen) {
  const parts = cellStr(raw)
    .split(/[,;/\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const indices = [];
  for (const p of parts) {
    const idx = letterToIndex(p);
    if (idx == null || idx >= optionsLen) continue;
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices;
}

function parseMatching(row) {
  const colA = splitPipe(pick(row, ['Cot A', 'Cột A']));
  const colB = splitPipe(pick(row, ['Cot B', 'Cột B']));
  const matchingItems = colA.map((text, i) => ({
    id: `a${i + 1}`,
    text,
    imageUrl: '',
  }));
  const matchingTargets = colB.map((text, i) => ({
    id: `b${i + 1}`,
    text,
    imageUrl: '',
  }));
  const matchingPairs = [];
  for (const pair of splitPipe(pick(row, ['Cap dung', 'Cặp đúng']))) {
    const m = pair.match(/^A\s*(\d+)\s*=\s*B\s*(\d+)$/i);
    if (!m) continue;
    const ai = Number(m[1]) - 1;
    const bi = Number(m[2]) - 1;
    if (!matchingItems[ai] || !matchingTargets[bi]) continue;
    matchingPairs.push({
      itemId: matchingItems[ai].id,
      targetId: matchingTargets[bi].id,
    });
  }
  return { matchingItems, matchingTargets, matchingPairs };
}

function parseStatements(row) {
  const statements = [];
  splitPipe(pick(row, ['Nhan dinh', 'Nhận định'])).forEach((chunk, i) => {
    const eq = chunk.lastIndexOf('=');
    if (eq < 0) {
      statements.push({ id: `s${i + 1}`, text: chunk, correct: true });
      return;
    }
    const text = chunk.slice(0, eq).trim();
    const flag = stripVi(chunk.slice(eq + 1));
    const correct = ['true', '1', 'dung', 'yes', 'y', 'đúng'].includes(flag)
      || !['false', '0', 'sai', 'no', 'n'].includes(flag);
    const isFalse = ['false', '0', 'sai', 'no', 'n'].includes(flag);
    statements.push({
      id: `s${i + 1}`,
      text,
      correct: isFalse ? false : correct,
    });
  });
  return statements;
}

function rowToQuestionPayload(row, rowIndex) {
  const levelTitle = cellStr(pick(row, ['Level', 'Cap do', 'Cấp độ']));
  const testName = cellStr(pick(row, ['De thi', 'Đề thi', 'Ten de', 'Tên đề']));
  const locale = parseLocale(pick(row, ['Locale', 'Ngon ngu', 'Ngôn ngữ']));
  const type = parseType(pick(row, ['Loai', 'Loại', 'Type']));
  const questionText = cellStr(pick(row, ['Cau hoi', 'Câu hỏi']));
  if (!levelTitle) {
    return { ok: false, rowIndex, message: 'Thiếu Level' };
  }
  if (!testName) {
    return { ok: false, rowIndex, message: 'Thiếu Đề thi' };
  }
  if (!type) {
    return { ok: false, rowIndex, message: 'Loại câu hỏi không hợp lệ' };
  }
  if (!questionText) {
    return { ok: false, rowIndex, message: 'Nội dung câu hỏi trống' };
  }

  const payload = {
    levelTitle,
    testName,
    locale,
    type,
    questionText,
    questionImage: cellStr(pick(row, ['Hinh cau hoi', 'Hình câu hỏi'])),
    hint: cellStr(pick(row, ['Goi y', 'Gợi ý'])),
    hintImage: cellStr(pick(row, ['Hinh goi y', 'Hình gợi ý'])),
    explanation: cellStr(pick(row, ['Giai thich', 'Giải thích'])),
    explanationImage: cellStr(pick(row, ['Hinh giai thich', 'Hình giải thích'])),
    sortOrder: Number(pick(row, ['Thu tu', 'Thứ tự'])) || 0,
    isActive: parseActive(pick(row, ['Bat', 'Bật', 'Trang thai'])),
    options: [],
    correctAnswer: null,
    correctIndices: [],
    minSelect: null,
    matchingItems: [],
    matchingTargets: [],
    matchingPairs: [],
    statements: [],
  };

  if (type === 'single_choice' || type === 'multiple_choice') {
    payload.options = parseOptions(row);
    const indices = parseCorrectLetters(pick(row, ['Dap an dung', 'Đáp án đúng']), payload.options.length);
    if (type === 'single_choice') {
      payload.correctAnswer = indices[0] != null ? indices[0] : null;
    } else {
      payload.correctIndices = indices;
      const minRaw = pick(row, ['Min select', 'So dap an can chon']);
      if (minRaw != null && String(minRaw).trim() !== '') {
        payload.minSelect = Number(minRaw);
      }
    }
  } else if (type === 'matching') {
    Object.assign(payload, parseMatching(row));
  } else if (type === 'true_false_grid') {
    payload.statements = parseStatements(row);
  }

  const check = validateQuestion(payload);
  if (!check.ok) {
    return { ok: false, rowIndex, message: check.message };
  }
  return { ok: true, rowIndex, payload };
}

function buildWorkbookBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const data = [HEADERS, ...rows.map((r) => HEADERS.map((h) => (r[h] != null ? r[h] : '')))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_QUESTIONS);

  const guide = [
    ['Huong dan Export/Import cau hoi CertPrep (MOS/IC3)'],
    [''],
    ['Moi dong = 1 cau. Cot Level + De thi dung de ghep vao dung cap do/de trong mon.'],
    ['Loai: single_choice | multiple_choice | matching | true_false_grid'],
    ['Single/Multi: dien Dap an A..F, Dap an dung = A hoac A,C'],
    ['Matching: Cot A / Cot B cach bang | ; Cap dung dang A1=B2|A2=B1'],
    ['TF grid: Nhan dinh dang Noi dung=true|Noi dung=false'],
    ['Hinh: chi URL (khong nhung file anh trong Excel)'],
    ['Import mac dinh them moi; co the ghi de toan mon (xoa mem cau cu).'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  XLSX.utils.book_append_sheet(wb, wsGuide, SHEET_GUIDE);

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function parseWorkbookBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find((n) => stripVi(n) === stripVi(SHEET_QUESTIONS))
    || wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowIndex: 0, message: 'File Excel không có sheet' }] };
  }
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const parsed = [];
  const errors = [];
  json.forEach((row, i) => {
    const result = rowToQuestionPayload(row, i + 2); // header = row 1
    if (!result.ok) errors.push({ rowIndex: result.rowIndex, message: result.message });
    else parsed.push(result);
  });
  return { rows: parsed, errors };
}

module.exports = {
  HEADERS,
  SHEET_QUESTIONS,
  questionToRow,
  buildWorkbookBuffer,
  parseWorkbookBuffer,
  rowToQuestionPayload,
};
