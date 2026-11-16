const mongoose = require('mongoose');

/** Chủ đề luyện tập hằng ngày (Windows, Word, Excel…) - admin quản lý. */
const dailyPracticeTopicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 240 },
  icon: { type: String, default: 'book' },
  color: { type: String, default: 'red' },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  /** true = khóa toàn bộ môn đối với tài khoản miễn phí/hết hạn (bắt buộc mua gói mới mở). */
  requireSubscription: { type: Boolean, default: false },
  /** Môn video bài giảng khớp với chủ đề; lessonUnitIds rỗng = cả môn. */
  lessonSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonSubject', default: null },
  lessonUnitIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
}, { timestamps: true });

dailyPracticeTopicSchema.index({ active: 1, sortOrder: 1 });

module.exports = mongoose.models.DailyPracticeTopic || mongoose.model('DailyPracticeTopic', dailyPracticeTopicSchema);
