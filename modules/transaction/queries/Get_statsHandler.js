'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');

class Get_statsHandler {
  async execute(query) {
    return await transactionApplicationService.get_stats(query);
  }
}
module.exports = Get_statsHandler;
