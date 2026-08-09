'use strict';
const studentApplicationService = require('../services/StudentApplicationService');

class Get_id_full_detailHandler {
  async execute(query) {
    return await studentApplicationService.get_id_full_detail(query);
  }
}
module.exports = Get_id_full_detailHandler;
