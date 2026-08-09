'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class Inventory {
  constructor(data) {
    this._id = data.id || data._id;
    this.itemId = data.itemId;
    this.quantity = data.quantity || 0;
    this.reserved = data.reserved || 0;
    this.tenantId = data.tenantId;
    this.branchId = data.branchId;
  }
  get id() { return this._id; }
  get available() { return this.quantity - this.reserved; }
  
  reserve(amount) {
    if (this.available < amount) {
      throw new AppError('NegativeInventory', 'Insufficient stock available for reservation.');
    }
    this.reserved += amount;
    return {
      type: 'InventoryReserved',
      aggregateId: this.id,
      payload: { itemId: this.itemId, amount, tenantId: this.tenantId, branchId: this.branchId },
      occurredAt: new Date()
    };
  }
}
module.exports = Inventory;
