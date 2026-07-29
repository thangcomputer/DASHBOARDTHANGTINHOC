/**
 * Feature flags tài chính — P4 cutover.
 * FINANCE_LEDGER_SOT mặc định bật (true) sau P0.
 */
function isLedgerSot() {
  const v = process.env.FINANCE_LEDGER_SOT;
  if (v == null || String(v).trim() === '') return true;
  return !['0', 'false', 'off', 'no'].includes(String(v).trim().toLowerCase());
}

function allowHardDeleteFinance() {
  const v = process.env.FINANCE_ALLOW_HARD_DELETE;
  return ['1', 'true', 'yes', 'on'].includes(String(v || '').trim().toLowerCase());
}

module.exports = {
  isLedgerSot,
  allowHardDeleteFinance,
};
