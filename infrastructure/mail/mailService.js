const email = require('../../modules/chat/services/messaging/email');

/**
 * Infrastructure Mail Service wrapper.
 * Isolates email sending operations.
 */
const mailService = {
  isConfigured: () => {
    return email.isEmailConfigured();
  },

  send: async (options) => {
    // Expected options: { to, subject, text, html, attachments }
    return email.sendEmail(options);
  },
};

module.exports = mailService;
