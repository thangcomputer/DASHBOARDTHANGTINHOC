/**
 * Phase 8.19 — Final Enterprise readiness & cutover gate (NON-AUTHORITATIVE).
 *
 * Does NOT promote Enterprise.
 * Does NOT mount authorize().
 * Does NOT enable flags.
 * Does NOT mutate LIVE auth / Policy / CutoverGate.
 * Does NOT invent production RUNTIME evidence.
 */
const fs = require('node:fs');
const path = require('node:path');
const map = require('../../shared/constants/legacyPermissionMapping');
const {
  resolveEnterpriseRoleContract,
  ADMIN_ROLE_TO_ENTERPRISE,
} = require('../../shared/constants/roleAliasContract');
const {
  PRODUCTION_SOAK_EVIDENCE,
  SOAK_ENV,
  isProductionLikeEnvironment,
} = require('./productionSoak');
const { RUNTIME_COVERAGE, SAFETY } = require('./runtimeSoakEvidence');

const READINESS_DECISION = Object.freeze({
  READY: 'READY',
  NOT_READY: 'NOT_READY',
  BLOCKED: 'BLOCKED',
});

const GATE = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_EVALUATED: 'NOT_EVALUATED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

const MISMATCH_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  NON_CRITICAL: 'NON_CRITICAL',
  KNOWN_LEGACY: 'KNOWN_LEGACY',
});

const DEFAULT_818_ARTIFACT = path.join(__dirname, '../../artifacts/rbac-soak-818.json');
const DEFAULT_819_ARTIFACT = path.join(__dirname, '../../artifacts/rbac-readiness-819.json');

function loadJsonSafe(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function gatePass(ok) {
  return ok ? GATE.PASS : GATE.FAIL;
}

function safetyStatus(v) {
  if (v === SAFETY.PASS || v === 'PASS') return SAFETY.PASS;
  if (v === SAFETY.FAIL || v === 'FAIL') return SAFETY.FAIL;
  if (v === SAFETY.NOT_EVALUATED || v === 'NOT_EVALUATED') return SAFETY.NOT_EVALUATED;
  return SAFETY.NOT_EVALUATED;
}

/**
 * Aggregate domain gate: FAIL > NOT_EVALUATED > PASS.
 * NOT_EVALUATED is never collapsed into FAIL or PASS.
 */
function aggregateDomainGate(statuses) {
  const list = statuses.filter(Boolean);
  if (list.some((s) => s === SAFETY.FAIL || s === GATE.FAIL)) return GATE.FAIL;
  if (list.some((s) => s === SAFETY.NOT_EVALUATED || s === GATE.NOT_EVALUATED)) {
    return GATE.NOT_EVALUATED;
  }
  if (list.length > 0 && list.every((s) => s === SAFETY.PASS || s === GATE.PASS)) {
    return GATE.PASS;
  }
  return GATE.NOT_EVALUATED;
}

function classifyMismatchSeverity(sample = {}) {
  const live = sample.liveDecision;
  const ent = sample.enterpriseDecision;
  if (live === 'DENY' && ent === 'ALLOW') return MISMATCH_SEVERITY.CRITICAL;
  const reason = String(sample.mismatchReason || '');
  if (
    reason === 'SCOPE_MISMATCH'
    || reason === 'OWNERSHIP_MISMATCH'
    || reason === 'BUNDLE_MISMATCH'
    || reason === 'ROLE_MISMATCH'
  ) {
    if (live === 'DENY' && ent === 'ALLOW') return MISMATCH_SEVERITY.CRITICAL;
  }
  if (
    sample.knownLegacyMismatch === 'KNOWN_LEGACY_MISMATCH'
    || sample.mismatchClassification === 'LEGACY_COMPATIBILITY'
    || sample.role === 'LEGACY_PRINCIPAL'
  ) {
    return MISMATCH_SEVERITY.KNOWN_LEGACY;
  }
  if (live !== ent) return MISMATCH_SEVERITY.NON_CRITICAL;
  return MISMATCH_SEVERITY.NON_CRITICAL;
}

/**
 * Domain safety from production RUNTIME evidence only.
 * No production runtime → NOT_EVALUATED (never FAIL, never PASS).
 */
function evaluateDomainSafetyEvidence({
  productionLike,
  productionRuntimeExecuted,
  runtimeEvents,
  productionSoakEvidence,
  financeSafety,
  hrSafety,
  teacherSafety,
  studentTrainingSafety,
  legacyPrincipalSafety,
} = {}) {
  const hasProdRuntime = Boolean(
    productionLike
    && productionRuntimeExecuted
    && runtimeEvents > 0
    && productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
  );

  if (!hasProdRuntime) {
    return {
      finance: SAFETY.NOT_EVALUATED,
      hr: SAFETY.NOT_EVALUATED,
      teacher: SAFETY.NOT_EVALUATED,
      studentTraining: SAFETY.NOT_EVALUATED,
      legacyPrincipal: SAFETY.NOT_EVALUATED,
      note: 'No STAGING/PRODUCTION RUNTIME evidence — domains NOT_EVALUATED (not FAIL)',
    };
  }

  return {
    finance: safetyStatus(financeSafety),
    hr: safetyStatus(hrSafety),
    teacher: safetyStatus(teacherSafety),
    studentTraining: safetyStatus(studentTrainingSafety),
    legacyPrincipal: safetyStatus(legacyPrincipalSafety),
    note: 'Evaluated from production RUNTIME soak artifact',
  };
}

function evaluateCatalogContracts() {
  const financeRevenue = map.resolve('view_branch_revenue');
  const financeOk = Array.isArray(financeRevenue)
    && financeRevenue.length === 1
    && financeRevenue[0] === 'finance:branch_revenue:view'
    && !financeRevenue.includes('finance:view');

  const financeBundle = map.resolve('manage_finance');
  const financeBundleOk = Array.isArray(financeBundle)
    && financeBundle.includes('finance:view')
    && financeBundle.includes('finance:payment:create')
    && financeBundle.includes('finance:refund:approve');

  const hrOk = JSON.stringify(map.resolve('manage_hr')) === JSON.stringify(['hr:manage']);
  const teacherView = map.resolve('view_teachers');
  const teacherManage = map.resolve('manage_teachers');
  const teacherOk = JSON.stringify(teacherView) === JSON.stringify(['teacher:view'])
    && JSON.stringify(teacherManage) === JSON.stringify(['teacher:manage'])
    && JSON.stringify(teacherView) !== JSON.stringify(teacherManage);

  const st = map.resolve('manage_student_training');
  const training = map.resolve('manage_training');
  const studentTrainingOk = JSON.stringify(st) === JSON.stringify(['student_training:manage'])
    && JSON.stringify(st) !== JSON.stringify(training);

  const bare = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
  const bareStaff = resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: null });
  const root = resolveEnterpriseRoleContract({ userId: 'admin' });
  const roleOk = bare.type === 'LEGACY_PRINCIPAL' && bare.enterpriseRole === null
    && bareStaff.type === 'LEGACY_PRINCIPAL' && bareStaff.enterpriseRole === null
    && root.type === 'LEGACY_ROOT'
    && ADMIN_ROLE_TO_ENTERPRISE.STAFF === 'ADMIN_STAFF'
    && ADMIN_ROLE_TO_ENTERPRISE.SUPPORT === 'SUPPORT_AGENT'
    && ADMIN_ROLE_TO_ENTERPRISE.SUPER_ADMIN === 'SUPER_ADMIN'
    && ADMIN_ROLE_TO_ENTERPRISE.HIGH_ADMIN === 'HIGH_ADMIN';

  const unsupported = (map.LEGACY_ONLY_KEYS || []).map((k) => ({
    key: k,
    status: 'LEGACY_ONLY',
    mapped: map.resolve(k),
  }));
  const unsupportedSilentMap = unsupported.some((u) => (u.mapped || []).length > 0);

  return {
    financeOk: financeOk && financeBundleOk,
    hrOk,
    teacherOk,
    studentTrainingOk,
    roleOk,
    unsupported,
    unsupportedSilentMap,
  };
}

function normalizeSoakEvidence(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    return {
      valid: false,
      environment: 'NONE',
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
      runtimeCoverage: RUNTIME_COVERAGE.NOT_AVAILABLE,
      runtimeEvents: 0,
      observerErrors: 0,
      dualCheckErrors: 0,
      criticalMismatchCount: 0,
      privilegeWidening: false,
      financeSafety: SAFETY.NOT_EVALUATED,
      hrSafety: SAFETY.NOT_EVALUATED,
      teacherSafety: SAFETY.NOT_EVALUATED,
      studentTrainingSafety: SAFETY.NOT_EVALUATED,
      legacyPrincipalSafety: SAFETY.NOT_EVALUATED,
      finalDecisionInvariant: SAFETY.NOT_EVALUATED,
      productionRuntimeExecuted: false,
      blockers: ['soak_artifact_missing'],
    };
  }

  const environment = String(
    artifact.environment || artifact.RUNTIME_ENVIRONMENT || 'NONE',
  ).toUpperCase();
  const productionLike = isProductionLikeEnvironment(environment);
  const evidence = artifact.productionSoakEvidence
    || artifact.SOAK_EVIDENCE
    || PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE;
  const coverage = artifact.coverage?.runtimeCoverage
    || artifact.runtimeCoverage
    || RUNTIME_COVERAGE.NOT_AVAILABLE;
  const runtimeEvents = Number(
    artifact.runtimeHookEvents
    ?? artifact.soakDelta?.requests
    ?? artifact.channels?.RUNTIME?.requests
    ?? 0,
  );
  const observerErrors = Number(artifact.observerErrors ?? artifact.soakDelta?.observer_errors ?? 0);
  const dualCheckErrors = Number(artifact.dualCheckErrors ?? artifact.soakDelta?.dualcheck_errors ?? 0);
  const criticalMismatchCount = Number(artifact.criticalMismatchCount ?? 0);

  const blockers = [];
  if (!productionLike) blockers.push('evidence_environment_not_staging_or_production');
  if (environment === SOAK_ENV.LOCAL || environment === 'LOCAL') {
    blockers.push('local_evidence_not_production');
  }
  if (evidence !== PRODUCTION_SOAK_EVIDENCE.AVAILABLE) {
    blockers.push('production_soak_evidence_not_available');
  }
  if (coverage === RUNTIME_COVERAGE.NOT_AVAILABLE) {
    blockers.push('runtime_coverage_not_available');
  } else if (coverage !== RUNTIME_COVERAGE.COMPLETE) {
    blockers.push('runtime_coverage_not_complete');
  }
  if (runtimeEvents <= 0) blockers.push('no_runtime_events');
  if (observerErrors > 0) blockers.push('observer_errors');
  if (dualCheckErrors > 0) blockers.push('dualcheck_errors');
  if (criticalMismatchCount > 0) blockers.push('critical_mismatches');

  const domains = evaluateDomainSafetyEvidence({
    productionLike,
    productionRuntimeExecuted: Boolean(artifact.productionRuntimeExecuted),
    runtimeEvents,
    productionSoakEvidence: evidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE
      ? PRODUCTION_SOAK_EVIDENCE.AVAILABLE
      : PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
    financeSafety: artifact.financeSafety?.status,
    hrSafety: artifact.hrSafety?.status,
    teacherSafety: artifact.teacherSafety?.status,
    studentTrainingSafety: artifact.studentTrainingSafety?.status,
    legacyPrincipalSafety: artifact.legacyPrincipalSafety?.status,
  });

  // Privilege widening only when there is evaluated FAIL/critical evidence — not NOT_EVALUATED
  const privilegeWidening = criticalMismatchCount > 0
    || domains.finance === SAFETY.FAIL
    || domains.hr === SAFETY.FAIL
    || domains.teacher === SAFETY.FAIL
    || domains.studentTraining === SAFETY.FAIL
    || domains.legacyPrincipal === SAFETY.FAIL;

  if (privilegeWidening) blockers.push('privilege_widening');
  if (domains.finance === SAFETY.FAIL || domains.hr === SAFETY.FAIL
    || domains.teacher === SAFETY.FAIL || domains.studentTraining === SAFETY.FAIL) {
    blockers.push('domain_safety_fail');
  }
  if (aggregateDomainGate([
    domains.finance, domains.hr, domains.teacher,
    domains.studentTraining, domains.legacyPrincipal,
  ]) === GATE.NOT_EVALUATED) {
    blockers.push('domain_safety_not_evaluated');
  }

  // Code-level invariant from artifact; without prod runtime keep as reported or NOT_EVALUATED
  let finalDecisionInvariant = safetyStatus(artifact.finalDecisionInvariant);
  if (!productionLike || runtimeEvents <= 0) {
    // Prefer explicit PASS from code soak artifact if present; else NOT_EVALUATED
    if (artifact.finalDecisionInvariant !== SAFETY.PASS
      && artifact.finalDecisionInvariant !== 'PASS') {
      finalDecisionInvariant = SAFETY.NOT_EVALUATED;
    }
  }
  if (finalDecisionInvariant === SAFETY.FAIL) blockers.push('finalDecision_invariant_fail');

  const valid = productionLike
    && evidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE
    && coverage === RUNTIME_COVERAGE.COMPLETE
    && runtimeEvents > 0
    && observerErrors === 0
    && dualCheckErrors === 0
    && criticalMismatchCount === 0
    && !privilegeWidening
    && finalDecisionInvariant === SAFETY.PASS
    && domains.finance === SAFETY.PASS
    && domains.hr === SAFETY.PASS
    && domains.teacher === SAFETY.PASS
    && domains.studentTraining === SAFETY.PASS
    && domains.legacyPrincipal === SAFETY.PASS;

  return {
    valid,
    environment: environment || 'NONE',
    productionSoakEvidence: (productionLike && evidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE)
      ? PRODUCTION_SOAK_EVIDENCE.AVAILABLE
      : PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
    runtimeCoverage: productionLike ? coverage : RUNTIME_COVERAGE.NOT_AVAILABLE,
    runtimeEvents: productionLike ? runtimeEvents : 0,
    observerErrors,
    dualCheckErrors,
    criticalMismatchCount: productionLike ? criticalMismatchCount : 0,
    privilegeWidening: productionLike ? privilegeWidening : false,
    financeSafety: domains.finance,
    hrSafety: domains.hr,
    teacherSafety: domains.teacher,
    studentTrainingSafety: domains.studentTraining,
    legacyPrincipalSafety: domains.legacyPrincipal,
    domainSafetyNote: domains.note,
    finalDecisionInvariant,
    productionRuntimeExecuted: productionLike && Boolean(artifact.productionRuntimeExecuted),
    blockers,
  };
}

function evaluateFinalReadiness(opts = {}) {
  const soakArtifact = opts.soakArtifact
    || loadJsonSafe(opts.soakArtifactPath || DEFAULT_818_ARTIFACT);

  const catalog = evaluateCatalogContracts();
  const soak = normalizeSoakEvidence(soakArtifact);

  const parityReady = opts.parityReady !== false;
  const dualReadReady = opts.dualReadReady !== false;
  const dualCheckReady = opts.dualCheckReady !== false;
  const productionSoakReady = opts.productionSoakReady !== false;
  const roleInferenceSafe = opts.roleInferenceSafe !== undefined
    ? opts.roleInferenceSafe
    : catalog.roleOk;

  const observerErrors = opts.observerErrors !== undefined
    ? opts.observerErrors
    : soak.observerErrors;
  const dualCheckErrors = opts.dualCheckErrors !== undefined
    ? opts.dualCheckErrors
    : soak.dualCheckErrors;
  const criticalMismatchCount = opts.criticalMismatchCount !== undefined
    ? opts.criticalMismatchCount
    : soak.criticalMismatchCount;
  const privilegeWidening = opts.privilegeWidening !== undefined
    ? opts.privilegeWidening
    : soak.privilegeWidening;
  const runtimeCoverage = opts.runtimeCoverage || soak.runtimeCoverage;
  const productionSoakEvidence = opts.productionSoakEvidence || soak.productionSoakEvidence;
  const evidenceEnvironment = opts.evidenceEnvironment || soak.environment;

  const financeSafety = opts.financeSafety || soak.financeSafety;
  const hrSafety = opts.hrSafety || soak.hrSafety;
  const teacherSafety = opts.teacherSafety || soak.teacherSafety;
  const studentTrainingSafety = opts.studentTrainingSafety || soak.studentTrainingSafety;
  const legacyPrincipalSafety = opts.legacyPrincipalSafety || soak.legacyPrincipalSafety;

  // When opts override domains without production evidence, still force NOT_EVALUATED
  // unless caller explicitly evaluates a production-like soak artifact path.
  const domainEvidence = evaluateDomainSafetyEvidence({
    productionLike: isProductionLikeEnvironment(evidenceEnvironment)
      && productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
    productionRuntimeExecuted: soak.productionRuntimeExecuted
      || (opts.soakArtifact && opts.soakArtifact.productionRuntimeExecuted),
    runtimeEvents: soak.runtimeEvents
      || Number(opts.soakArtifact?.runtimeHookEvents || 0),
    productionSoakEvidence,
    financeSafety,
    hrSafety,
    teacherSafety,
    studentTrainingSafety,
    legacyPrincipalSafety,
  });

  // Allow explicit overrides for unit tests of FAIL/PASS paths on production-like evidence
  const fin = opts.financeSafety ? safetyStatus(opts.financeSafety) : domainEvidence.finance;
  const hr = opts.hrSafety ? safetyStatus(opts.hrSafety) : domainEvidence.hr;
  const tea = opts.teacherSafety ? safetyStatus(opts.teacherSafety) : domainEvidence.teacher;
  const st = opts.studentTrainingSafety
    ? safetyStatus(opts.studentTrainingSafety)
    : domainEvidence.studentTraining;
  const leg = opts.legacyPrincipalSafety
    ? safetyStatus(opts.legacyPrincipalSafety)
    : domainEvidence.legacyPrincipal;

  const evidenceOk = productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE
    && isProductionLikeEnvironment(evidenceEnvironment);

  let g5;
  if (evidenceOk) g5 = GATE.PASS;
  else if (!isProductionLikeEnvironment(evidenceEnvironment)
    || productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE) {
    g5 = GATE.NOT_AVAILABLE;
  } else g5 = GATE.FAIL;

  let g12;
  if (runtimeCoverage === RUNTIME_COVERAGE.COMPLETE) g12 = GATE.PASS;
  else if (runtimeCoverage === RUNTIME_COVERAGE.NOT_AVAILABLE) g12 = GATE.NOT_AVAILABLE;
  else g12 = GATE.NOT_EVALUATED; // PARTIAL

  const g10 = aggregateDomainGate([fin, hr, tea, st, leg]);

  let g8;
  if (opts.finalDecisionInvariant === false) g8 = GATE.FAIL;
  else if (soak.finalDecisionInvariant === SAFETY.FAIL) g8 = GATE.FAIL;
  else if (soak.finalDecisionInvariant === SAFETY.NOT_EVALUATED) g8 = GATE.NOT_EVALUATED;
  else g8 = GATE.PASS;

  const hardGates = {
    G1_Catalog: gatePass(parityReady && catalog.financeOk && catalog.hrOk
      && catalog.teacherOk && catalog.studentTrainingOk && !catalog.unsupportedSilentMap),
    G2_DualRead: gatePass(dualReadReady),
    G3_DualCheck: gatePass(dualCheckReady),
    G4_ProductionSoak: gatePass(productionSoakReady),
    G5_ProductionEvidence: g5,
    G6_RuntimeErrors: gatePass(observerErrors === 0 && dualCheckErrors === 0),
    G7_CriticalMismatch: gatePass(criticalMismatchCount === 0),
    G8_DecisionInvariant: g8,
    G9_PrivilegeWidening: gatePass(!privilegeWidening),
    G10_DomainSafety: g10,
    G11_RoleSafety: gatePass(roleInferenceSafe && catalog.roleOk && leg !== SAFETY.FAIL),
    G12_Coverage: g12,
  };

  const blockers = [];
  for (const [k, v] of Object.entries(hardGates)) {
    if (v !== GATE.PASS) blockers.push(`hard_gate_${k}_${v}`);
  }
  for (const b of soak.blockers || []) {
    if (!blockers.includes(b)) blockers.push(b);
  }
  if (!roleInferenceSafe) blockers.push('unsafe_role_inference');
  if (catalog.unsupportedSilentMap) blockers.push('unsupported_legacy_silently_mapped');

  const allPass = Object.values(hardGates).every((g) => g === GATE.PASS);
  // NOT_EVALUATED / NOT_AVAILABLE / FAIL all block PRIMARY
  const blockedByEvidence = !evidenceOk
    || Object.values(hardGates).some((g) => g === GATE.NOT_AVAILABLE || g === GATE.NOT_EVALUATED);

  let decision = READINESS_DECISION.NOT_READY;
  let status = 'FINDINGS';
  if (!isProductionLikeEnvironment(evidenceEnvironment)
    || productionSoakEvidence !== PRODUCTION_SOAK_EVIDENCE.AVAILABLE) {
    decision = READINESS_DECISION.BLOCKED;
    status = 'BLOCKED';
  } else if (allPass) {
    decision = READINESS_DECISION.READY;
    status = 'PASS';
  } else {
    decision = READINESS_DECISION.NOT_READY;
    status = 'FINDINGS';
  }

  const enterprisePrimaryReady = allPass && decision === READINESS_DECISION.READY;

  return {
    phase: '8.19',
    status,
    decision,
    evidenceEnvironment: evidenceEnvironment || 'NONE',
    productionSoakEvidence: productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE
      ? PRODUCTION_SOAK_EVIDENCE.AVAILABLE
      : PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
    runtimeCoverage,
    parityReady,
    dualReadReady,
    dualCheckReady,
    productionSoakReady,
    observerErrors,
    dualCheckErrors,
    criticalMismatchCount,
    privilegeWidening: Boolean(privilegeWidening),
    financeSafety: fin,
    hrSafety: hr,
    teacherSafety: tea,
    studentTrainingSafety: st,
    roleSafety: roleInferenceSafe && catalog.roleOk ? SAFETY.PASS : SAFETY.FAIL,
    legacyPrincipalSafety: leg,
    domainSafety: {
      finance: fin,
      hr,
      teacher: tea,
      studentTraining: st,
      legacyPrincipal: leg,
      note: domainEvidence.note,
    },
    finalDecisionInvariant: g8 === GATE.FAIL ? SAFETY.FAIL
      : (g8 === GATE.NOT_EVALUATED ? SAFETY.NOT_EVALUATED : SAFETY.PASS),
    unsupportedLegacy: catalog.unsupported,
    hardGates,
    catalogContracts: {
      financeOk: catalog.financeOk,
      hrOk: catalog.hrOk,
      teacherOk: catalog.teacherOk,
      studentTrainingOk: catalog.studentTrainingOk,
      roleOk: catalog.roleOk,
    },
    blockers,
    blockedByEvidence,
    recommendation: enterprisePrimaryReady ? 'READY_FOR_CUTOVER_REVIEW' : 'NOT_READY',
    enterprisePrimaryReady,
    ENTERPRISE_PRIMARY_READY: enterprisePrimaryReady ? 'YES' : 'NO',
    safety: {
      liveRemainsPrimary: true,
      enterpriseIsShadowOnly: true,
      flagsNotAutoEnabled: true,
      authorizeNotMounted: true,
      evaluatorDoesNotMutateAuth: true,
      notEvaluatedIsNotFail: true,
      notEvaluatedStillBlocksPrimary: true,
    },
    note: (
      'NOT_EVALUATED ≠ FAIL and ≠ PASS. NOT_EVALUATED still blocks ENTERPRISE_PRIMARY_READY. '
      + 'ENTERPRISE_PRIMARY_READY=YES means cutover review eligibility only — never auto-promote.'
    ),
  };
}

function buildReadiness819Artifact(evaluation) {
  return {
    phase: '8.19',
    status: evaluation.status,
    decision: evaluation.decision,
    environment: evaluation.evidenceEnvironment,
    evidenceEnvironment: evaluation.evidenceEnvironment,
    productionEvidence: evaluation.productionSoakEvidence,
    productionSoakEvidence: evaluation.productionSoakEvidence,
    runtimeCoverage: evaluation.runtimeCoverage,
    parityReady: evaluation.parityReady,
    dualReadReady: evaluation.dualReadReady,
    dualCheckReady: evaluation.dualCheckReady,
    productionSoakReady: evaluation.productionSoakReady,
    observerErrors: evaluation.observerErrors,
    dualCheckErrors: evaluation.dualCheckErrors,
    criticalMismatchCount: evaluation.criticalMismatchCount,
    privilegeWidening: evaluation.privilegeWidening,
    financeSafety: evaluation.financeSafety,
    hrSafety: evaluation.hrSafety,
    teacherSafety: evaluation.teacherSafety,
    studentTrainingSafety: evaluation.studentTrainingSafety,
    roleSafety: evaluation.roleSafety,
    legacyPrincipalSafety: evaluation.legacyPrincipalSafety,
    domainSafety: evaluation.domainSafety,
    finalDecisionInvariant: evaluation.finalDecisionInvariant,
    unsupportedLegacy: evaluation.unsupportedLegacy,
    hardGates: evaluation.hardGates,
    blockers: evaluation.blockers,
    recommendation: evaluation.recommendation,
    enterprisePrimaryReady: evaluation.enterprisePrimaryReady,
    ENTERPRISE_PRIMARY_READY: evaluation.ENTERPRISE_PRIMARY_READY,
    safety: evaluation.safety,
    note: evaluation.note,
    generatedAt: new Date().toISOString(),
  };
}

function writeReadiness819Artifact(opts = {}) {
  const evaluation = opts.evaluation || evaluateFinalReadiness(opts);
  const artifact = buildReadiness819Artifact(evaluation);
  const artifactPath = opts.artifactPath || DEFAULT_819_ARTIFACT;
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  return { artifact, artifactPath, evaluation };
}

module.exports = {
  READINESS_DECISION,
  GATE,
  MISMATCH_SEVERITY,
  DEFAULT_818_ARTIFACT,
  DEFAULT_819_ARTIFACT,
  loadJsonSafe,
  evaluateCatalogContracts,
  evaluateDomainSafetyEvidence,
  aggregateDomainGate,
  classifyMismatchSeverity,
  normalizeSoakEvidence,
  evaluateFinalReadiness,
  buildReadiness819Artifact,
  writeReadiness819Artifact,
};
