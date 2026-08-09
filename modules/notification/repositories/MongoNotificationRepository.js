const NotificationRepository = require('./NotificationRepository');
const Notification = require('../models/Notification');

class MongoNotificationRepository extends NotificationRepository {
  async create(data) {
    return Notification.create(data);
  }

  async findPaginated(filter, skip, limit) {
    return Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  async count(filter) {
    return Notification.countDocuments(filter);
  }

  async markAllAsRead(filter, userId) {
    return Notification.updateMany(filter, { $addToSet: { read_by: userId } });
  }

  async markAsRead(notificationId, userId) {
    return Notification.findByIdAndUpdate(notificationId, { $addToSet: { read_by: userId } });
  }

  async markAsDismissed(notificationId, userId) {
    return Notification.findByIdAndUpdate(
      notificationId,
      { $addToSet: { dismissed_by: userId } },
      { returnDocument: 'after' }
    );
  }
}

module.exports = MongoNotificationRepository;
