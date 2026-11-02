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

async function loadXlsx() {
  return import('xlsx');
}

export async function parseTeacherQuizQuestionsExcel(base64: string): Promise<ParsedQuestionBank> {
  if (!base64 || base64.length > MAX_EXCEL_BASE64_LENGTH) {
    return { questions: [], errors: ['Tệp Excel trống hoặc vượt quá giới hạn 5MB.'] };
  }
  const XLSX = await loadXlsx();
  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(base64, { type: 'base64', sheetRows: 1001 });
  } catch {
    return { questions: [], errors: ['Không đọc được tệp Excel.'] };
  }
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name).includes('cau hoi'))
    || workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { questions: [], errors: ['Tệp Excel không có trang tính câu hỏi.'] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
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
  const XLSX = await loadXlsx();
  const rows = questions.map((question) => ({
    Loại: 'Trắc nghiệm',
    'Phần thi': courseName,
    'Độ khó': 'Trung bình',
    'Câu hỏi': question.questionText,
    'Đáp án A': question.options[0] || '',
    'Đáp án B': question.options[1] || '',
    'Đáp án C': question.options[2] || '',
    'Đáp án D': question.options[3] || '',
    'Đáp án đúng': ['A', 'B', 'C', 'D'][question.correctAnswer] || 'A',
    'Gợi ý trả lời (tự luận)': question.explanation,
  }));
  if (includeSample) {
    rows.push({
      Loại: 'Trắc nghiệm',
      'Phần thi': courseName,
      'Độ khó': 'Trung bình',
      'Câu hỏi': 'Nội dung câu hỏi mẫu?',
      'Đáp án A': 'Phương án A',
      'Đáp án B': 'Phương án B',
      'Đáp án C': 'Phương án C',
      'Đáp án D': 'Phương án D',
      'Đáp án đúng': 'B',
      'Gợi ý trả lời (tự luận)': '',
    });
  }
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Cau hoi');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
}
