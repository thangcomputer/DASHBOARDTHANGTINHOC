const MongoPaymentSessionRepository = require('./MongoPaymentSessionRepository');
const MongoSepayWebhookEventRepository = require('./MongoSepayWebhookEventRepository');

module.exports = {
  paymentSessionRepository: new MongoPaymentSessionRepository(),
  sepayWebhookEventRepository: new MongoSepayWebhookEventRepository(),
};
