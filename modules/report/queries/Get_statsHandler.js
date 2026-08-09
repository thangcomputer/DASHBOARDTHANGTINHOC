'use strict';
const backupApplicationService = require('../../services/BackupApplicationService');

class Get_statsHandler {
  async execute(query) {
    return await backupApplicationService.get_stats(query);
  }
}
module.exports = Get_statsHandler;
