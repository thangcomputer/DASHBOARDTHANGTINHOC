const fs = require('fs');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { promisify } = require('util');
require('dotenv').config();

const gunzip = promisify(zlib.gunzip);

async function restoreBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file: ${filePath}`);
    process.exit(1);
  }

  console.log(`⏳ Đang đọc file backup: ${filePath}...`);
  const compressedBuffer = fs.readFileSync(filePath);
  
  console.log('⏳ Đang giải nén dữ liệu...');
  const decompressedBuffer = await gunzip(compressedBuffer);
  const data = JSON.parse(decompressedBuffer.toString('utf8'));

  if (!data.collections) {
    console.error('❌ File backup không đúng định dạng (không tìm thấy thuộc tính "collections").');
    process.exit(1);
  }

  console.log('⏳ Đang kết nối tới MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc');
  console.log('✅ Đã kết nối MongoDB.');

  const db = mongoose.connection.db;

  const collectionNames = Object.keys(data.collections);
  console.log(`📌 Tìm thấy ${collectionNames.length} collections trong file backup.`);

  for (const name of collectionNames) {
    const docs = data.collections[name];
    console.log(`\n⏳ Đang khôi phục collection: [${name}] - ${docs.length} documents...`);
    
    // Xoá dữ liệu cũ trong collection
    await db.collection(name).deleteMany({});
    
    // Nếu có dữ liệu thì insert lại
    if (docs.length > 0) {
      // Ép kiểu các _id dạng string (từ JSON) về lại ObjectId nếu cần thiết
      const parsedDocs = docs.map(doc => {
        if (doc._id && typeof doc._id === 'string' && /^[0-9a-fA-F]{24}$/.test(doc._id)) {
          doc._id = new mongoose.Types.ObjectId(doc._id);
        }
        // Có thể cần ép kiểu thêm Date object tuỳ thuộc vào dữ liệu cụ thể
        return doc;
      });

      await db.collection(name).insertMany(parsedDocs);
    }
    console.log(`✅ Khôi phục thành công collection: [${name}]`);
  }

  console.log('\n🎉 Quá trình khôi phục (Restore) hoàn tất thành công!');
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Sử dụng: node restore_backup.js <đường_dẫn_tới_file_backup.json.gz>');
  process.exit(1);
}

restoreBackup(args[0]).catch(err => {
  console.error('❌ Lỗi trong quá trình restore:', err);
  process.exit(1);
});
