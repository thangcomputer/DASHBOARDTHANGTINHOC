'use strict';
const { courseRepository } = require('./../repositories');
const Course = require('./../models/Course'); // Temp for new Course
const logger = require('./../../../config/logger');
const cache = require('./../../../utils/cache');
const { getCachedSettings } = require('./../../system/settingsCache');

const {
  sanitizeExamSubjects,
  resolveExamSubjectsForCourse,
  inferExamSubjectsFromCourseName,
} = require('../../exam/services/examSubjectCatalog');
const COURSE_TTL = 120;
const COURSE_STATS_KEY = 'courses:stats';
async function invalidateCourseCache() {
  await cache.delByPrefix('courses:');
}
/** Catalog mặc định ẩn soft-deleted (`deletedAt: null` khớp cả field thiếu). */
function notDeletedFilter(includeDeleted = false) {
  if (includeDeleted === true || includeDeleted === '1' || includeDeleted === 'true') {
    return {};
  }
  return { deletedAt: null };
}
// ─── GET /api/courses/stats/summary — đặt trước /:id ───────────────────────────

class CourseApplicationService {
  async get_stats_summary(data) {
  try {
    const data = await cache.wrap(COURSE_STATS_KEY, COURSE_TTL, async () => {
      const alive = { deletedAt: null };
      const total      = await courseRepository.count(alive);
      const published  = await courseRepository.count({ ...alive, status: 'published' });
      const featured   = await courseRepository.count({ ...alive, featured: true });
      const categories = await courseRepository.aggregate([
        { $match: alive },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);
      return { total, published, featured, categories };
    });

    return { _status: 200, _body: { success: true, data } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async get_root(data) {
  try {
    const { category, status, featured, search, includeDeleted } = data.query;
    const filter = {
      ...notDeletedFilter(includeDeleted),
    };

    if (category) filter.category = category;
    if (status)   filter.status = status;
    if (featured) filter.featured = featured === 'true';
    if (search) {
      const safe = sanitizeRegex(search, 200);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }

    // Không cache khi có search (query tùy biến)
    const loadCourses = () => courseRepository.findMany(filter).sort({ featured: -1, createdAt: -1 }).lean();
    const courses = search
      ? await loadCourses()
      : await cache.wrap(
        `courses:list:${category || ''}:${status || ''}:${featured || ''}:${includeDeleted || ''}`,
        COURSE_TTL,
        loadCourses,
      );

    return { _status: 200, _body: {
      success: true,
      count: courses.length,
      data: courses,
    } };
  } catch (error) {
    logger.error('[COURSES] Get all error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async get_id(data) {
  try {
    const course = await courseRepository.findOne({
      $or: [
        { _id: data.id.match(/^[a-f\d]{24}$/i) ? data.id : null },
        { slug: data.id },
      ],
    });

    if (!course) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy khóa học' } };
    }

    return { _status: 200, _body: { success: true, data: course } };
  } catch (error) {
    logger.error('[COURSES] Get by ID error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_root(data) {
  try {
    const body = { ...data.body };
    if (body.price !== undefined) {
      body.discountPrice = calcEffectivePrice(Number(body.price), Number(body.discountPercent || 0));
    }
    if (body.examSubjects !== undefined) {
      body.examSubjects = await sanitizeCourseExamSubjects(body.examSubjects);
    } else {
      body.examSubjects = await inferExamSubjects(body);
    }
    const course = await courseRepository.create(body);
    await invalidateCourseCache();
    return { _status: 201, _body: {
      success: true,
      message: `Đã tạo khóa học: ${course.name}`,
      data: { ...course.toObject(), effectivePrice: course.discountPercent > 0 ? course.discountPrice : course.price },
    } };
  } catch (error) {
    if (error.code === 11000) {
      return { _status: 409, _body: { success: false, message: 'Tên khóa học đã tồn tại' } };
    }
    logger.error('[COURSES] Create error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server: ' + error.message } };
  }
}

  async put_id(data) {
  try {
    const body = { ...data.body };
    if (body.price !== undefined || body.discountPercent !== undefined) {
      const course = await courseRepository.findById(data.id).lean();
      const price  = Number(body.price ?? course?.price ?? 0);
      const pct    = Number(body.discountPercent ?? course?.discountPercent ?? 0);
      body.discountPrice = calcEffectivePrice(price, pct);
    }
    if (body.examSubjects !== undefined) {
      body.examSubjects = await sanitizeCourseExamSubjects(body.examSubjects);
    }

    const updated = await courseRepository.updateById(data.id, body, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!updated) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy khóa học' } };
    }
    await invalidateCourseCache();

    const ep = updated.discountPercent > 0 ? updated.discountPrice : updated.price;
    return { _status: 200, _body: {
      success: true,
      message: `Đã cập nhật khóa học: ${updated.name}`,
      data: { ...updated.toObject(), effectivePrice: ep },
    } };
  } catch (error) {
    logger.error('[COURSES] Update error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async patch_id_price(data) {
  try {
    const { price, discountPercent = 0 } = data.body;
    if (price === undefined || isNaN(price) || Number(price) < 0) {
      return { _status: 400, _body: { success: false, message: 'Giá không hợp lệ' } };
    }
    const dp = calcEffectivePrice(Number(price), Number(discountPercent));
    const course = await courseRepository.updateById(
      data.id,
      { price: Number(price), discountPercent: Number(discountPercent), discountPrice: dp },
      { returnDocument: 'after', runValidators: true }
    );
    if (!course) return { _status: 404, _body: { success: false, message: 'Không tìm thấy khóa học' } };
    await invalidateCourseCache();
    return { _status: 200, _body: {
      success: true,
      message: `Đã cập nhật giá: ${dp.toLocaleString('vi-VN')}đ`,
      data: { ...course.toObject(), effectivePrice: dp },
    } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async delete_id(data) {
  try {
    const course = await courseRepository.findById(data.id);
    if (!course || course.deletedAt) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy khóa học' } };
    }

    const actorId = String(data.currentUser?.id || data.currentUser?._id || '');
    course.deletedAt = new Date();
    course.deletedBy = actorId;
    course.status = 'archived';
    course.featured = false;
    await course.save();
    await invalidateCourseCache();

    try {
      const { writeAudit } = require('../../report/services/auditLogService');
      await writeAudit({
        action: 'course.soft_delete',
        actorUserId: actorId,
        actorRole: data.currentUser?.role || 'admin',
        entityType: 'course',
        entityId: String(course._id),
        courseId: course._id,
        oldValue: { status: 'published', deletedAt: null },
        newValue: { status: 'archived', deletedAt: course.deletedAt },
        ip: data.ip,
        userAgent: data.headers['user-agent'] || '',
      });
    } catch (_) { /* non-blocking */ }

    // Thông báo HV đang gắn khóa (catalog ẩn; lịch sử học/ledger giữ nguyên)
    try {
      const Student = require('../../student/models/Student');
      const NotificationService = require('../../notification/services/NotificationService');
      const io = data.app.get('io');
      const enrolled = await Student.find({
        $or: [
          { course: course.name },
          { 'enrollments.courseName': course.name },
          { 'enrollments.courseId': course._id },
        ],
      }).select('_id').limit(500).lean();
      if (io && enrolled.length) {
        await NotificationService.send(io, {
          type: 'COURSE',
          title: 'Khóa học đã ngừng mở đăng ký',
          content: `Khóa "${course.name}" đã được ẩn khỏi catalog. Tiến độ / lịch sử học của bạn vẫn được giữ.`,
          receivers: enrolled.map((s) => String(s._id)),
          link: '/student#profile',
        });
      }
    } catch (notifyErr) {
      logger.warn('[COURSES] soft-delete notify: %s', notifyErr.message);
    }

    return { _status: 200, _body: {
      success: true,
      message: `Đã ẩn khóa học (soft-delete): ${course.name}`,
      data: {
        _id: course._id,
        name: course.name,
        status: course.status,
        deletedAt: course.deletedAt,
      },
    } };
  } catch (error) {
    logger.error('[COURSES] Delete error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_id_restore(data) {
  try {
    const course = await courseRepository.findById(data.id);
    if (!course) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy khóa học' } };
    }
    if (!course.deletedAt) {
      return { _status: 409, _body: { success: false, message: 'Khóa học chưa bị xóa mềm' } };
    }
    course.deletedAt = null;
    course.deletedBy = '';
    course.status = 'published';
    await course.save();
    await invalidateCourseCache();
    return { _status: 200, _body: {
      success: true,
      message: `Đã khôi phục khóa học: ${course.name}`,
      data: course,
    } };
  } catch (error) {
    logger.error('[COURSES] Restore error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_seed(data) {
  if (process.env.NODE_ENV === 'production') {
    return { _status: 403, _body: { success: false, message: 'Seed không được phép trên production' } };
  }
  try {
    const count = await courseRepository.count();
    if (count > 0) {
      return { _status: 200, _body: { success: true, message: `Đã có ${count} khóa học, bỏ qua seed.` } };
    }

    const seedCourses = [
      {
        name: 'Tin Học Văn Phòng Cơ Bản',
        category: 'van-phong',
        description: 'Khóa học được thiết kế chuyên biệt cho người đi làm, giúp bạn nâng cao kỹ năng sử dụng Word, Excel và PowerPoint.',
        shortDescription: 'Word, Excel, PowerPoint cho người mới bắt đầu',
        price: 2699000,
        discountPercent: 10,
        totalSessions: 12,
        duration: '4 tuần',
        level: 'beginner',
        format: 'online-1-1',
        tools: ['Word', 'Excel', 'PowerPoint', 'Ultraviewer'],
        targetAudience: ['Người mới bắt đầu', 'Người đi làm', 'Sinh viên'],
        benefits: [
          'Học kèm 1-1, bám sát mục tiêu công việc',
          'Lịch học linh hoạt theo thời gian rảnh',
          'Có video xem lại từng buổi học',
          'Hỗ trợ 24/7 qua nhóm Zalo',
        ],
        curriculum: [
          { title: 'Buổi Đầu Làm Quen Về Máy Tính', sessions: 1, duration: '1 giờ 30 phút', topics: ['Hướng dẫn bàn phím, gõ 10 ngón tay', 'Tạo thư mục, sao chép, di chuyển file', 'Công nghệ AI vào đời sống'] },
          { title: 'Làm quen phần mềm Word', sessions: 2, duration: '3 giờ', topics: ['Gõ văn bản có dấu', 'Định dạng chữ và đoạn văn', 'Chèn hình ảnh, bảng, mục lục tự động'] },
          { title: 'Làm quen phần mềm Excel', sessions: 4, duration: '6 giờ', topics: ['Công thức cơ bản: SUM, AVERAGE, IF', 'Hàm VLOOKUP, HLOOKUP', 'Biểu đồ và Pivot Table'] },
          { title: 'Làm quen phần mềm PowerPoint', sessions: 2, duration: '3 giờ', topics: ['Thiết kế slide chuyên nghiệp', 'Hiệu ứng chuyển slide', 'Trình chiếu và xuất PDF'] },
        ],
        featured: true,
        status: 'published',
      },
      {
        name: 'Tin Học Văn Phòng Nâng Cao',
        category: 'van-phong',
        description: 'Nâng cao kỹ năng Excel, Word chuyên sâu cho người đã có kiến thức cơ bản.',
        shortDescription: 'Excel nâng cao, Word chuyên sâu, PowerPoint pro',
        price: 3499000,
        discountPercent: 0,
        totalSessions: 12,
        duration: '4 tuần',
        level: 'intermediate',
        format: 'online-1-1',
        tools: ['Excel', 'Word', 'PowerPoint'],
        targetAudience: ['Nhân viên văn phòng', 'Kế toán', 'Quản lý'],
        benefits: ['Excel nâng cao: Pivot, Macro, VBA cơ bản', 'Word: Mail Merge, Template pro', 'Chứng chỉ hoàn thành khóa học'],
        curriculum: [
          { title: 'Excel Nâng Cao', sessions: 6, duration: '9 giờ', topics: ['Hàm nâng cao: VLOOKUP, INDEX/MATCH', 'Pivot Table & Pivot Chart', 'Data Validation, Conditional Formatting'] },
          { title: 'Word Chuyên Sâu', sessions: 3, duration: '4.5 giờ', topics: ['Mail Merge', 'Template & Macro', 'Tạo form chuyên nghiệp'] },
          { title: 'PowerPoint Pro', sessions: 3, duration: '4.5 giờ', topics: ['Master Slide', 'Animation nâng cao', 'Infographic & Data Viz'] },
        ],
        featured: true,
        status: 'published',
      },
      {
        name: 'Khóa Học Sử Dụng Photoshop Cơ Bản',
        category: 'do-hoa',
        description: 'Học Photoshop từ zero đến hero, phù hợp cho người muốn chỉnh sửa ảnh và thiết kế cơ bản.',
        shortDescription: 'Chỉnh sửa ảnh, thiết kế cơ bản với Photoshop',
        price: 3200000,
        totalSessions: 10,
        duration: '3 tuần',
        level: 'beginner',
        format: 'online-1-1',
        tools: ['Adobe Photoshop', 'Canva'],
        featured: false,
        status: 'published',
      },
      {
        name: 'Chỉnh Sửa Ảnh Canva Nâng Cao',
        category: 'do-hoa',
        description: 'Thiết kế chuyên nghiệp với Canva — poster, banner, social media content.',
        shortDescription: 'Thiết kế poster, banner chuyên nghiệp bằng Canva',
        price: 1999000,
        totalSessions: 8,
        duration: '2 tuần',
        level: 'intermediate',
        format: 'online-1-1',
        tools: ['Canva Pro', 'Photopea'],
        featured: false,
        status: 'published',
      },
      {
        name: 'Khóa Học AI Video & Hình Ảnh',
        category: 'ai',
        description: 'Tạo video chuyên nghiệp và hình ảnh độc đáo chỉ trong vài phút bằng AI.',
        shortDescription: 'Dùng AI tạo video và hình ảnh chuyên nghiệp',
        price: 2499000,
        totalSessions: 8,
        duration: '2 tuần',
        level: 'beginner',
        format: 'online-1-1',
        tools: ['ChatGPT', 'Midjourney', 'DALL-E', 'CapCut'],
        featured: true,
        status: 'published',
      },
      {
        name: 'Ôn Luyện Chứng Chỉ MOS',
        category: 'chung-chi',
        description: 'Nắm vững kỹ năng tin học văn phòng theo chuẩn quốc tế Microsoft Office Specialist (MOS).',
        shortDescription: 'Chuẩn bị thi chứng chỉ MOS Word, Excel, PowerPoint',
        price: 4500000,
        totalSessions: 15,
        duration: '5 tuần',
        level: 'advanced',
        format: 'online-1-1',
        tools: ['Word', 'Excel', 'PowerPoint'],
        featured: false,
        status: 'published',
      },
      {
        name: 'Cài Đặt Windows & Phần Mềm Cơ Bản',
        category: 'khac',
        description: 'Hướng dẫn cài đặt hệ điều hành Windows, driver, phần mềm cần thiết cho máy tính.',
        shortDescription: 'Cài đặt Windows, driver, phần mềm máy tính',
        price: 999000,
        totalSessions: 4,
        duration: '1 tuần',
        level: 'beginner',
        format: 'online-1-1',
        tools: ['Windows 10/11', 'Rufus', 'WinRAR'],
        featured: false,
        status: 'published',
      },
    ];

    const created = await courseRepository.insertMany(seedCourses);
    await invalidateCourseCache();
    return { _status: 201, _body: {
      success: true,
      message: `Seed ${created.length} khóa học thành công!`,
      data: created,
    } };
  } catch (error) {
    logger.error('[COURSES] Seed error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi seed dữ liệu' } };
  }
}

}

module.exports = new CourseApplicationService();
