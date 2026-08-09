'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class InventoryPolicy {
  static checkReservation(inventory, requestedAmount) {
    if (inventory.available < requestedAmount) {
      throw new AppError('ReservationConflict', 'Cannot reserve more than available stock.');
    }
    return true;
  }
}
module.exports = InventoryPolicy;
