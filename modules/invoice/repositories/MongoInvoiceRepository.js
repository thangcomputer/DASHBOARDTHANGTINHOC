'use strict';
const InvoiceRepository = require('./InvoiceRepository');
const Invoice = require('../models/Invoice');
const TransactionContext = require('../../../shared/transaction/TransactionContext');

class MongoInvoiceRepository extends InvoiceRepository {
  constructor() {
    super(Invoice);
  }

  _getSession(options = {}) {
    if (options.session !== undefined) {
      return options.session;
    }
    const tx = TransactionContext.current();
    return tx ? (tx.session || tx) : undefined;
  }

  async create(data, options = {}) {
    options.session = this._getSession(options);
    return super.create(data, options);
  }

  async save(doc, options = {}) {
    options.session = this._getSession(options);
    return super.save(doc, options);
  }

  async updateById(id, updateData, options = {}) {
    options.session = this._getSession(options);
    return super.updateById(id, updateData, options);
  }

  async updateOne(filter, updateData, options = {}) {
    options.session = this._getSession(options);
    return super.updateOne(filter, updateData, options);
  }

  async updateMany(filter, updateData, options = {}) {
    options.session = this._getSession(options);
    return super.updateMany(filter, updateData, options);
  }

  async deleteById(id, options = {}) {
    options.session = this._getSession(options);
    return super.deleteById(id, options);
  }

  async deleteOne(filter, options = {}) {
    options.session = this._getSession(options);
    return super.deleteOne(filter, options);
  }

  async deleteMany(filter, options = {}) {
    options.session = this._getSession(options);
    return super.deleteMany(filter, options);
  }

  async findById(id, options = {}) {
    options.session = this._getSession(options);
    return super.findById(id, options);
  }

  async findOne(filter, options = {}) {
    options.session = this._getSession(options);
    return super.findOne(filter, options);
  }

  async findMany(filter = {}, options = {}) {
    options.session = this._getSession(options);
    return super.findMany(filter, options);
  }

  async count(filter = {}, options = {}) {
    options.session = this._getSession(options);
    return super.count(filter, options);
  }

  async exists(filter = {}, options = {}) {
    options.session = this._getSession(options);
    return super.exists(filter, options);
  }

  async aggregate(pipeline, options = {}) {
    options.session = this._getSession(options);
    return super.aggregate(pipeline, options);
  }

  async aggregateInvoiceTotals(match, options = {}) {
    options.session = this._getSession(options);
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: '$hocPhi' },
          count: { $sum: 1 },
        },
      },
    ], options);
  }
}

module.exports = MongoInvoiceRepository;
