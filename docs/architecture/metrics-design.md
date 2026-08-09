# Metrics Design
## Core Metrics
- **HTTP**: Request rate, latency, error count.
- **CQRS**: `CommandBus`/`QueryBus` dispatch rates and average handler latency.
- **Repository**: MongoDB query times and throughput.
- **Dependencies**: Redis operations, BullMQ queue depths, Socket.io concurrent connections.
- **System**: V8 memory heap, CPU usage, Event Loop lag.
