const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules/auth/authRoutes.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace imports
content = content.replace(
  "const SystemSettings = require('../system/models/SystemSettings');",
  "const systemRepository = require('../system/repositories');"
);

content = content.replace(
  "const Notification = require('../notification/models/Notification');",
  "const notificationRepository = require('../notification/repositories');"
);

// Replace queries
content = content.replace(
  /await SystemSettings\.findOne\(\{ _key: 'main' \}\)\.select\('\+adminMfaSecret'\);/g,
  "await systemRepository.findMainWithSecrets();"
);

content = content.replace(
  /await SystemSettings\.findOne\(\{ _key: 'main' \}\)\.select\('\+adminMfaPendingSecret \+adminMfaSecret'\);/g,
  "await systemRepository.findMainWithSecrets();"
);

content = content.replace(
  /await SystemSettings\.findOneAndUpdate\(\s*\{\s*_key:\s*'main'\s*\},\s*\{\s*\$unset:\s*\{\s*adminMfaPendingSecret:\s*1\s*\}\s*\},\s*\{\s*returnDocument:\s*'after'\s*\}\s*\);/g,
  "await systemRepository.updateMain({ $unset: { adminMfaPendingSecret: 1 } }, { returnDocument: 'after' });"
);

content = content.replace(
  /await SystemSettings\.findOne\(\{ _key: 'main' \}\)\.lean\(\);/g,
  "await systemRepository.findMainPublic();"
);

content = content.replace(
  /await SystemSettings\.findOneAndUpdate\(\{ _key: 'main' \}, \{ \$set: \{ adminName: newName \} \}, \{ upsert: true \}\);/g,
  "await systemRepository.updateMain({ $set: { adminName: newName } }, { upsert: true });"
);

content = content.replace(
  /await Notification\.create/g,
  "await notificationRepository.create"
);

// Replace save logic
const resetBlock = `      const sysSettings = await SystemSettings.findOne({ _key: 'main' });
      if (!sysSettings) {
        return res.status(404).json({ success: false, message: 'Settings not found' });
      }
      sysSettings.adminPasswordHash = await bcrypt.hash('123456', salt);
      await sysSettings.save();`;

const resetBlockNew = `      let sysSettings = await systemRepository.findMainWithSecrets();
      if (!sysSettings) {
        sysSettings = await systemRepository.createMain();
      }
      const adminPasswordHash = await bcrypt.hash('123456', salt);
      await systemRepository.updateMain({ adminPasswordHash });`;
content = content.replace(resetBlock, resetBlockNew);

const profileBlock = `      let sysSettings = await SystemSettings.findOne({ _key: 'main' });
      if (!sysSettings) sysSettings = new SystemSettings({ _key: 'main' });

      let changed = false;

      // Đổi tên — đồng bộ cả SystemSettings và Teacher collection
      if (name && name.trim()) {
        const newName = name.trim();
        sysSettings.adminName = newName;
        changed = true;
        await Teacher.updateMany(
          { $or: [{ adminRole: 'SUPER_ADMIN' }, { role: 'admin', adminRole: { $ne: 'STAFF' } }] },
          { $set: { name: newName } }
        );
      }

      // Đổi mật khẩu
      if (newPassword) {
        if (!oldPassword) {
          return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, message: 'Mật khẩu mới phải ít nhất 6 ký tự' });
        }

        // Xác thực mật khẩu cũ
        const oldPwMatch = await verifyAdminPassword(oldPassword, sysSettings);

        if (!oldPwMatch) {
          return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }

        // Hash và lưu mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        sysSettings.adminPasswordHash = await bcrypt.hash(newPassword, salt);
        changed = true;
      }

      if (!changed) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập thông tin cần thay đổi' });
      }

      sysSettings.markModified('adminPasswordHash');
      sysSettings.markModified('adminName');
      await sysSettings.save();`;

const profileBlockNew = `      let sysSettings = await systemRepository.findMainWithSecrets();
      if (!sysSettings) sysSettings = await systemRepository.createMain();

      let changed = false;
      const updates = {};

      // Đổi tên — đồng bộ cả SystemSettings và Teacher collection
      if (name && name.trim()) {
        const newName = name.trim();
        updates.adminName = newName;
        changed = true;
        await Teacher.updateMany(
          { $or: [{ adminRole: 'SUPER_ADMIN' }, { role: 'admin', adminRole: { $ne: 'STAFF' } }] },
          { $set: { name: newName } }
        );
      }

      // Đổi mật khẩu
      if (newPassword) {
        if (!oldPassword) {
          return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, message: 'Mật khẩu mới phải ít nhất 6 ký tự' });
        }

        // Xác thực mật khẩu cũ
        const oldPwMatch = await verifyAdminPassword(oldPassword, sysSettings);

        if (!oldPwMatch) {
          return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }

        // Hash và lưu mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        updates.adminPasswordHash = await bcrypt.hash(newPassword, salt);
        changed = true;
      }

      if (!changed) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập thông tin cần thay đổi' });
      }

      sysSettings = await systemRepository.updateMain(updates, { new: true });`;

content = content.replace(profileBlock, profileBlockNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Migration complete');
