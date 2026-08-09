'use strict';
const biApplicationService = require('../../services/BiApplicationService');

class Get_exportHandler {
  async execute(query) {
    return await biApplicationService.get_export(query);
  }
}
module.exports = Get_exportHandler;
