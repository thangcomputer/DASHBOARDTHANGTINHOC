export function normalizeQuickQuery(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const QUESTION_INTENT_RE = /(?:^|\s)(?:la gi|cach|tai sao|vi sao|nhu the nao|lam sao|lam the nao|huong dan|giai thich|so sanh|phan biet|khac nhau|loi|ham|cong thuc|phim tat|o dau|khi nao|bao nhieu|co the|nen dung|tai ve|sua loi|what|how|why|when|where|which|explain|compare|difference|fix|error|formula|function|shortcut|help|tell me|tutorial|guide)(?:\s|$|[?!.,])/i;

export function isLikelyQuestion(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (raw.includes('?') || raw.includes('？')) return true;
  const norm = normalizeQuickQuery(raw);
  if (!norm) return false;
  if (QUESTION_INTENT_RE.test(norm)) return true;
  const words = norm.split(' ').filter(Boolean);
  return words.length > 4;
}

const COMPLEX_QUERY_RE = /(?:\bso sanh\b|\bkhac nhau\b|\bcompare\b|\bdifference\b|\bvs\b|#n\/a|#value!|#ref!|#name\?|#div\/0!|\bkhong ra\b|\bbi sai\b|\bkhong chay\b|\btại sao.*lỗi\b|\btai sao.*loi\b|\bmy formula\b|\bmy sheet\b)/i;

const OFFICE_MEMORY_ENTRIES = [
  {
    id: 'vlookup',
    match: (n) => /\bvlookup\b/.test(n) && !/\bxlookup\b|\bindex\b|\bmatch\b/.test(n),
    vi: [
      '**Hàm `VLOOKUP` trong Excel** dùng để dò tìm một giá trị theo **cột đầu tiên** của bảng và trả về dữ liệu ở cột tương ứng cùng hàng.',
      '- **Cú pháp:** `=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])`',
      '- **Ý nghĩa từng đối số:** `lookup_value` (giá trị cần tìm) · `table_array` (bảng dò, nhớ bấm `F4` cố định `$A$2:$D$20`) · `col_index_num` (số thứ tự cột cần lấy, tính từ 1) · `0` hoặc `FALSE` để tìm **chính xác**.',
      '- **Ví dụ:** `=VLOOKUP(A2, $E$2:$G$50, 2, 0)` → tìm mã ở `A2` trong cột `E`, lấy giá trị ở cột `F` (cột thứ 2).',
    ].join('\n'),
    en: [
      '**Excel `VLOOKUP`** searches for a value in the **first column** of a table and returns a matching value from the same row.',
      '- **Syntax:** `=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])`',
      '- **Key tips:** Lock `table_array` with `F4` (e.g., `$E$2:$G$50`), set `col_index_num` counting from column 1 of the table, and use `0` (`FALSE`) for an **exact match**.',
      '- **Example:** `=VLOOKUP(A2, $E$2:$G$50, 2, 0)` → looks up `A2` in column `E` and returns column `F` (2nd column).',
    ].join('\n'),
  },
  {
    id: 'xlookup',
    match: (n) => /\bxlookup\b/.test(n) && !/\bvlookup\b/.test(n),
    vi: [
      '**Hàm `XLOOKUP` trong Excel** (bản mới) thay thế `VLOOKUP`/`HLOOKUP`: dò được theo mọi hướng (trái/phải/lên/xuống) và mặc định khớp chính xác.',
      '- **Cú pháp:** `=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])`',
      '- **Ví dụ:** `=XLOOKUP(A2, $E$2:$E$50, $G$2:$G$50, "Không thấy")`',
    ].join('\n'),
    en: [
      '**Excel `XLOOKUP`** replaces `VLOOKUP`/`HLOOKUP`: it looks up in any direction and defaults to an exact match.',
      '- **Syntax:** `=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])`',
      '- **Example:** `=XLOOKUP(A2, $E$2:$E$50, $G$2:$G$50, "Not found")`',
    ].join('\n'),
  },
  {
    id: 'sumif_sumifs',
    match: (n) => /\bsumifs?\b/.test(n) && !/\bcountifs?\b/.test(n),
    vi: [
      '**Hàm `SUMIF` và `SUMIFS`** dùng để tính tổng theo điều kiện trong Excel:',
      '- **1 điều kiện (`SUMIF`):** `=SUMIF(vùng_điều_kiện, điều_kiện, [vùng_tính_tổng])` — ví dụ `=SUMIF(B2:B20, "Excel", C2:C20)`',
      '- **Nhiều điều kiện (`SUMIFS`):** `=SUMIFS(vùng_tính_tổng, vùng_đk_1, đk_1, vùng_đk_2, đk_2)` — lưu ý **`SUMIFS` đưa vùng tính tổng lên đầu tiên**.',
    ].join('\n'),
    en: [
      '**`SUMIF` and `SUMIFS`** sum values that meet one or multiple criteria in Excel:',
      '- **Single criterion (`SUMIF`):** `=SUMIF(criteria_range, criteria, [sum_range])` — e.g. `=SUMIF(B2:B20, "Excel", C2:C20)`',
      '- **Multiple criteria (`SUMIFS`):** `=SUMIFS(sum_range, criteria_range1, criteria1, ...)` — note **`sum_range` comes first** in `SUMIFS`.',
    ].join('\n'),
  },
  {
    id: 'countif_countifs',
    match: (n) => /\bcountifs?\b/.test(n),
    vi: [
      '**Hàm `COUNTIF` và `COUNTIFS`** dùng để đếm số ô thỏa điều kiện:',
      '- **1 điều kiện (`COUNTIF`):** `=COUNTIF(B2:B50, ">=8")` hoặc `=COUNTIF(A2:A50, "Đạt")`',
      '- **Nhiều điều kiện (`COUNTIFS`):** `=COUNTIFS(A2:A50, "Excel", B2:B50, ">=8")`',
    ].join('\n'),
    en: [
      '**`COUNTIF` and `COUNTIFS`** count cells matching one or more conditions:',
      '- **1 condition (`COUNTIF`):** `=COUNTIF(B2:B50, ">=8")` or `=COUNTIF(A2:A50, "Pass")`',
      '- **Multiple conditions (`COUNTIFS`):** `=COUNTIFS(A2:A50, "Excel", B2:B50, ">=8")`',
    ].join('\n'),
  },
  {
    id: 'if_logic',
    match: (n) => /\bham if\b|\bif\b.*(?:\band\b|\bor\b|\bdieu kien\b|\bcondition\b|\bformula\b|\bexcel\b|\bfunction\b|\bla gi\b|\bwhat\b)/.test(n),
    vi: [
      '**Hàm `IF` trong Excel** kiểm tra điều kiện Đúng/Sai rồi trả về giá trị tương ứng:',
      '- **Cú pháp:** `=IF(logical_test, value_if_true, value_if_false)`',
      '- **Kết hợp nhiều điều kiện:** dùng `AND(...)` (đồng thời) hoặc `OR(...)` (một trong các điều kiện). Chuỗi chữ luôn đặt trong dấu ngoặc kép `""`.',
      '- **Ví dụ:** `=IF(AND(B2>=5, C2>=5), "Đạt", "Chưa đạt")`',
    ].join('\n'),
    en: [
      '**Excel `IF`** checks whether a condition is TRUE or FALSE and returns one value accordingly:',
      '- **Syntax:** `=IF(logical_test, value_if_true, value_if_false)`',
      '- **Combine multiple checks:** nest `AND(...)` (all true) or `OR(...)` (any true). Wrap text results in quotes `""`.',
      '- **Example:** `=IF(AND(B2>=5, C2>=5), "Pass", "Review")`',
    ].join('\n'),
  },
  {
    id: 'index_match',
    match: (n) => /\bindex\b/.test(n) && /\bmatch\b/.test(n),
    vi: [
      '**Kết hợp `INDEX + MATCH`** giúp tra cứu linh hoạt hai chiều (dò được cả bên trái cột tìm kiếm):',
      '- **Cú pháp:** `=INDEX(cột_kết_quả, MATCH(giá_trị_tìm, cột_tìm, 0))`',
      '- **Ví dụ:** `=INDEX($A$2:$A$50, MATCH(F2, $C$2:$C$50, 0))` — tìm `F2` trong cột `C` rồi lấy giá trị tương ứng ở cột `A`.',
    ].join('\n'),
    en: [
      '**`INDEX + MATCH`** enables flexible two-way lookup (even to the left of the key column):',
      '- **Syntax:** `=INDEX(return_column, MATCH(lookup_value, lookup_column, 0))`',
      '- **Example:** `=INDEX($A$2:$A$50, MATCH(F2, $C$2:$C$50, 0))`',
    ].join('\n'),
  },
  {
    id: 'pivottable',
    match: (n) => /\bpivot\b|\bpivottable\b/.test(n),
    vi: [
      '**Tạo PivotTable nhanh trong Excel** để tổng hợp & thống kê bảng dữ liệu lớn:',
      '- **Bước 1:** Đặt con trỏ chuột bên trong bảng dữ liệu sạch (có tiêu đề cột, không gộp ô).',
      '- **Bước 2:** Vào thẻ **Insert** → **PivotTable** → nhấn **OK**.',
      '- **Bước 3:** Kéo trường phân nhóm vào **Rows/Columns**, trường cần tính tổng/đếm vào **Values**.',
    ].join('\n'),
    en: [
      '**Create a PivotTable in Excel** to summarize large datasets quickly:',
      '- **Step 1:** Click anywhere inside your clean table (with column headers, no merged header cells).',
      '- **Step 2:** Go to **Insert** → **PivotTable** → click **OK**.',
      '- **Step 3:** Drag category fields to **Rows/Columns** and numeric fields to **Values**.',
    ].join('\n'),
  },
  {
    id: 'word_toc',
    match: (n) => /\bmuc luc\b|\btable of contents\b/.test(n),
    vi: [
      '**Tạo mục lục tự động trong Word:**',
      '- **Bước 1:** Chọn các tiêu đề chương/mục rồi gán Style **Heading 1, Heading 2, Heading 3** ở thẻ **Home**.',
      '- **Bước 2:** Đặt con trỏ ở trang muốn chèn mục lục, vào thẻ **References** → **Table of Contents** → chọn mẫu có sẵn.',
      '- *Mẹo:* Khi thêm bớt trang, bấm **Update Table** → **Update page numbers only** để cập nhật số trang.',
    ].join('\n'),
    en: [
      '**Create an automatic Table of Contents in Word:**',
      '- **Step 1:** Apply **Heading 1, Heading 2, Heading 3** styles from the **Home** tab to section titles.',
      '- **Step 2:** Place the cursor where you want the TOC, go to **References** → **Table of Contents**, and pick a style.',
      '- *Tip:* Whenever pages shift, click **Update Table** to refresh numbers.',
    ].join('\n'),
  },
  {
    id: 'word_margins',
    match: (n) => /\bnghi dinh 30\b|\bcan le word\b|\bchinh le word\b|\bmargins?\b.*\bword\b|\bword\b.*\bmargins?\b/.test(n),
    vi: [
      '**Chỉnh lề trang chuẩn trong Word (Nghị định 30):**',
      '- Vào **Layout** (hoặc **Page Layout**) → **Margins** → **Custom Margins…**',
      '- Thiết lập chuẩn A4: **Top:** `20mm` (`2cm`), **Bottom:** `20mm`, **Left:** `30mm`, **Right:** `15mm`.',
      '- Font chữ văn bản hành chính phổ biến: **Times New Roman**, cỡ `13–14pt`, giãn dòng `1.15–1.3`.',
    ].join('\n'),
    en: [
      '**Adjust page margins in Microsoft Word:**',
      '- Go to **Layout** → **Margins** → **Custom Margins…**',
      '- Common standard (Vietnam Decree 30 / A4): **Top:** `20mm`, **Bottom:** `20mm`, **Left:** `30mm`, **Right:** `15mm`.',
      '- Click **Set As Default** if you want the layout applied to future documents.',
    ].join('\n'),
  },
  {
    id: 'ppt_master',
    match: (n) => /\bslide master\b/.test(n),
    vi: [
      '**Dùng Slide Master trong PowerPoint** để đồng bộ font chữ, logo, footer cho toàn bộ bài thuyết trình:',
      '- Vào thẻ **View** → **Slide Master**.',
      '- Chọn **slide đầu tiên (slide cha to nhất ở trên cùng)** để gắn logo/màu/font chung.',
      '- Sau khi chỉnh xong, vào thẻ **Slide Master** → **Close Master View** để quay lại soạn nội dung.',
    ].join('\n'),
    en: [
      '**Use Slide Master in PowerPoint** to keep fonts, colors, and logos consistent across all slides:',
      '- Open the **View** tab → **Slide Master**.',
      '- Select the **top parent slide** to apply global logo/fonts/footer.',
      '- Click **Close Master View** when finished to return to normal editing.',
    ].join('\n'),
  },
  {
    id: 'shortcuts',
    match: (n) => /\bphim tat\b|\bshortcuts?\b/.test(n),
    vi: [
      '**Bộ phím tắt Tin học Văn phòng hay dùng nhất:**',
      '- **Chung / Word / PowerPoint:** `Ctrl + C` (Sao chép) · `Ctrl + X` (Cắt) · `Ctrl + V` (Dán) · `Ctrl + Z` (Hoàn tác) · `Ctrl + S` (Lưu) · `Ctrl + P` (In) · `Ctrl + F` (Tìm kiếm).',
      '- **Excel:** `F4` (Cố định ô `$A$1` khi nhập công thức) · `Ctrl + T` (Tạo Table) · `Alt + =` (AutoSum) · `Ctrl + Shift + L` (Bật/tắt Filter) · `F2` (Sửa ô).',
    ].join('\n'),
    en: [
      '**Most useful Office IT keyboard shortcuts:**',
      '- **General / Word / PPT:** `Ctrl + C` (Copy) · `Ctrl + X` (Cut) · `Ctrl + V` (Paste) · `Ctrl + Z` (Undo) · `Ctrl + S` (Save) · `Ctrl + F` (Find).',
      '- **Excel:** `F4` (Toggle `$A$1` absolute reference) · `Ctrl + T` (Create Table) · `Alt + =` (AutoSum) · `Ctrl + Shift + L` (Toggle Filter) · `F2` (Edit cell).',
    ].join('\n'),
  },
];

export function matchLocalOfficeMemory(question, lang = 'vi') {
  const raw = String(question || '').trim();
  if (!raw || raw.length > 90) return null;
  const norm = normalizeQuickQuery(raw);
  if (!norm || COMPLEX_QUERY_RE.test(norm)) return null;
  const useEn = lang === 'en';
  for (const entry of OFFICE_MEMORY_ENTRIES) {
    if (entry.match(norm)) {
      return {
        source: 'memory',
        answer: useEn ? entry.en : entry.vi,
        actions: [],
      };
    }
  }
  return null;
}

export function mapActionPathToMobileRoute(actionPath, role = 'student') {
  const raw = String(actionPath || '').trim().toLowerCase();
  if (!raw) return null;
  const isTeacher = String(role || '') === 'teacher';

  if (raw === '/student' || raw === '/student/' || raw === '/teacher' || raw === '/teacher/') {
    return { tab: 'Home' };
  }
  if (raw.includes('#schedule')) return { tab: 'Schedule' };
  if (raw.includes('#materials')) return { stack: 'Materials' };
  if (raw.includes('#assignments')) return { stack: 'Assignments' };
  if (raw.includes('/daily-practice')) return { tab: isTeacher ? 'Home' : 'DailyPractice' };
  if (raw.includes('/lesson-practice')) return { tab: isTeacher ? 'Home' : 'CourseVideos' };
  if (raw.includes('/cert-prep')) return { stack: 'CertPrepCatalog' };
  if (raw.includes('/exam')) return { stack: 'StudentExam' };
  if (raw.includes('/inbox')) return { tab: 'Messages' };
  if (raw.includes('/feed')) return { tab: 'Feed' };
  if (raw.includes('/news')) return { stack: 'News' };
  if (raw.includes('/notifications')) return { stack: 'NotificationCenter' };
  if (raw.includes('/support')) return { stack: 'Support' };
  if (raw.includes('/finance')) return { tab: isTeacher ? 'Finance' : 'Home' };
  if (raw.includes('#students')) return { stack: 'Students' };
  if (raw.includes('#training')) return { stack: 'TeacherTraining' };
  if (raw.includes('#evaluations')) return { stack: 'Evaluations' };
  if (raw.includes('#tuition')) return { stack: 'Tuition' };
  if (raw.includes('#profile') || raw.includes('/profile')) return { tab: 'Profile' };
  return null;
}
