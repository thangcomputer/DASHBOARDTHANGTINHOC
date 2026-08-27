// Rich HTML helpers for LMS rendered HTML.
/**
 * Rich text from Admin (contenteditable / RichTextEditor) is stored as HTML.
 * Use plain text for list previews; sanitize + innerHTML for expanded/detail views.
 */
import DOMPurify from 'dompurify';

/**
 * Mutates anchor tags under root so navigation opens a new tab (LMS tab stays in session).
 * Skips javascript:, mailto:, tel:, and simple in-document #fragment anchors.
 */
export function applyAnchorNewTabPolicy(rootElement) {
  if (!rootElement || typeof rootElement.querySelectorAll !== 'function') return;
  rootElement.querySelectorAll('a[href]').forEach((el) => {
    let href = (el.getAttribute('href') || '').trim();
    if (!href || /^javascript:/i.test(href) || /^data:/i.test(href)) return;
    if (/^mailto:/i.test(href) || /^tel:/i.test(href)) return;
    if (href === '#') return;
    if (/^#[^#/]+$/.test(href)) return;
    if (!/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href)) {
      href = href.startsWith('//') ? `https:${href}` : `https://${href.replace(/^\/+/, '')}`;
      el.setAttribute('href', href);
    }
    el.setAttribute('target', '_blank');
    const rel = (el.getAttribute('rel') || '')
      .split(/\s+/)
      .filter(Boolean);
    ['noopener', 'noreferrer'].forEach((token) => {
      if (!rel.includes(token)) rel.push(token);
    });
    el.setAttribute('rel', rel.join(' '));
  });
}

function rewriteAnchorsOpenInNewTab(html) {
  if (!html || typeof html !== 'string') return html;
  if (typeof document === 'undefined') return html;
  try {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    applyAnchorNewTabPolicy(wrap);
    return wrap.innerHTML;
  } catch {
    return html;
  }
}

export function htmlToPlainText(html) {
  if (html == null || typeof html !== 'string') return '';
  const s = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, ' \u2022 ')
    .replace(/<[^>]+>/g, ' ');
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel'],
  /** Cho phép ảnh data: (nội dung cũ) — ảnh mới nên upload /uploads. */
  ADD_DATA_URI_TAGS: ['img'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
};

/**
 * Sanitize admin/LMS rich HTML before dangerouslySetInnerHTML.
 * Uses DOMPurify (browser). Falls back to aggressive strip if DOM unavailable.
 */
export function sanitizeRichHtml(html) {
  if (!html || typeof html !== 'string') return '';

  let cleaned;
  if (typeof window !== 'undefined' && DOMPurify?.sanitize) {
    cleaned = DOMPurify.sanitize(html, PURIFY_CONFIG);
  } else {
    cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  }

  return rewriteAnchorsOpenInNewTab(cleaned);
}

/**
 * Sau sanitize: gắn resolveMediaUrl cho src ảnh /uploads (SPA khác origin API).
 * @param {string} html
 * @param {(url: string) => string} resolveUrl
 */
export function resolveRichHtmlMedia(html, resolveUrl) {
  if (!html || typeof html !== 'string' || typeof resolveUrl !== 'function') return html || '';
  return html.replace(
    /(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
    (_, pre, src, post) => `${pre}${resolveUrl(src) || src}${post}`,
  );
}

/** Phan cau hoi admin khop mon thi (coban <-> computer, ppt <-> powerpoint). */
const SUBJECT_SECTION_ALIASES = {
  coban: ['coban', 'computer', 'basic', 'maytinh', 'windows'],
  word: ['word'],
  excel: ['excel'],
  powerpoint: ['powerpoint', 'ppt', 'pp'],
  canva: ['canva'],
  situation: ['situation', 'supham', 'su-pham', 'pedagogy'],
};

export function questionMatchesExamSubject(section, subjectId) {
  if (section == null || subjectId == null) return false;
  const s = String(section).toLowerCase().trim();
  const id = String(subjectId).toLowerCase().trim();
  if (!s || !id) return false;
  if (s === id) return true;
  const aliases = SUBJECT_SECTION_ALIASES[id];
  if (aliases?.includes(s)) return true;
  // Môn tùy chỉnh (mos-word, ...): chỉ khớp chính xác id hoặc section
  return false;
}

export function normalizeMcCorrectIndex(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').trim().toUpperCase();
  if (/^[ABCD]$/.test(s)) return s.charCodeAt(0) - 65;
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n >= 1 && n <= 4) return n - 1;
    if (n >= 0 && n <= 3) return n;
  }
  const lower = String(raw ?? '').trim().toLowerCase();
  const map = { a: 0, b: 1, c: 2, d: 3 };
  if (map[lower] !== undefined) return map[lower];
  return null;
}

export function isValidMcQuestion(q) {
  if (!q || q.type === 'essay') return false;
  const type = q.type ? String(q.type).toLowerCase() : 'multiple';
  if (type !== 'multiple' && type !== 'tracnghiem' && type !== 'mc') return false;
  const opts = (q.options || []).filter((o) => o && String(o).trim());
  const correct = normalizeMcCorrectIndex(q.correct);
  return opts.length >= 2 && correct != null && correct >= 0 && correct < opts.length;
}

export function isStudentEssayQuestion(q) {
  if (!q) return false;
  const type = String(q.type || '').toLowerCase();
  if (type === 'essay' || type === 'tu_luan' || type === 'tuluan') return true;
  if (type === 'multiple' || type === 'mc' || type === 'tracnghiem') return false;
  if (q.practiceFileName || q.sampleAnswer || q.attachedFileUrl || q.practiceFileUrl) return true;
  return false;
}

export function getEssayQuestionFile(q) {
  if (!q) return null;
  const fileUrl = String(q.attachedFileUrl || q.practiceFileUrl || '').trim();
  if (!fileUrl) return null;
  const fileName = String(q.attachedFileName || q.practiceFileName || q.attachedFile || 'De_thuc_hanh').trim();
  return { fileUrl, fileName };
}

export function getStudentPracticeFilesForSubject(studentQuestions, subjectId, studentExamFiles) {
  const fromEssays = getStudentEssayQuestionsForExam(studentQuestions, subjectId)
    .map((q) => getEssayQuestionFile(q))
    .filter(Boolean);
  if (fromEssays.length > 0) return fromEssays;
  const legacy = studentExamFiles?.[subjectId];
  if (legacy?.fileUrl) {
    return [{ fileUrl: legacy.fileUrl, fileName: legacy.fileName || 'De_thuc_hanh' }];
  }
  return [];
}

export function getStudentMcQuestionsForExam(studentQuestions, subjectId) {
  return (studentQuestions || []).filter(
    (q) => isValidMcQuestion(q) && questionMatchesExamSubject(q.section, subjectId),
  );
}

export function getStudentEssayQuestionsForExam(studentQuestions, subjectId) {
  return (studentQuestions || []).filter(
    (q) => isStudentEssayQuestion(q) && questionMatchesExamSubject(q.section, subjectId),
  );
}

export function countStudentQuestionsBySubject(studentQuestions, subjectId, type = 'all') {
  if (type === 'essay') return getStudentEssayQuestionsForExam(studentQuestions, subjectId).length;
  if (type === 'multiple') return getStudentMcQuestionsForExam(studentQuestions, subjectId).length;
  return (studentQuestions || []).filter((q) => questionMatchesExamSubject(q.section, subjectId)).length;
}

/** Tổng phút thi GV (trắc nghiệm): chỉ cộng Phút TN theo môn có câu TN trong pool */
export function computeTeacherExamTotalMinutes(
  pool,
  teacherExamMinutes,
  _teacherEssayExamMinutes,
  legacyGlobalMinutes,
) {
  if (legacyGlobalMinutes != null && Number.isFinite(Number(legacyGlobalMinutes))) {
    return Math.round(Number(legacyGlobalMinutes));
  }
  const mcSections = new Set();
  for (const q of pool || []) {
    const s = String(q?.section || '').trim();
    if (!s || s === 'other' || isStudentEssayQuestion(q)) continue;
    mcSections.add(s);
  }
  let total = 0;
  for (const s of mcSections) {
    let mins = null;
    const n = Number(teacherExamMinutes?.[s]);
    if (Number.isFinite(n) && n >= 1) mins = Math.round(n);
    if (mins == null) {
      for (const [canonical, aliases] of Object.entries({
        coban: ['coban', 'computer'],
        powerpoint: ['powerpoint', 'ppt', 'pp'],
        situation: ['situation', 'supham', 'su-pham'],
      })) {
        if (canonical === s || aliases.includes(s)) {
          const cn = Number(teacherExamMinutes?.[canonical]);
          if (Number.isFinite(cn) && cn >= 1) { mins = Math.round(cn); break; }
          for (const a of aliases) {
            const an = Number(teacherExamMinutes?.[a]);
            if (Number.isFinite(an) && an >= 1) { mins = Math.round(an); break; }
          }
          if (mins != null) break;
        }
      }
    }
    total += mins ?? 90;
  }
  return total > 0 ? total : null;
}