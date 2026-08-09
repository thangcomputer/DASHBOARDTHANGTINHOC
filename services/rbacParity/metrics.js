/**
 * Phase 8.11/8.12 — In-memory RBAC parity / dual-check metrics (low cardinality).
 * Not Prometheus; safe for soak. No userId / URL / email labels.
 */
const totals = {
  rbac_parity_match_total: 0,
  rbac_parity_mismatch_total: 0,
  rbac_parity_unknown_total: 0,
  rbac_parity_unsupported_total: 0,
  rbac_parity_observer_error_total: 0,
  rbac_dualcheck_total: 0,
  rbac_dualcheck_mismatch_total: 0,
  rbac_dualcheck_error_total: 0,
};

function incrementParityMetric(comparison) {
  switch (comparison) {
    case 'MATCH':
      totals.rbac_parity_match_total += 1;
      break;
    case 'MISMATCH':
      totals.rbac_parity_mismatch_total += 1;
      break;
    case 'UNKNOWN':
      totals.rbac_parity_unknown_total += 1;
      break;
    case 'UNSUPPORTED':
      totals.rbac_parity_unsupported_total += 1;
      break;
    case 'ERROR':
      totals.rbac_parity_observer_error_total += 1;
      break;
    default:
      break;
  }
}

function incrementDualCheckMetric(comparison) {
  if (comparison === 'ERROR') {
    totals.rbac_dualcheck_error_total += 1;
    return;
  }
  totals.rbac_dualcheck_total += 1;
  if (comparison === 'MISMATCH') {
    totals.rbac_dualcheck_mismatch_total += 1;
  }
}

function getParityMetricsSnapshot() {
  return { ...totals };
}

function resetParityMetricsForTests() {
  Object.keys(totals).forEach((k) => {
    totals[k] = 0;
  });
}

module.exports = {
  incrementParityMetric,
  incrementDualCheckMetric,
  getParityMetricsSnapshot,
  resetParityMetricsForTests,
};
