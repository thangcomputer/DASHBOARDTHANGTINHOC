const CreditNoteRepository = require('./CreditNoteRepository');
const CreditNote = require('../models/CreditNote');

class MongoCreditNoteRepository extends CreditNoteRepository {
  constructor() {
    super(CreditNote);
  }
}

module.exports = MongoCreditNoteRepository;
