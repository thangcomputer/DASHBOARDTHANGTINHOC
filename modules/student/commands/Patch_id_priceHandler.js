'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPatch_id_priceCompleted = require('../events/StudentPatch_id_priceCompleted');

class Patch_id_priceHandler {
  async execute(command) {
    const result = await studentApplicationService.patch_id_price(command);
    await eventBus.publish(new StudentPatch_id_priceCompleted(command));
    return result;
  }
}
module.exports = Patch_id_priceHandler;
