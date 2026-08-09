'use strict';
const Metrics = require('./Metrics');

class Profiler {
  static profile(name, fn) {
    const start = process.hrtime.bigint();
    return Promise.resolve(fn()).then(result => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1000000;
      Metrics.histogram('profiler_duration_ms', durationMs, { name });
      return result;
    });
  }
}
module.exports = Profiler;
