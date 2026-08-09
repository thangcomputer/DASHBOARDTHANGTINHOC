/**
 * BaseRepository.js
 * Common CRUD operations to reduce duplication across domains.
 * Supports optional Mongoose Session for future Transaction Readiness.
 * Implements Batch 3 Performance Lifecycle Hooks and Metrics.
 */
const RetryExecutor = require('../retry/RetryExecutor');
const RetryPolicy = require('../retry/RetryPolicy');
const BackoffStrategy = require('../retry/BackoffStrategy');
const retryExecutor = new RetryExecutor(new RetryPolicy(3, BackoffStrategy.exponential));
const cacheManager = require('../cache/CacheManager');
class BaseRepository {
  constructor(model) {
    this.model = model;
    
    // Performance Metrics
    this.metrics = {
      queryCount: 0,
      aggregateCount: 0,
      slowQueryCount: 0,
      totalDuration: 0,
      minimumDuration: Number.MAX_SAFE_INTEGER,
      maximumDuration: 0,
    };
  }
  
  get averageDuration() {
    const totalCalls = this.metrics.queryCount + this.metrics.aggregateCount;
    if (totalCalls === 0) return 0;
    return this.metrics.totalDuration / totalCalls;
  }

  // Lifecycle Hooks
  beforeQuery(operation, filter, options) {
    // Override in subclasses if needed
  }

  afterQuery(operation, result, durationMs) {
    this.metrics.queryCount++;
    this._recordDuration(durationMs);
  }

  beforeAggregate(pipeline, options) {
    // Override in subclasses if needed
  }

  afterAggregate(pipeline, result, durationMs) {
    this.metrics.aggregateCount++;
    this._recordDuration(durationMs);
  }

  _recordDuration(durationMs) {
    this.metrics.totalDuration += durationMs;
    if (durationMs < this.metrics.minimumDuration) this.metrics.minimumDuration = durationMs;
    if (durationMs > this.metrics.maximumDuration) this.metrics.maximumDuration = durationMs;
    if (durationMs > 200) this.metrics.slowQueryCount++; // Threshold for slow query
  }

  async _executeWithHooks(operation, filter, options, executor) {
    if (options.cacheKey) {
      const cached = await cacheManager.get(options.cacheKey).catch(() => null);
      if (cached) return cached;
    }
    this.beforeQuery(operation, filter, options);
    const start = process.hrtime.bigint();
    const result = await executor();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    this.afterQuery(operation, result, durationMs);
    if (options.cacheKey) {
      cacheManager.set(options.cacheKey, result, options.cacheTTL).catch(() => null);
    }
    return result;
  }

  async _executeAggregateWithHooks(pipeline, options, executor) {
    if (options.cacheKey) {
      const cached = await cacheManager.get(options.cacheKey).catch(() => null);
      if (cached) return cached;
    }
    this.beforeAggregate(pipeline, options);
    const start = process.hrtime.bigint();
    const result = await executor();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    this.afterAggregate(pipeline, result, durationMs);
    if (options.cacheKey) {
      cacheManager.set(options.cacheKey, result, options.cacheTTL).catch(() => null);
    }
    return result;
  }

  async _withRetry(fn) {
    return retryExecutor.execute(async () => {
      try { return await fn(); } catch (err) {
        if (err.name === 'ValidationError' || err.name === 'AuthorizationException' || err.name === 'BusinessRuleException') throw err;
        throw err;
      }
    });
  }
  async findById(id, options = {}) {
    return this._executeWithHooks('findById', { _id: id }, options, () => {
      let query = this.model.findById(id);
      if (options.session) query = query.session(options.session);
      if (options.select) query = query.select(options.select);
      if (options.populate) query = query.populate(options.populate);
      return options.lean ? query.lean() : query;
    });
  }

  async findOne(filter, options = {}) {
    return this._executeWithHooks('findOne', filter, options, () => {
      let query = this.model.findOne(filter);
      if (options.session) query = query.session(options.session);
      if (options.select) query = query.select(options.select);
      if (options.populate) query = query.populate(options.populate);
      if (options.sort) query = query.sort(options.sort);
      return options.lean ? query.lean() : query;
    });
  }

  async findMany(filter = {}, options = {}) {
    return this._executeWithHooks('findMany', filter, options, () => {
      let query = this.model.find(filter);
      if (options.session) query = query.session(options.session);
      if (options.select) query = query.select(options.select);
      if (options.populate) query = query.populate(options.populate);
      if (options.sort) query = query.sort(options.sort);
      if (options.limit) query = query.limit(options.limit);
      if (options.skip) query = query.skip(options.skip);
      return options.lean ? query.lean() : query;
    });
  }

  async findPaginated(filter = {}, page = 1, limit = 20, options = {}) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.findMany(filter, { ...options, skip, limit }),
      this.count(filter, options)
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async count(filter = {}, options = {}) {
    return this._executeWithHooks('count', filter, options, () => {
      let query = this.model.countDocuments(filter);
      if (options.session) query = query.session(options.session);
      return query;
    });
  }

  async exists(filter = {}, options = {}) {
    return this._executeWithHooks('exists', filter, options, () => {
      let query = this.model.exists(filter);
      if (options.session) query = query.session(options.session);
      return query;
    });
  }

  async create(data, options = {}) {
    return this._executeWithHooks('create', null, options, async () => {
      if (Array.isArray(data)) {
        return this.model.insertMany(data, { session: options.session });
      }
      const docs = await this.model.create([data], { session: options.session });
      return docs[0];
    });
  }
  
  createInstance(data) {
    return new this.model(data);
  }

  async save(doc, options = {}) {
    return this._executeWithHooks('save', null, options, () => {
      return doc.save(options);
    });
  }

  async updateById(id, updateData, options = {}) {
    return this._executeWithHooks('updateById', { _id: id }, options, () => {
      const defaultOptions = { new: true, runValidators: true };
      return this.model.findByIdAndUpdate(id, updateData, { ...defaultOptions, ...options });
    });
  }

  async updateOne(filter, updateData, options = {}) {
    return this._executeWithHooks('updateOne', filter, options, () => {
      return this.model.findOneAndUpdate(filter, updateData, { new: true, runValidators: true, ...options });
    });
  }

  async updateMany(filter, updateData, options = {}) {
    return this._executeWithHooks('updateMany', filter, options, () => {
      return this.model.updateMany(filter, updateData, options);
    });
  }

  async deleteById(id, options = {}) {
    return this._executeWithHooks('deleteById', { _id: id }, options, () => {
      return this.model.findByIdAndDelete(id, options);
    });
  }

  async deleteOne(filter, options = {}) {
    return this._executeWithHooks('deleteOne', filter, options, () => {
      return this.model.findOneAndDelete(filter, options);
    });
  }

  async deleteMany(filter, options = {}) {
    return this._executeWithHooks('deleteMany', filter, options, () => {
      return this.model.deleteMany(filter, options);
    });
  }

  async aggregate(pipeline, options = {}) {
    return this._executeAggregateWithHooks(pipeline, options, () => {
      let query = this.model.aggregate(pipeline);
      if (options.session) query = query.session(options.session);
      return query;
    });
  }
}

module.exports = BaseRepository;
