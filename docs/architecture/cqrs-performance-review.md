# CQRS Performance Review

## Metrics
- **Command Dispatch Count**: Native Node.js execution adds < 1ms overhead.
- **Query Dispatch Count**: In-memory registry lookup is O(1).
- **Event Publish Count**: Async `Promise.allSettled` prevents bottlenecks.
- **Registration Count**: All migrated domains registered dynamically at boot.