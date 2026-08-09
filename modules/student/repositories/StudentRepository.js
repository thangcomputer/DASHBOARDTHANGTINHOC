'use strict';

const mongoose = require('mongoose');

class StudentRepository {
  async save(aggregate, session) {
    const StudentModel = mongoose.models.Student || mongoose.model('Student');
    
    // Convert domain aggregate to persistence model
    const studentDoc = new StudentModel({
      _id: aggregate.id || new mongoose.Types.ObjectId(),
      ...aggregate.data
    });
    
    const result = await studentDoc.save({ session });
    
    // Update aggregate ID if it was generated
    aggregate.id = result._id;
    return result;
  }

  async existsByPhoneOrEmail(phone, email) {
    const StudentModel = mongoose.models.Student || mongoose.model('Student');
    const TransactionContext = require('../../../shared/transaction/TransactionContext');
    const tx = TransactionContext.current();
    const session = tx ? (tx.session || null) : null;
    const conditions = [];
    if (phone) conditions.push({ phone });
    if (email) conditions.push({ email });
    if (conditions.length === 0) return false;
    const existing = await StudentModel.findOne({ $or: conditions }, null, session ? { session } : {}).lean();
    return !!existing;
  }
}

module.exports = new StudentRepository();
