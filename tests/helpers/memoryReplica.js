'use strict';

/**
 * Start an in-memory Mongo replica set for CQRS TX integration tests.
 * Downloads binary on first use (cached by mongodb-memory-server).
 */
let mongod;
let uri;

async function startMemoryReplicaSet() {
  if (uri) return uri;
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  return uri;
}

async function stopMemoryReplicaSet() {
  if (mongod) {
    await mongod.stop();
    mongod = null;
    uri = null;
  }
}

module.exports = { startMemoryReplicaSet, stopMemoryReplicaSet };
