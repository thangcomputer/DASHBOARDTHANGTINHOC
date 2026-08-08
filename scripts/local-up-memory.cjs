#!/usr/bin/env node
'use strict';

/**
 * Local stack without Docker:
 *   1) Start in-memory Mongo replica set
 *   2) Spawn API (server.js) with that URI
 *   3) Optional: RUN_WORKER=1 also starts worker.js
 *
 * Usage: node scripts/local-up-memory.cjs
 * Stop:  Ctrl+C
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return;
  const jwt = crypto.randomBytes(48).toString('hex');
  const refresh = crypto.randomBytes(48).toString('hex');
  const body = [
    'NODE_ENV=development',
    'PORT=5000',
    `JWT_SECRET=${jwt}`,
    `JWT_REFRESH_SECRET=${refresh}`,
    'CLIENT_URL=http://localhost:5173',
    'BACKUP_SCHEDULE=0',
    'RUN_OUTBOX_WORKER=1',
    '',
  ].join('\n');
  fs.writeFileSync(ENV_PATH, body, 'utf8');
  console.log('[local-up] created .env with random JWT secrets');
}

async function main() {
  ensureEnvFile();

  // Load .env into process (server also loads via dotenv)
  require('dotenv').config({ path: ENV_PATH });

  console.log('[local-up] starting memory Mongo replica set...');
  const { startMemoryReplicaSet, stopMemoryReplicaSet } = require('../tests/helpers/memoryReplica');
  const uri = await startMemoryReplicaSet();
  const uriFile = path.join('/tmp', 'cqrs-local-mongo-uri.txt');
  fs.writeFileSync(uriFile, uri, 'utf8');
  console.log('[local-up] Mongo ready — URI written to', uriFile);
  console.log('[local-up] API http://127.0.0.1:' + (process.env.PORT || '5000'));

  const kids = [];
  const env = {
    ...process.env,
    MONGODB_URI: uri,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || '5000',
    BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE || '0',
    RUN_OUTBOX_WORKER: process.env.RUN_OUTBOX_WORKER || '1',
    RUN_QUEUE_WORKERS: process.env.RUN_QUEUE_WORKERS || '0',
  };

  function spawnChild(name, script) {
    const child = spawn(process.execPath, [script], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
    child.on('exit', (code, signal) => {
      console.log(`[local-up] ${name} exited code=${code} signal=${signal || ''}`);
    });
    kids.push(child);
    return child;
  }

  spawnChild('api', path.join(ROOT, 'server.js'));
  if (process.env.RUN_WORKER === '1') {
    spawnChild('worker', path.join(ROOT, 'worker.js'));
  }

  const shutdown = async () => {
    console.log('\n[local-up] shutting down...');
    for (const c of kids) {
      try { c.kill('SIGTERM'); } catch { /* ignore */ }
    }
    await stopMemoryReplicaSet().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[local-up] FAIL', err);
  process.exit(1);
});
