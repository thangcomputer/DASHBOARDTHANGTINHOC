const systemRepository = require('./repositories');
const { getCachedSettings, invalidateSettingsCache } = require('./settingsCache');

async function getSettings() {
  return getCachedSettings();
}

async function updateMainSettings(update, options = {}) {
  const settings = await systemRepository.updateMain(update, options);
  await invalidateSettingsCache();
  return settings;
}

/** GET /api/settings/bank */
async function getBankSettings(req, res) {
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
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

/** GET /api/settings */
async function getSettingsData(req, res) {
  try {
    const settings = await getSettings();
    return res.json({ success: true, data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
}

/** PUT /api/settings */
async function updateSettingsData(req, res) {
  try {
    const allowed = [
      'centerBankCode', 'centerBankName', 'centerBankAccountNumber', 'centerBankAccountName',
      'popupIsActive', 'popupTitle', 'popupContent', 'popupImageUrl', 'popupTargetRole',
      'invoiceLogoUrl', 'invoiceSignatureUrl', 'invoiceStampText',
      'logoUrl', 'faviconUrl', 'faviconAdminUrl', 'loadingStyle',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const settings = await updateMainSettings({ $set: updates });
    return res.json({ success: true, data: settings, message: 'Đã lưu cấu hình' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
}

/** POST /api/settings/upload-popup-image */
async function uploadPopupImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' });
    const imageUrl = `/uploads/popup/${req.file.filename}`;
    await updateMainSettings({ $set: { popupImageUrl: imageUrl } });
    return res.json({ success: true, imageUrl, message: 'Upload thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** POST /api/settings/upload-invoice-signature */
async function uploadInvoiceSignature(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Không có file ảnh' });
    const signatureUrl = `/uploads/signature/${req.file.filename}`;
    await updateMainSettings({ $set: { invoiceSignatureUrl: signatureUrl } });
    return res.json({ success: true, signatureUrl, message: 'Upload chữ ký thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSettings,
  updateMainSettings,
  getBankSettings,
  getSettingsData,
  updateSettingsData,
  uploadPopupImage,
  uploadInvoiceSignature,
};
