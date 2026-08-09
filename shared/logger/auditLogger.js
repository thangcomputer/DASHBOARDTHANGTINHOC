const AuditLog = require('../../modules/report/models/AuditLog');
const logger = require('./logger');
const correlationContext = require('../context/correlationContext');
const RequestContext = require('../observability/RequestContext');

const auditLogger = {
  /**
   * Log an operational audit event.
   *
   * @param {Object} actor - The user performing the action (req.currentUser)
   * @param {string} action - Event action type (from AuditEvents)
   * @param {string} entityType - The database collection or model name
   * @param {string} entityId - The specific entity ID affected
   * @param {Object} [details={}] - Additional details (oldValue, newValue, branchId, device)
   * @param {Object} [req] - Optional request object for resolving fallback IP and headers
   */
  log: async (actor, action, entityType, entityId, details = {}, req = null) => {
    try {
      const store = correlationContext.getStore();
      const ctx = RequestContext.getContext();
      const requestId = store?.requestId || ctx?.requestId || req?.requestId || req?.id || '';
      const correlationId = store?.correlationId || ctx?.correlationId || req?.correlationId || '';
      const traceId = ctx?.traceId || '';
      const spanId = ctx?.spanId || '';
      const sessionId = ctx?.sessionId || '';
      
      const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
      const userAgent = req?.headers?.['user-agent'] || '';

      const actorUserId = actor?._id || actor?.id || '';
      const actorRole = actor?.roleCode || actor?.adminRole || actor?.role || '';
      const branchId = actor?.branchId || details?.branchId || null;

      const logData = {
        action,
        actorUserId: String(actorUserId),
        actorRole: String(actorRole),
        branchId,
        entityType,
        entityId: String(entityId),
        oldValue: details?.oldValue || {},
        newValue: details?.newValue || {},
        ip,
        userAgent,
        device: details?.device || '',
        requestId,
        correlationId,
        traceId,
        spanId,
        sessionId,
      };

      // Write to Mongoose
      const auditDoc = await AuditLog.create(logData);

      // Write to Pino logs
      logger.info({ audit: logData }, `Audit Event: ${action}`);

      return auditDoc;
    } catch (err) {
      logger.error({ err: err.message, action, entityId }, 'Failed to record audit log');
      return null;
    }
  }
};

module.exports = auditLogger;
