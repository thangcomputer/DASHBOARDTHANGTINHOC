# Inbox Pattern Design
## Architecture
- **Inbox Collection**: Tracks processed incoming events `{ eventId, handlerName, processedAt }`.
- **Duplicate Detection**: Unique index on `(eventId, handlerName)`. 
- **Exactly-once Simulation**: If an event triggers a Domain Error or Unhandled Exception, it won't be written to Inbox. Handlers must be idempotent if partially executed.
- **Consumer Replay**: Safe because Inbox prevents double-processing.
