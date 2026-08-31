#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findTests(dir, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findTests(full, out);
    else if (/\.test\.(c?js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const root = __dirname;
const subset = process.argv[2] ? path.join(root, process.argv[2]) : root;
const files = fs.existsSync(subset) ? findTests(subset) : [];

if (!files.length) {
  console.error('No *.test.{cjs,js,mjs} files found under ' + (path.relative(process.cwd(), subset) || '.'));
  process.exit(1);
}

const isIntegration = files.some(f => f.includes('messaging-isolation.test.js') || f.includes('integration'));

function runTestsAndExit(env = process.env) {
  const result = spawnSync(process.execPath, ['--test'].concat(files), { stdio: 'inherit', env });
  process.exit(result.status == null ? 0 : result.status);
}

if (!isIntegration) {
  runTestsAndExit();
}

process.env.NODE_ENV = 'test';
const { assertTestDatabaseEnvironment } = require('./setup/testDatabaseGuard');
assertTestDatabaseEnvironment(process.env);
bootServer();

function bootServer() {
  const http = require('http');
  const testPort = Number(process.env.TEST_PORT || 5096);
  const childEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(testPort),
    CLIENT_URL: `http://127.0.0.1:${testPort}`,
    JWT_SECRET: process.env.JWT_SECRET || 'tests-runner-jwt-secret-only',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'tests-runner-refresh-secret-only',
    BACKUP_SCHEDULE: '0',
    RUN_OUTBOX_WORKER: '0',
    TEST_API_BASE_URL: `http://127.0.0.1:${testPort}`,
  };
  console.log(`Starting isolated test server on port ${testPort}...`);
  const server = require('child_process').spawn(process.execPath, ['server.js'], {
    stdio: 'ignore',
    env: childEnv,
  });
  let attempts = 0;
  
  const checkHealth = () => {
    http.get(`http://127.0.0.1:${testPort}/healthz`, (res) => {
      if (res.statusCode === 200) {
        console.log('Server is ready. Running tests...');
        const result = spawnSync(process.execPath, ['--test'].concat(files), {
          stdio: 'inherit',
          env: childEnv,
        });
        server.kill('SIGTERM');
        process.exit(result.status == null ? 0 : result.status);
      } else {
        retry();
      }
    }).on('error', retry);
  };

  const retry = () => {
    attempts++;
    if (attempts > 30) {
      console.error('Server failed to start in time.');
      server.kill('SIGTERM');
      process.exit(1);
    }
    setTimeout(checkHealth, 500);
  };

  checkHealth();
}