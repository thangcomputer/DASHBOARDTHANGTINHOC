const SepayWebhookEventRepository = require('./SepayWebhookEventRepository');
const SepayWebhookEvent = require('../models/SepayWebhookEvent');

class MongoSepayWebhookEventRepository extends SepayWebhookEventRepository {
  constructor() {
    super(SepayWebhookEvent);
  }
}

module.exports = MongoSepayWebhookEventRepository;
