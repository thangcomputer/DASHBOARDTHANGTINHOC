'use strict';
class MongoTransaction {
  constructor(session) { this.session = session; }
  async commit() { if (this.session) { await this.session.commitTransaction(); this.session.endSession(); } }
  async rollback() { if (this.session) { await this.session.abortTransaction(); this.session.endSession(); } }
}
module.exports = MongoTransaction;