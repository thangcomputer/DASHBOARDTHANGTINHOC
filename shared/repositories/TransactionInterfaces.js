/**
 * TransactionInterfaces.js
 * Definitions for Transactional boundaries and Registry in Batch 3.
 * No concrete implementations for MongoDB sessions yet (design only).
 */

class RepositoryRegistry {
  constructor() {
    this.repositories = new Map();
  }

  register(name, repositoryInstance) {
    this.repositories.set(name, repositoryInstance);
  }

  resolve(name) {
    if (!this.repositories.has(name)) {
      throw new Error(`Repository ${name} not found in registry`);
    }
    return this.repositories.get(name);
  }
}

class RepositoryFactory {
  constructor(registry) {
    this.registry = registry;
  }

  createContext(session = null) {
    // In future: Inject session into repositories
    return new RepositoryContext(this.registry, session);
  }
}

class RepositoryContext {
  constructor(registry, session) {
    this.registry = registry;
    this.session = session;
  }

  get(name) {
    // In future: return new repository instance wrapped with session
    return this.registry.resolve(name);
  }
}

class TransactionManager {
  constructor(repositoryFactory) {
    this.repositoryFactory = repositoryFactory;
  }

  async beginTransaction() {
    // No Mongo session yet
    throw new Error('Not implemented');
  }
}

class UnitOfWork {
  constructor(transactionManager) {
    this.transactionManager = transactionManager;
    this.context = null;
  }

  async begin() {
    // this.session = await this.transactionManager.beginTransaction();
    // this.context = this.transactionManager.repositoryFactory.createContext(this.session);
  }

  async commit() {
    // await this.session.commitTransaction();
  }

  async rollback() {
    // await this.session.abortTransaction();
  }

  async execute(workFn) {
    // Wrap workFn in try/catch and rollback/commit
  }

  dispose() {
    // this.session.endSession();
  }
}

module.exports = {
  RepositoryRegistry,
  RepositoryFactory,
  RepositoryContext,
  TransactionManager,
  UnitOfWork
};
