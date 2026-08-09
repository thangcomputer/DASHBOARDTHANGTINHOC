class NotificationRepository {
  async create(data) { throw new Error('Not implemented'); }
  async findPaginated(filter, skip, limit) { throw new Error('Not implemented'); }
  async count(filter) { throw new Error('Not implemented'); }
  async markAllAsRead(filter, userId) { throw new Error('Not implemented'); }
  async markAsRead(notificationId, userId) { throw new Error('Not implemented'); }
  async markAsDismissed(notificationId, userId) { throw new Error('Not implemented'); }
}

module.exports = NotificationRepository;
