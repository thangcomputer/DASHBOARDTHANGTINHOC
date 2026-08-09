'use strict';
const backupApplicationService = require('../../services/BackupApplicationService');

class Get_id_downloadHandler {
  async execute(query) {
    return await backupApplicationService.get_id_download(query);
  }
}
module.exports = Get_id_downloadHandler;
