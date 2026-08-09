'use strict';
const backupApplicationService = require('../../services/BackupApplicationService');

class Get_rootHandler {
  async execute(query) {
    return await backupApplicationService.get_root(query);
  }
}
module.exports = Get_rootHandler;
