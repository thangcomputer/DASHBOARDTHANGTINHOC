const mongoose = require('mongoose');

/** Giá ba gói XP luyện. Mã gói giữ nguyên để đơn SePay cũ vẫn khớp. */
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  prices: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });

module.exports = mongoose.models.DailyPracticeXpPackPrice || mongoose.model('DailyPracticeXpPackPrice', schema);
