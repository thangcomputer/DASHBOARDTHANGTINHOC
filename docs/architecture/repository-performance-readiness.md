# Repository Performance Readiness

## 1. Overview
In preparation for future performance monitoring and caching layers, Sprint 4.2 Batch 3 introduced passive performance telemetry directly into the Data Access Layer via `BaseRepository`.

## 2. Lifecycle Hooks Added
The `BaseRepository` now executes the following hooks on every query and aggregation:
- `beforeQuery(operation, filter, options)`
- `afterQuery(operation, result, durationMs)`
- `beforeAggregate(pipeline, options)`
- `afterAggregate(pipeline, result, durationMs)`

## 3. Metrics Tracking
Internally, the `BaseRepository` instance records:
- `queryCount`: Number of standard queries executed.
- `aggregateCount`: Number of aggregations executed.
- `slowQueryCount`: Number of queries exceeding a 200ms threshold.
- `averageDuration`: Derived metric of total execution time / total calls.
- `minimumDuration`: The fastest recorded query time.
- `maximumDuration`: The slowest recorded query time.

## 4. Current State & Limitations
These metrics are purely passive and reside in memory on the repository instances. No external APM or Prometheus integration has been configured. The hooks are intentionally designed to allow subclasses (like a future `RedisCachedRepository`) to override `beforeQuery` to serve cached results, or intercept `afterQuery` to populate the cache.
