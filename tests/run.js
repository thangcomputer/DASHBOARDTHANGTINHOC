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
  console.log('No *.test.{cjs,js,mjs} files found under ' + (path.relative(process.cwd(), subset) || '.'));
  process.exit(0);
}

const isIntegration = files.some(f => f.includes('messaging-isolation.test.js') || f.includes('integration'));

function runTestsAndExit() {
  const result = spawnSync(process.execPath, ['--test'].concat(files), { stdio: 'inherit' });
  process.exit(result.status == null ? 0 : result.status);
}

if (!isIntegration) {
  runTestsAndExit();
}

const http = require('http');

// Check if server is already running
const req = http.get('http://localhost:5000/healthz', (res) => {
  if (res.statusCode === 200) {
    console.log('Server is already running. Running tests...');
    runTestsAndExit();
  } else {
    bootServer();
  }
}).on('error', () => {
  bootServer();
});

function bootServer() {
  console.log('Starting test server...');
  const server = require('child_process').spawn('node', ['server.js'], { stdio: 'ignore', detached: true });
  let attempts = 0;
  
  const checkHealth = () => {
    http.get('http://localhost:5000/healthz', (res) => {
      if (res.statusCode === 200) {
        console.log('Server is ready. Running tests...');
        const result = spawnSync(process.execPath, ['--test'].concat(files), { stdio: 'inherit' });
        server.kill('SIGTERM');
        try { process.kill(server.pid, 'SIGKILL'); } catch (e) {}
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
      try { process.kill(server.pid, 'SIGKILL'); } catch (e) {}
      process.exit(1);
    }
    setTimeout(checkHealth, 500);
  };

  checkHealth();
}