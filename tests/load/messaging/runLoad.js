'use strict';

/**
 * Phase 10 — realistic messaging load runner.
 * Usage: node tests/load/messaging/runLoad.js
 * Optional: PHASE10_TIERS=100,250,500,1000 PHASE10_PORT=5020
 */
const fs = require('fs');
const path = require('path');
const {
  PORT,
  DB_NAME,
  ROLE_MIX,
  sleep,
  phase10MongoUri,
  connectHarnessDb,
  seedDataset,
  mintToken,
  httpJson,
  fetchCsrf,
  waitHealth,
  fetchStats,
  startServer,
  stopServer,
  connectMany,
  pickDmPairs,
  runPrivateDmLoad,
  classifyTier,
  summarize,
  mongoose,
  Message,
} = require('./harness');

const ROOT = path.join(__dirname, '../../..');
const ARTIFACT = path.join(ROOT, 'artifacts/phase10-load-evidence.json');

function parseTiers() {
  const raw = process.env.PHASE10_TIERS || '100,250,500,1000';
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function rateForTier(n) {
  if (n <= 100) return { low: 1, medium: 5, high: 10 };
  if (n <= 250) return { low: 1, medium: 5, high: 10 };
  if (n <= 500) return { low: 1, medium: 5, high: 8 };
  return { low: 1, medium: 4, high: 6 };
}

async function pollStats(port, samples, intervalMs = 1000) {
  const out = [];
  for (let i = 0; i < samples; i += 1) {
    const s = await fetchStats(port);
    if (s) out.push(s);
    await sleep(intervalMs);
  }
  return out;
}

function reduceStats(samples) {
  if (!samples.length) {
    return {
      peakCpuPct: null,
      peakRssMb: null,
      peakHeapUsedMb: null,
      eventLoop: { p50: null, p95: null, p99: null, max: null },
      peakSockets: null,
    };
  }
  return {
    peakCpuPct: Math.max(...samples.map((s) => s.cpuPct || 0)),
    peakRssMb: Math.max(...samples.map((s) => s.memory?.rssMb || 0)),
    peakHeapUsedMb: Math.max(...samples.map((s) => s.memory?.heapUsedMb || 0)),
    eventLoop: {
      p50: Math.max(...samples.map((s) => s.eventLoopMs?.p50 || 0)),
      p95: Math.max(...samples.map((s) => s.eventLoopMs?.p95 || 0)),
      p99: Math.max(...samples.map((s) => s.eventLoopMs?.p99 || 0)),
      max: Math.max(...samples.map((s) => s.eventLoopMs?.max || 0)),
    },
    peakSockets: Math.max(...samples.map((s) => s.sockets || 0)),
  };
}

async function runContactsProbe(origin, actors) {
  const student = actors.find((a) => a.role === 'student');
  const support = actors.find((a) => a.adminRole === 'SUPPORT');
  const high = actors.find((a) => a.adminRole === 'HIGH_ADMIN');
  const results = {};
  for (const [label, actor] of [
    ['student', student],
    ['support', support],
    ['high_admin', high],
  ]) {
    if (!actor) {
      results[label] = { status: 'skipped' };
      continue;
    }
    const token = mintToken(actor);
    const t0 = Date.now();
    try {
      const r = await httpJson('GET', origin, '/api/messages/contacts', { token });
      const list = Array.isArray(r.json) ? r.json : r.json?.contacts || r.json?.data || [];
      results[label] = {
        status: r.status,
        ms: Date.now() - t0,
        bytes: r.bytes,
        count: Array.isArray(list) ? list.length : null,
      };
    } catch (err) {
      results[label] = { status: 'error', error: String(err.message || err), ms: Date.now() - t0 };
    }
  }
  return results;
}

async function runBroadcastProbe(origin, actors) {
  const staff = actors.find((a) => a.adminRole === 'STAFF');
  if (!staff) return { status: 'skipped' };
  const token = mintToken(staff);
  const csrf = await fetchCsrf(origin);
  const t0 = Date.now();
  try {
    const r = await httpJson('POST', origin, '/api/messages/broadcast', {
      token,
      cookie: csrf.cookie,
      headers: { 'X-CSRF-Token': csrf.token },
      body: {
        targetRole: 'student',
        content: `P10_BROADCAST_${Date.now()}`,
        messageType: 'text',
      },
    });
    return {
      status: r.status,
      ms: Date.now() - t0,
      count: r.json?.count ?? null,
      message: r.json?.message || null,
    };
  } catch (err) {
    return { status: 'error', error: String(err.message || err), ms: Date.now() - t0 };
  }
}

async function runMultiTabProbe(origin, actor) {
  if (!actor) return { status: 'skipped' };
  const { connectClient } = require('./harness');
  const a = await connectClient(actor, origin);
  const b = await connectClient(actor, origin);
  // latest socket preference: send from another peer if available — just verify both registered
  const result = {
    status: 'ok',
    sockets: [a.id, b.id],
    note: 'latest presence socketId wins (Phase 8/9 designed behavior); not redesigned',
  };
  a.close();
  b.close();
  return result;
}

async function runReconnectProbe(sockets, origin, pct = 0.1) {
  const n = Math.max(1, Math.floor(sockets.length * pct));
  const victims = sockets.slice(0, n);
  const actors = victims.map((s) => s.__actor);
  for (const s of victims) {
    try {
      s.close();
    } catch {
      /* ignore */
    }
  }
  await sleep(1000);
  const { connectMany } = require('./harness');
  const t0 = Date.now();
  const recon = await connectMany(actors, origin, { concurrency: 10 });
  return {
    attempted: n,
    success: recon.connected,
    failures: recon.failures.length,
    latency: recon.connection,
    durationMs: Date.now() - t0,
  };
}

function selectActorsForTier(allActors, tier) {
  const byRole = {
    student: allActors.filter((a) => a.role === 'student'),
    teacher: allActors.filter((a) => a.role === 'teacher'),
    staff: allActors.filter((a) => a.adminRole === 'STAFF'),
    support: allActors.filter((a) => a.adminRole === 'SUPPORT'),
    admin: allActors.filter((a) => a.adminRole === 'HIGH_ADMIN' || a.adminRole === 'SUPER_ADMIN'),
  };
  const counts = {
    student: Math.round(tier * ROLE_MIX.student),
    teacher: Math.round(tier * ROLE_MIX.teacher),
    staff: Math.round(tier * ROLE_MIX.staff),
    support: Math.round(tier * ROLE_MIX.support),
    admin: Math.round(tier * ROLE_MIX.admin),
  };
  // Keep support/staff available for DM + isolation
  counts.support = Math.max(Math.min(4, byRole.support.length), counts.support);
  counts.staff = Math.max(Math.min(4, byRole.staff.length), counts.staff);
  let sum = counts.teacher + counts.staff + counts.support + counts.admin;
  counts.student = Math.max(0, tier - sum);
  // clamp to available
  for (const k of Object.keys(counts)) {
    counts[k] = Math.min(counts[k], byRole[k].length);
  }
  sum = Object.values(counts).reduce((a, b) => a + b, 0);
  if (sum < tier) {
    const add = Math.min(byRole.student.length - counts.student, tier - sum);
    counts.student += Math.max(0, add);
  }
  const selected = [
    ...byRole.student.slice(0, counts.student),
    ...byRole.teacher.slice(0, counts.teacher),
    ...byRole.staff.slice(0, counts.staff),
    ...byRole.support.slice(0, counts.support),
    ...byRole.admin.slice(0, counts.admin),
  ];
  return selected.slice(0, tier);
}

async function runTier({
  tier,
  dataset,
  origin,
  port,
  previousSockets,
}) {
  const actors = selectActorsForTier(dataset.actors, tier);
  // Reuse already connected sockets for lower-index actors when ramping
  const socketsById = new Map();
  const kept = [];
  for (const s of previousSockets || []) {
    if (s.connected && s.__actor && actors.some((a) => a.id === s.__actor.id)) {
      socketsById.set(s.__actor.id, s);
      kept.push(s);
    } else {
      try {
        s.close();
      } catch {
        /* ignore */
      }
    }
  }

  const need = actors.filter((a) => !socketsById.has(a.id));
  const connectResult = await connectMany(need, origin, {
    concurrency: tier >= 500 ? 15 : 25,
  });
  for (const s of connectResult.sockets) {
    socketsById.set(s.__actor.id, s);
  }
  const allSockets = [...socketsById.values()];

  const connSuccessRate = allSockets.length / actors.length;
  const statsDuringConnect = reduceStats(await pollStats(port, 3, 500));

  if (connSuccessRate < 0.9) {
    return {
      tier,
      classification: 'FAIL',
      stoppedReason: 'connection_failure',
      connection: {
        attempted: actors.length,
        connected: allSockets.length,
        failures: connectResult.failures.slice(0, 20),
        latency: connectResult.connection,
        successRate: connSuccessRate,
      },
      resources: statsDuringConnect,
      sockets: allSockets,
    };
  }

  const pairs = pickDmPairs(actors, socketsById);
  if (pairs.length < 5) {
    return {
      tier,
      classification: 'FAIL',
      stoppedReason: 'insufficient_dm_pairs',
      pairs: pairs.length,
      sockets: allSockets,
    };
  }

  const rates = rateForTier(tier);
  // Use MEDIUM as primary measured rate; brief LOW warmup
  await runPrivateDmLoad({
    pairs: pairs.slice(0, Math.max(5, Math.floor(pairs.length * 0.15))),
    socketsById,
    ratePerSec: rates.low,
    durationSec: 5,
    marker: `P10WARM_${tier}`,
  });

  // Clear inboxes before measured run
  for (const s of allSockets) s.__inbox = [];

  const activePairs = pairs.slice(0, Math.max(10, Math.floor(pairs.length * 0.15)));
  const statsPoller = [];
  const poller = (async () => {
    for (let i = 0; i < 20; i += 1) {
      const s = await fetchStats(port);
      if (s) statsPoller.push(s);
      if (s && ((s.cpuPct || 0) > 92 || (s.memory?.rssMb || 0) > 1800 || (s.eventLoopMs?.p99 || 0) > 500)) {
        return 'unsafe_abort';
      }
      await sleep(1000);
    }
    return null;
  })();

  const dm = await runPrivateDmLoad({
    pairs: activePairs,
    socketsById,
    ratePerSec: rates.medium,
    durationSec: tier >= 500 ? 25 : 20,
    marker: `P10DM_${tier}`,
  });

  const abort = await poller;
  const resources = reduceStats(statsPoller);

  let reconnect = null;
  if (tier >= 500 && !abort) {
    reconnect = await runReconnectProbe(allSockets, origin, 0.1);
    // refresh map with reconnected
  }

  const messageSuccessRate = dm.messagesAttempted
    ? dm.sendOk / dm.messagesAttempted
    : 0;
  const deliverySuccessRate = dm.sendOk ? dm.deliveryOk / dm.sendOk : 0;

  const classification = abort
    ? 'FAIL'
    : classifyTier({
        connectionSuccessRate: connSuccessRate,
        messageSuccessRate,
        deliverySuccessRate,
        wrongRecipient: dm.wrongRecipient,
        crossTenant: dm.crossTenant,
        p95DeliveryMs: dm.deliveryLatency.p95,
        peakCpuPct: resources.peakCpuPct,
        peakRssMb: resources.peakRssMb,
        eventLoopP99Ms: resources.eventLoop.p99,
        stoppedReason: abort,
      });

  // Soft degrade if HIGH rate would be unsafe — optional short HIGH probe only when PASS so far
  let highProbe = null;
  if (classification === 'PASS' && tier <= 500) {
    for (const s of allSockets) s.__inbox = [];
    highProbe = await runPrivateDmLoad({
      pairs: activePairs,
      socketsById,
      ratePerSec: rates.high,
      durationSec: 10,
      marker: `P10HIGH_${tier}`,
    });
  }

  return {
    tier,
    classification,
    stoppedReason: abort || null,
    roleMix: ROLE_MIX,
    connection: {
      attempted: actors.length,
      connected: allSockets.length,
      newConnections: connectResult.connected,
      failures: connectResult.failures.slice(0, 15),
      latency: connectResult.connection,
      successRate: Math.round(connSuccessRate * 10000) / 10000,
    },
    dm: {
      pairsAvailable: pairs.length,
      pairsActive: activePairs.length,
      ratePerSec: rates.medium,
      ...dm,
      messageSuccessRate,
      deliverySuccessRate,
    },
    highProbe,
    reconnect,
    resources,
    sockets: allSockets,
  };
}

async function main() {
  const tiers = parseTiers();
  const maxTier = Math.max(...tiers);
  const evidence = {
    startedAt: new Date().toISOString(),
    node: process.version,
    port: PORT,
    dbName: DB_NAME,
    mongoUriHost: (() => {
      try {
        return new URL(phase10MongoUri().replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://')).host;
      } catch {
        return 'unknown';
      }
    })(),
    redis: process.env.PHASE10_USE_REDIS === '1' && process.env.REDIS_URL ? 'enabled' : 'NOT USED',
    topology: 'single-node',
    tiers: {},
    contacts: null,
    broadcast: null,
    multiTab: null,
    env: {
      hasJwt: Boolean(process.env.JWT_SECRET),
      isolatedDb: true,
    },
  };

  console.log(`[P10] Isolated DB=${DB_NAME} port=${PORT} tiers=${tiers.join(',')}`);
  const mongoUri = phase10MongoUri();
  await connectHarnessDb();
  console.log('[P10] Seeding dataset…');
  const dataset = await seedDataset(maxTier);
  evidence.dataset = {
    totalUsers: dataset.totalUsers,
    counts: dataset.counts,
    tenants: dataset.tenants,
    branches: dataset.branches,
  };
  console.log('[P10] Seeded', dataset.counts);

  const child = startServer(PORT, mongoUri);
  const healthy = await waitHealth(PORT, 120000);
  if (!healthy) {
    const tail = (child.__logs || []).slice(-30).join('');
    await stopServer(child);
    throw new Error(`Server failed healthz on :${PORT}\n${tail}`);
  }
  console.log('[P10] Server healthy');

  const origin = `http://127.0.0.1:${PORT}`;
  let previousSockets = [];
  let stopFurther = false;

  try {
    evidence.contacts = await runContactsProbe(origin, dataset.actors);
    console.log('[P10] Contacts probe', evidence.contacts);

    // Broadcast AFTER some connections for emission cost — run mid-suite after 100
    evidence.multiTab = await runMultiTabProbe(
      origin,
      dataset.actors.find((a) => a.adminRole === 'SUPPORT'),
    );

    for (const tier of tiers) {
      if (stopFurther) {
        evidence.tiers[String(tier)] = { classification: 'NOT TESTED', reason: 'prior_abort' };
        continue;
      }
      console.log(`[P10] === Tier ${tier} ===`);
      const result = await runTier({
        tier,
        dataset,
        origin,
        port: PORT,
        previousSockets,
      });
      previousSockets = result.sockets || [];
      const { sockets, ...serializable } = result;
      evidence.tiers[String(tier)] = serializable;
      console.log(
        `[P10] Tier ${tier}: ${result.classification} conn=${result.connection?.connected}/${result.connection?.attempted} ` +
          `dm sendOk=${result.dm?.sendOk} deliveryOk=${result.dm?.deliveryOk} wrong=${result.dm?.wrongRecipient} ` +
          `p95=${result.dm?.deliveryLatency?.p95} cpu=${result.resources?.peakCpuPct} rss=${result.resources?.peakRssMb}`,
      );

      if (tier === 100) {
        evidence.broadcast = await runBroadcastProbe(origin, dataset.actors);
        console.log('[P10] Broadcast probe', evidence.broadcast);
      }

      if (result.classification === 'FAIL' || result.dm?.wrongRecipient > 0 || result.dm?.crossTenant > 0) {
        stopFurther = true;
        if (result.dm?.wrongRecipient > 0 || result.dm?.crossTenant > 0) {
          evidence.securityStop = {
            wrongRecipient: result.dm.wrongRecipient,
            crossTenant: result.dm.crossTenant,
            tier,
          };
          console.error('[P10] SECURITY STOP — isolation failure under load');
        }
      }
    }

    // Close sockets
    for (const s of previousSockets) {
      try {
        s.close();
      } catch {
        /* ignore */
      }
    }

    evidence.finishedAt = new Date().toISOString();
    evidence.summary = buildSummary(evidence);
  } finally {
    await stopServer(child);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  fs.writeFileSync(ARTIFACT, JSON.stringify(evidence, null, 2));
  console.log('[P10] Evidence written', ARTIFACT);
  console.log(JSON.stringify(evidence.summary, null, 2));
  return evidence;
}

function buildSummary(evidence) {
  const order = ['100', '250', '500', '1000'];
  const classifications = {};
  for (const t of order) {
    classifications[t] = evidence.tiers[t]?.classification || 'NOT TESTED';
  }
  const measured = order
    .map((t) => evidence.tiers[t])
    .filter((t) => t && t.classification && t.classification !== 'NOT TESTED');
  const withDm = measured.filter((t) => t.dm);
  const last = withDm[withDm.length - 1];
  const wrong = withDm.reduce((a, t) => a + (t.dm?.wrongRecipient || 0), 0);
  const cross = withDm.reduce((a, t) => a + (t.dm?.crossTenant || 0), 0);
  const dup = withDm.reduce((a, t) => a + (t.dm?.duplicatePersist || 0), 0);
  const loss = withDm.reduce((a, t) => a + (t.dm?.deliveryFail || 0), 0);

  const peakCpu = Math.max(0, ...measured.map((t) => t.resources?.peakCpuPct || 0));
  const peakRam = Math.max(0, ...measured.map((t) => t.resources?.peakRssMb || 0));
  const peakEl = Math.max(0, ...measured.map((t) => t.resources?.eventLoop?.p99 || 0));

  let verdict1000 = 'NOT PROVEN';
  if (classifications['1000'] === 'PASS') verdict1000 = 'PROVEN';
  else if (classifications['1000'] === 'DEGRADED') verdict1000 = 'NOT PROVEN';
  else if (classifications['1000'] === 'FAIL') verdict1000 = 'NOT READY';
  else verdict1000 = 'NOT PROVEN';

  return {
    classifications,
    privateDmCorrectness: wrong === 0 && cross === 0 ? 'PASS' : 'FAIL',
    wrongRecipient: wrong,
    crossTenant: cross,
    duplicatePersist: dup,
    deliveryFail: loss,
    p95: last?.dm?.deliveryLatency?.p95 ?? null,
    p99: last?.dm?.deliveryLatency?.p99 ?? null,
    peakCpu: peakCpu || null,
    peakRam: peakRam || null,
    peakEventLoopP99: peakEl || null,
    redis: evidence.redis,
    thousandUserVerdict: verdict1000,
    contacts: evidence.contacts,
    broadcast: evidence.broadcast,
  };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[P10] FATAL', err);
    process.exit(1);
  });
}

module.exports = { main };