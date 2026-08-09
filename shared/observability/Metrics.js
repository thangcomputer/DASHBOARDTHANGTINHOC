'use strict';
class MetricsRegistry {
  constructor() {
    this.counters = new Map();
    this.histograms = new Map();
  }

  inc(name, labels = {}, value = 1) {
    const key = this._hash(name, labels);
    const current = this.counters.get(key) || { name, labels, value: 0 };
    current.value += value;
    this.counters.set(key, current);
  }

  observe(name, labels = {}, value) {
    const key = this._hash(name, labels);
    const current = this.histograms.get(key) || { name, labels, values: [], sum: 0, count: 0 };
    current.values.push(value);
    current.sum += value;
    current.count += 1;
    this.histograms.set(key, current);
  }

  _hash(name, labels) {
    return name + '_' + Object.keys(labels).sort().map(k => `${k}:${labels[k]}`).join('_');
  }

  snapshot() {
    return {
      counters: Array.from(this.counters.values()),
      histograms: Array.from(this.histograms.values()).map(h => ({
        ...h,
        avg: h.count === 0 ? 0 : h.sum / h.count
      }))
    };
  }
}
const globalMetrics = new MetricsRegistry();
module.exports = globalMetrics;
