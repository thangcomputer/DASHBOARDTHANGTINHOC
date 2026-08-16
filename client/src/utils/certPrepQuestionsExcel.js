/**
 * Client-side CertPrep question Excel (mirror server columns).
 * Export không phụ thuộc server có package xlsx.
 */
let _xlsx = null;
async function getXLSX() {
  if (_xlsx) return _xlsx;
  _xlsx = await import('xlsx');
  return _xlsx;
}

const HEADERS = [
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
];

function indexToLetter(i) {
  return String.fromCharCode(65 + Number(i));
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

export function questionToExcelRow({ levelTitle, testName, question: q }) {
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

export async function downloadCertPrepQuestionsExcel(rows, filename) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const data = [HEADERS, ...rows.map((r) => HEADERS.map((h) => (r[h] != null ? r[h] : '')))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Cau hoi');

  const guide = [
    ['Huong dan Export/Import cau hoi CertPrep (MOS/IC3)'],
    [''],
    ['Moi dong = 1 cau. Cot Level + De thi de ghep dung cap do/de.'],
    ['Loai: single_choice | multiple_choice | matching | true_false_grid'],
    ['Single/Multi: Dap an A..F, Dap an dung = A hoac A,C'],
    ['Matching: Cot A/B cach | ; Cap dung A1=B2|A2=B1'],
    ['TF grid: Nhan dinh dang Noi dung=true|Noi dung=false'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'Huong dan');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'certprep-questions.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
