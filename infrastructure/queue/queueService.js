const jobQueue = require('../../services/queue/jobQueue');

/**
 * Infrastructure Queue Service wrapper for BullMQ.
 */
const queueService = {
  init: async (options) => {
    return jobQueue.initJobQueue(options);
  },

  enqueueJob: async (queueKind, jobName, data, options) => {
    return jobQueue.enqueue(queueKind, jobName, data, options);
  },

  getMode: () => {
    return jobQueue.getQueueMode();
  },

  close: async () => {
    return jobQueue.closeJobQueue();
  },

  // Proxy helpers matching original queue
  enqueueOtp: (data, opts) => jobQueue.enqueueOtp(data, opts),
  enqueuePassword: (data, opts) => jobQueue.enqueuePassword(data, opts),
  enqueueWelcome: (data, opts) => jobQueue.enqueueWelcome(data, opts),
  enqueueInvoicePdf: (data, opts) => jobQueue.enqueueInvoicePdf(data, opts),
  enqueueInvoiceEmail: (data, opts) => jobQueue.enqueueInvoiceEmail(data, opts),
  enqueueBackup: (data, opts) => jobQueue.enqueueBackup(data, opts),
};

module.exports = queueService;
