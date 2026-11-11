const mongoose = require('mongoose');

/** Tổng XP và chuỗi ngày luyện tập liên tục của học viên. */
const dailyPracticeProfileSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  xpTotal: { type: Number, default: 0 },
  dailyXp: { type: Number, default: null }, // XP của gói trong ngày, sang ngày đặt lại
  purchasedXp: { type: Number, default: null }, // XP đã mua, giữ qua ngày
  streak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastPlayedDay: { type: String, default: '' }, // YYYY-MM-DD giờ VN
  xpBrokeDay: { type: String, default: '' }, // Ngày VN học viên dùng XP xuống dưới một lượt
  xpAllowanceDay: { type: String, default: '' }, // Ngày VN đã đặt ví về mức gói
  xpAllowanceAmount: { type: Number, default: 0 }, // Mức XP gói đã đặt cho ngày đó (200 hoặc 300)
  xpPurchases: {
    type: [{
      sessionId: { type: String, default: '' },
      xp: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      packId: { type: String, default: '' },
      at: { type: Date, default: Date.now },
    }],
    default: [],
  },
  sessionsCount: { type: Number, default: 0 },
  /** Chủ đề lộ trình học viên chọn gần nhất (đồng bộ web + mobile). */
  lastPathTopicId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.models.DailyPracticeProfile || mongoose.model('DailyPracticeProfile', dailyPracticeProfileSchema);
