const FileAsset = require('../models/FileAsset');

class FileRepository {
  async create(data) {
    return FileAsset.create(data);
  }

  async findById(id) {
    return FileAsset.findById(id);
  }

  async save(asset) {
    return asset.save();
  }

  async findActiveAssets(filter, skip, limit) {
    return FileAsset.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countActiveAssets(filter) {
    return FileAsset.countDocuments(filter);
  }

  async aggregateStats() {
    return FileAsset.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' },
        },
      },
      { $sort: { totalSize: -1 } },
    ]);
  }

  async findExpired(limit) {
    const now = new Date();
    return FileAsset.find({
      status: 'active',
      expiresAt: { $ne: null, $lte: now },
    }).limit(limit);
  }
}

module.exports = new FileRepository();
