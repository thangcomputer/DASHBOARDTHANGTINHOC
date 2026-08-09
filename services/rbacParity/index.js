module.exports = {
  ...require('./compareLiveEnterprise'),
  ...require('./observe'),
  ...require('./dualCheck'),
  ...require('./metrics'),
  ...require('./soakEvidence'),
  ...require('./productionSoak'),
  ...require('./runtimeSoakEvidence'),
  ...require('./finalReadiness'),
  ...require('./runtimeEvidence820'),
  ...require('./runtimeEvidenceExport'),
};
