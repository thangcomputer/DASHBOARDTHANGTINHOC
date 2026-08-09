'use strict';
const Metrics = require('./Metrics');

class PrometheusExporter {
  static toPrometheusText() {
    const snapshot = Metrics.snapshot();
    let text = '';
    
    // Counters
    for (const c of snapshot.counters) {
      text += `# TYPE ${c.name} counter\n`;
      const labels = Object.entries(c.labels).map(([k, v]) => `${k}="${v}"`).join(',');
      text += `${c.name}{${labels}} ${c.value}\n`;
    }
    
    // Histograms
    for (const h of snapshot.histograms) {
      text += `# TYPE ${h.name} summary\n`;
      const labels = Object.entries(h.labels).map(([k, v]) => `${k}="${v}"`).join(',');
      text += `${h.name}_sum{${labels}} ${h.sum}\n`;
      text += `${h.name}_count{${labels}} ${h.count}\n`;
    }
    
    // Node.js base metrics
    text += `# TYPE memory_usage_bytes gauge\nmemory_usage_bytes ${process.memoryUsage().heapUsed}\n`;
    text += `# TYPE nodejs_heap_size_bytes gauge\nnodejs_heap_size_bytes ${process.memoryUsage().heapTotal}\n`;
    text += `# TYPE event_loop_lag_seconds gauge\nevent_loop_lag_seconds 0\n`;
    
    return text;
  }
}
module.exports = PrometheusExporter;
