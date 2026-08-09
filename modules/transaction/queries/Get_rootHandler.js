'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');

class Get_rootHandler {
  async execute(query) {
    return await transactionApplicationService.get_root(query);
  }
}
module.exports = Get_rootHandler;
