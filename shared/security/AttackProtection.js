'use strict';
const express = require('express');
const hpp = require('hpp');
const config = require('../../config/security');
const Metrics = require('../observability/Metrics');

// Request Timeout Middleware (Slowloris protection)
const requestTimeout = (req, res, next) => {
  req.setTimeout(config.payload.timeoutMs, () => {
    Metrics.inc('request_timeout', { path: req.path });
    const err = new Error('Request Timeout');
    err.status = 408;
    next(err);
  });
  res.setTimeout(config.payload.timeoutMs, () => {
    Metrics.inc('response_timeout', { path: req.path });
    const err = new Error('Service Unavailable');
    err.status = 503;
    next(err);
  });
  next();
};

// Malformed JSON handler
const jsonParser = express.json({ limit: config.payload.jsonLimit });
const safeJsonParser = (req, res, next) => {
  jsonParser(req, res, (err) => {
    if (err) {
      Metrics.inc('malformed_payload', { type: 'json' });
      return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }
    next();
  });
};

const urlEncodedParser = express.urlencoded({ extended: true, limit: config.payload.urlEncodedLimit });

module.exports = {
  requestTimeout,
  safeJsonParser,
  urlEncodedParser,
  hppProtection: hpp()
};