'use strict';

const MapperMetrics = require('../../../../shared/metrics/MapperMetrics');

class MonitoringMapper {
  static _withMetrics(name, fn) {
    const start = Date.now();
    const result = fn();
    MapperMetrics.logExecution('report', 'MonitoringMapper.' + name, Date.now() - start);
    return result;
  }

  static fromCreateDTO(command) { return this._withMetrics('fromCreateDTO', () => ({ ...command })); }
  static fromUpdateDTO(command) { return this._withMetrics('fromUpdateDTO', () => ({ ...command })); }
  static toEntity(dto) { return this._withMetrics('toEntity', () => ({ ...dto })); }
  static toResponse(entity) { return this._withMetrics('toResponse', () => ({ ...entity })); }
  static toSummary(entity) { return this._withMetrics('toSummary', () => ({ ...entity })); }
  static toDetail(entity) { return this._withMetrics('toDetail', () => ({ ...entity })); }
}

module.exports = MonitoringMapper;
