'use strict';
const rateLimit = require('express-rate-limit');
const config = require('../../config/security');
const Metrics = require('../observability/Metrics');

module.exports = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: config.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    Metrics.inc('rate_limit_exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).send(options.message);
  }
});