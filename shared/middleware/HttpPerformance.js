'use strict';
const config = require('../../config/performance');
const eTag = require('etag');

const httpPerformance = (req, res, next) => {
  if (config.http.etag) {
    // Rely on Express default ETag, just ensuring it's enabled globally
    req.app.set('etag', 'strong');
  }
  if (config.http.conditionalGet) {
    res.setHeader('Cache-Control', 'public, max-age=60'); // basic strategy for static/cacheable GETs
  }
  next();
};
module.exports = httpPerformance;