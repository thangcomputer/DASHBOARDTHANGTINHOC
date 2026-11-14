const mongoose = require('mongoose');

const videoCheckSchema = new mongoose.Schema({
  atSec: { type: Number, default: 0 },
  kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
  prompt: { type: String, default: '', trim: true, maxlength: 300 },
  choices: { type: [String], default: [] },
  answer: { type: String, default: '', trim: true, maxlength: 200 },
  criteria: { type: String, default: '', trim: true, maxlength: 500 },
  shortHint: { type: String, default: '', trim: true, maxlength: 160 },
  paidHint: { type: String, default: '', trim: true, maxlength: 300 },
  hintCostXp: { type: Number, default: 5 },
}, { _id: true });

const lessonFileSchema = new mongoose.Schema({
  id: { type: String, default: '', trim: true, maxlength: 80 },
  title: { type: String, default: '', trim: true, maxlength: 180 },
  url: { type: String, default: '', trim: true, maxlength: 500 },
  name: { type: String, default: '', trim: true, maxlength: 180 },
  size: { type: Number, default: 0 },
}, { _id: false });

const levelSectionConfigSchema = new mongoose.Schema({
  sectionOrder: {
    type: [String],
    default: () => ['content', 'file', 'video', 'practice'],
  },
  hiddenSections: { type: [String], default: [] },
  sequentialSections: { type: Boolean, default: true },
  content: {
    title: { type: String, default: '', trim: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 320 },
    body: { type: String, default: '', trim: true, maxlength: 15000 },
  },
  files: { type: [lessonFileSchema], default: [] },
  video: {
    title: { type: String, default: '', trim: true, maxlength: 160 },
    url: { type: String, default: '', trim: true, maxlength: 500 },
    antiSeek: { type: Boolean, default: true },
    checks: { type: [videoCheckSchema], default: [] },
  },
  practice: {
    title: { type: String, default: '', trim: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 320 },
  },
}, { _id: false });

/** Chặng trong lộ trình luyện tập của một chủ đề (Học → Luyện → Thử thách → Kiểm tra chặng). */
const dailyPracticeUnitSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPracticeTopic', required: true },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 240 },
  /** Ảnh minh họa chặng (URL) - hiện cạnh lộ trình kiểu Duolingo. */
  imageUrl: { type: String, default: '', trim: true, maxlength: 500 },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  /** Buổi video nên xem trước khi luyện chặng này. */
  lessonUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonUnit', default: null },
  /** Video riêng của chặng - popup danh sách phát. */
  videos: {
    type: [{
      title: { type: String, required: true, trim: true, maxlength: 120 },
      url: { type: String, default: '', trim: true, maxlength: 500 },
      /** Nội dung chữ (bài học) - dùng khi không chỉ có video. */
      content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
      /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
      checks: {
        type: [{
          atSec: { type: Number, default: 0 },
          kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
          prompt: { type: String, default: '', trim: true, maxlength: 300 },
          choices: { type: [String], default: [] },
          answer: { type: String, default: '', trim: true, maxlength: 200 },
          criteria: { type: String, default: '', trim: true, maxlength: 500 },
          shortHint: { type: String, default: '', trim: true, maxlength: 160 },
          paidHint: { type: String, default: '', trim: true, maxlength: 300 },
          hintCostXp: { type: Number, default: 5 },
        }],
        default: [],
      },
    }],
    default: [],
  },
  /**
   * Nút trên lộ trình chặng.
   * Học bài (icon book): stepVideos.learn = Bài 1, 2… (nội dung +/hoặc video).
   * Luyện/Thử thách: 3 nấc trắc nghiệm Dễ/Vừa/Khó; stepVideos tùy chọn (video ôn).
   */
  pathNodes: {
    type: [{
      key: { type: String, required: true, trim: true, maxlength: 40 },
      label: { type: String, required: true, trim: true, maxlength: 40 },
      icon: { type: String, default: 'dumbbell', trim: true, maxlength: 24 },
      sortOrder: { type: Number, default: 0 },
      active: { type: Boolean, default: true },
      lockMode: { type: String, enum: ['sequential', 'unlocked', 'locked'], default: 'sequential' },
      stepVideos: {
        learn: {
          type: [{
            title: { type: String, required: true, trim: true, maxlength: 120 },
            url: { type: String, default: '', trim: true, maxlength: 500 },
            content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
            /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
            checks: {
              type: [{
                atSec: { type: Number, default: 0 },
                kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
                prompt: { type: String, default: '', trim: true, maxlength: 300 },
                choices: { type: [String], default: [] },
                answer: { type: String, default: '', trim: true, maxlength: 200 },
                criteria: { type: String, default: '', trim: true, maxlength: 500 },
                shortHint: { type: String, default: '', trim: true, maxlength: 160 },
                paidHint: { type: String, default: '', trim: true, maxlength: 300 },
                hintCostXp: { type: Number, default: 5 },
              }],
              default: [],
            },
          }],
          default: [],
        },
        practice: {
          type: [{
            title: { type: String, required: true, trim: true, maxlength: 120 },
            url: { type: String, default: '', trim: true, maxlength: 500 },
            content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
            /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
            checks: {
              type: [{
                atSec: { type: Number, default: 0 },
                kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
                prompt: { type: String, default: '', trim: true, maxlength: 300 },
                choices: { type: [String], default: [] },
                answer: { type: String, default: '', trim: true, maxlength: 200 },
                criteria: { type: String, default: '', trim: true, maxlength: 500 },
                shortHint: { type: String, default: '', trim: true, maxlength: 160 },
                paidHint: { type: String, default: '', trim: true, maxlength: 300 },
                hintCostXp: { type: Number, default: 5 },
              }],
              default: [],
            },
          }],
          default: [],
        },
        challenge: {
          type: [{
            title: { type: String, required: true, trim: true, maxlength: 120 },
            url: { type: String, default: '', trim: true, maxlength: 500 },
            content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
            /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
            checks: {
              type: [{
                atSec: { type: Number, default: 0 },
                kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
                prompt: { type: String, default: '', trim: true, maxlength: 300 },
                choices: { type: [String], default: [] },
                answer: { type: String, default: '', trim: true, maxlength: 200 },
                criteria: { type: String, default: '', trim: true, maxlength: 500 },
                shortHint: { type: String, default: '', trim: true, maxlength: 160 },
                paidHint: { type: String, default: '', trim: true, maxlength: 300 },
                hintCostXp: { type: Number, default: 5 },
              }],
              default: [],
            },
          }],
          default: [],
        },
      },
      /** Cấu hình 3 mức độ độc lập (Dễ, Vừa, Khó) với thứ tự 4 phần (Nội dung, File, Video, Luyện tập). */
      levelConfigs: {
        easy: { type: levelSectionConfigSchema, default: undefined },
        medium: { type: levelSectionConfigSchema, default: undefined },
        hard: { type: levelSectionConfigSchema, default: undefined },
      },
    }],
    default: undefined,
  },
  /** @deprecated - ưu tiên pathNodes. */
  stepVideos: {
    learn: {
      type: [{
        title: { type: String, required: true, trim: true, maxlength: 120 },
        url: { type: String, default: '', trim: true, maxlength: 500 },
        content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
        /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
        checks: {
          type: [{
            atSec: { type: Number, default: 0 },
            kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
            prompt: { type: String, default: '', trim: true, maxlength: 300 },
            choices: { type: [String], default: [] },
            answer: { type: String, default: '', trim: true, maxlength: 200 },
            criteria: { type: String, default: '', trim: true, maxlength: 500 },
            shortHint: { type: String, default: '', trim: true, maxlength: 160 },
            paidHint: { type: String, default: '', trim: true, maxlength: 300 },
            hintCostXp: { type: Number, default: 5 },
          }],
          default: [],
        },
      }],
      default: [],
    },
    practice: {
      type: [{
        title: { type: String, required: true, trim: true, maxlength: 120 },
        url: { type: String, default: '', trim: true, maxlength: 500 },
        content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
        /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
        checks: {
          type: [{
            atSec: { type: Number, default: 0 },
            kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
            prompt: { type: String, default: '', trim: true, maxlength: 300 },
            choices: { type: [String], default: [] },
            answer: { type: String, default: '', trim: true, maxlength: 200 },
            criteria: { type: String, default: '', trim: true, maxlength: 500 },
            shortHint: { type: String, default: '', trim: true, maxlength: 160 },
            paidHint: { type: String, default: '', trim: true, maxlength: 300 },
            hintCostXp: { type: Number, default: 5 },
          }],
          default: [],
        },
      }],
      default: [],
    },
    challenge: {
      type: [{
        title: { type: String, required: true, trim: true, maxlength: 120 },
        url: { type: String, default: '', trim: true, maxlength: 500 },
        content: { type: String, default: '', trim: true, maxlength: 5000 },
      fileUrl: { type: String, default: '', trim: true, maxlength: 500 },
      fileName: { type: String, default: '', trim: true, maxlength: 180 },
        /** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
        checks: {
          type: [{
            atSec: { type: Number, default: 0 },
            kind: { type: String, enum: ['choice', 'text', 'screen'], default: 'choice' },
            prompt: { type: String, default: '', trim: true, maxlength: 300 },
            choices: { type: [String], default: [] },
            answer: { type: String, default: '', trim: true, maxlength: 200 },
            criteria: { type: String, default: '', trim: true, maxlength: 500 },
            shortHint: { type: String, default: '', trim: true, maxlength: 160 },
            paidHint: { type: String, default: '', trim: true, maxlength: 300 },
            hintCostXp: { type: Number, default: 5 },
          }],
          default: [],
        },
      }],
      default: [],
    },
  },
  /** Chặng hệ thống tự tạo để gom câu hỏi cũ chưa xếp chặng. */
  autoKey: { type: String, default: undefined },
}, { timestamps: true });

dailyPracticeUnitSchema.index({ topicId: 1, sortOrder: 1, createdAt: 1 });
dailyPracticeUnitSchema.index(
  { topicId: 1, autoKey: 1 },
  { unique: true, partialFilterExpression: { autoKey: { $type: 'string' } } },
);

module.exports = mongoose.models.DailyPracticeUnit || mongoose.model('DailyPracticeUnit', dailyPracticeUnitSchema);
