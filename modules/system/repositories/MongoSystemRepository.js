const SystemRepository = require('./SystemRepository');
const SystemSettings = require('../models/SystemSettings');

class MongoSystemRepository extends SystemRepository {
  async findMain() {
    return SystemSettings.findOne({ _key: 'main' }).lean();
  }

  async findMainPublic(selectFields) {
    return SystemSettings.findOne({ _key: 'main' }).select(selectFields).lean();
  }

  async findMainWithSecrets() {
    return SystemSettings.findOne({ _key: 'main' }).select('+adminPasswordHash +adminMfaSecret +adminMfaPendingSecret');
  }

  async createMain() {
    return SystemSettings.create({ _key: 'main' });
  }

  async updateMain(update, options = {}) {
    return SystemSettings.findOneAndUpdate(
      { _key: 'main' },
      update,
      { upsert: true, returnDocument: 'after', ...options }
    );
  }
}

module.exports = MongoSystemRepository;
