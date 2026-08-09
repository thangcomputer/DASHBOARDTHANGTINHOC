const { authMiddleware } = require('../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../shared/middleware/authorize');
const legacyMapping = require('../../shared/constants/legacyPermissionMapping');

class SystemApplicationService {
  async get_bank1(data) {
  try {
    const settings = await getSettings();
    return res.json({
      success: true,
      data: {
        centerBankCode:          settings.centerBankCode          || '',
        centerBankName:          settings.centerBankName          || '',
        centerBankAccountNumber: settings.centerBankAccountNumber || '',
        centerBankAccountName:   settings.centerBankAccountName   || '',
      },
    }
  async getRoot2(data) {
  try {
    const settings = await getSettings();
    return res.json({ success: true, data: settings }
  async putRoot3(data) {
  try {
    const allowed = [
      'centerBankCode', 'centerBankName', 'centerBankAccountNumber', 'centerBankAccountName',
      'popupIsActive', 'popupTitle', 'popupContent', 'popupImageUrl', 'popupTargetRole',
      'invoiceLogoUrl', 'invoiceSignatureUrl', 'invoiceStampText',
      'logoUrl', 'faviconUrl', 'faviconAdminUrl', 'loadingStyle',
    ];
    const updates = {};
    for (const key of allowed) {
      if (data.body[key] !== undefined) updates[key] = data.body[key];
    }

    const settings = await updateMainSettings({ $set: updates }
  async post_upload_popup_image4(data) {
  try {
    if (!data.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' }
  async post_upload_invoice_signature5(data) {
  try {
    if (!data.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' }
  async get_popup6(data) {
  try {
    const settings = await getSettings();
    return res.json({
      success: true,
      data: {
        isActive: settings.popupIsActive,
        title: settings.popupTitle,
        content: settings.popupContent,
        imageUrl: settings.popupImageUrl,
        targetRole: settings.popupTargetRole,
      },
    }
  async get_payment7(data) {
  try {
    const settings = await getSettings();
    return res.json({
      success: true,
      data: {
        bankCode:      settings.centerBankCode      || '',
        bankName:      settings.centerBankName      || '',
        accountNumber: settings.centerBankAccountNumber || '',
        accountName:   settings.centerBankAccountName   || '',
      },
    }
  async get_web8(data) {
  try {
    const settings = await getSettings();
    return res.json({
      success: true,
      data: {
        logoUrl:      settings.logoUrl      || '',
        faviconUrl:   settings.faviconUrl   || '',
        faviconAdminUrl: settings.faviconAdminUrl || '',
        loadingStyle: settings.loadingStyle || 1,
        staffPopup: {
          isActive:  settings.staffPopup?.isActive  || false,
          title:     settings.staffPopup?.title     || '',
          content:   settings.staffPopup?.content   || '',
          updatedAt: settings.staffPopup?.updatedAt || null,
        },
        invoiceLogoUrl:      settings.invoiceLogoUrl      || '',
        invoiceSignatureUrl: settings.invoiceSignatureUrl || '',
        invoiceStampText:    settings.invoiceStampText    || 'ĐÃ THANH TOÁN',
      },
    }
  async put_web9(data) {
  try {
    const updates = {};
    const { logoUrl, faviconUrl, faviconAdminUrl, loadingStyle, staffPopup } = data.body;

    if (logoUrl !== undefined)      updates.logoUrl = logoUrl;
    if (faviconUrl !== undefined)   updates.faviconUrl = faviconUrl;
    if (faviconAdminUrl !== undefined) updates.faviconAdminUrl = faviconAdminUrl;
    if (loadingStyle !== undefined)  updates.loadingStyle = Math.max(1, Math.min(4, Number(loadingStyle) || 1));

    if (staffPopup) {
      updates['staffPopup.isActive']  = staffPopup.isActive ?? false;
      updates['staffPopup.title']     = staffPopup.title    ?? '';
      updates['staffPopup.content']   = staffPopup.content  ?? '';
      updates['staffPopup.updatedAt'] = new Date();
    }

    const settings = await updateMainSettings({ $set: updates }
  async get_training_data10(data) {
  try {
    const settings = await getSettings();
    const data = normalizeTrainingDataUrls(settings.trainingRawData || { videos: [], guides: [], files: [] }
  async put_training_data11(data) {
  try {
    await updateMainSettings({ $set: { trainingRawData: data.body.trainingData } }
  async get_student_training_data12(data) {
  try {
    const settings = await getSettings();
    const data = normalizeTrainingDataUrls(settings.studentTrainingRawData || { videos: [], guides: [], files: [] }
  async put_student_training_data13(data) {
  try {
    await updateMainSettings({ $set: { studentTrainingRawData: data.body.studentTrainingData } }
  async get_student_exam_config14(data) {
  try {
    const settings = await getSettings();
    const bank = settings.studentExamBankRawData;
    const hasStudentExamBank = bank != null;
    const minsRaw = settings.studentExamMinutesRaw;
    const hasMinutesOnServer = minsRaw != null && typeof minsRaw === 'object';
    const essayMinsRaw = settings.studentEssayExamMinutesRaw;
    const hasEssayMinutesOnServer = essayMinsRaw != null && typeof essayMinsRaw === 'object';
    const filesRaw = settings.studentExamFilesRaw;
    const hasExamFilesOnServer = filesRaw != null && typeof filesRaw === 'object';
    const catalog = await examCatalogPayload(settings);
    return res.json({
      success: true,
      data: {
        hasStudentExamBank,
        studentQuestions: hasStudentExamBank && Array.isArray(bank) ? bank : [],
        studentExamMinutes: hasMinutesOnServer ? sanitizeStudentExamMinutesPayload(minsRaw) : undefined,
        studentEssayExamMinutes: hasEssayMinutesOnServer
          ? sanitizeStudentEssayExamMinutesPayload(essayMinsRaw)
          : undefined,
        studentExamFiles: hasExamFilesOnServer ? sanitizeStudentExamFilesPayload(filesRaw) : {},
        examSubjectsCustom: catalog.custom,
        examSubjectsMerged: catalog.merged,
      },
    }
  async get_teacher_exam_config15(data) {
  try {
    const settings = await getSettings();
    const bank = settings.teacherExamBankRawData;
    const hasTeacherExamBank = bank != null;
    const tm = settings.teacherExamTimeLimitMinutes;
    const timeLimitMinutes =
      tm != null && Number.isFinite(Number(tm)) ? sanitizeTeacherExamTimeLimitMinutes(tm) : null;
    const teacherMinsRaw = settings.teacherExamMinutesRaw;
    const teacherEssayMinsRaw = settings.teacherEssayExamMinutesRaw;
    const hasTeacherMins = teacherMinsRaw != null && typeof teacherMinsRaw === 'object';
    const hasTeacherEssayMins = teacherEssayMinsRaw != null && typeof teacherEssayMinsRaw === 'object';
    return res.json({
      success: true,
      data: {
        hasTeacherExamBank,
        hasTeacherExamMinutes: hasTeacherMins,
        hasTeacherEssayExamMinutes: hasTeacherEssayMins,
        questions: hasTeacherExamBank && Array.isArray(bank) ? bank : [],
        timeLimitMinutes,
        teacherExamMinutes: hasTeacherMins
          ? rawTeacherExamMinutesPayload(teacherMinsRaw)
          : null,
        teacherEssayExamMinutes: hasTeacherEssayMins
          ? rawTeacherEssayExamMinutesPayload(teacherEssayMinsRaw)
          : null,
      },
    }
  async put_teacher_exam_config16(data) {
  try {
    const { questions, timeLimitMinutes, teacherExamMinutes, teacherEssayExamMinutes } = data.body || {};
    const settings = await getSettings();
    const $set = {};
    if (questions !== undefined) {
      if (!Array.isArray(questions)) {
        return res.status(400).json({ success: false, message: 'questions phải là mảng' }
  async get_exam_subjects17(data) {
  try {
    const settings = await getSettings();
    const catalog = await examCatalogPayload(settings);
    return res.json({ success: true, data: catalog }
  async post_exam_subjects18(data) {
  try {
    const entry = sanitizeCustomExamSubjectEntry(data.body || {}
  async delete_exam_subjects_id19(data) {
  try {
    const id = String(data.params.id || '').trim();
    if (!id || BUILTIN_EXAM_SUBJECT_IDS.includes(id)) {
      return res.status(400).json({ success: false, message: 'Khong the xoa mon mac dinh' }
  async put_student_exam_config20(data) {
  try {
    const { studentQuestions, studentExamMinutes, studentEssayExamMinutes, studentExamFiles } = data.body || {};
    const updates = {};
    if (studentQuestions !== undefined) {
      if (!Array.isArray(studentQuestions)) {
        return res.status(400).json({ success: false, message: 'studentQuestions phải là mảng' }
  async post_upload_logo21(data) {
  try {
    if (!data.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' }
  async post_upload_favicon22(data) {
  try {
    if (!data.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' }
  async post_upload_invoice_logo23(data) {
  try {
    if (!data.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' }
  async post_reset_data24(data) {
  const { phrase, password, options = { all: true } } = data.body;
  const userId = data.currentUser.id;

  if (phrase !== 'XOA_DU_LIEU') {
    return res.status(400).json({ success: false, message: 'Chuỗi xác nhận không hợp lệ' }
}

module.exports = new SystemApplicationService();
