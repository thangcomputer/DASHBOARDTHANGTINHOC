'use strict';
class DeduplicationStore {
  async exists(hash) { return false; }
}
module.exports = DeduplicationStore;