'use strict';
const { teachingGuideRepository } = require('./../repositories');
const TeachingGuide = require('./../models/TeachingGuide'); // Temp for new TeachingGuide
const logger = require('./../../../config/logger');

// Lấy tất cả tài liệu đào tạo (cho Admin, Teacher, Student)

class TeachingGuideApplicationService {
  async get_root(data) {
  try {
    const filter = { isActive: true };
    // Nếu có category lọc
    if (data.category) {
      filter.category = data.category;
    }
    
    const guides = await teachingGuideRepository.findMany(filter).sort({ createdAt: -1 });
    return { _status: 200, _body: { success: true, data: guides } };
  } catch (error) {
    logger.error('[TRAINING] Get all error:', error);
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

}

module.exports = new TeachingGuideApplicationService();
