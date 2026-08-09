'use strict';
const mongoose = require('mongoose');
const Metrics = require('../observability/Metrics');
const config = require('../../config/performance');

class MongoProfiler {
  static init() {
    mongoose.set('debug', (collectionName, method, query, doc, options) => {
      // Basic profiling interceptor
      Metrics.inc('mongo_query_executed', { collection: collectionName, method });
    });
  }
}
module.exports = MongoProfiler;