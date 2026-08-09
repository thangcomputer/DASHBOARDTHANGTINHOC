# EventBus Infrastructure Review

## Overview
The `EventBus` in `shared/events/` establishes a native in-memory Pub/Sub system for Domain Events, enabling asynchronous side-effects (e.g., sending emails after user creation).

## Features
- **Publish/Subscribe Mechanics**: Native `subscribe`, `unsubscribe`, and `publish` methods.
- **Dispatcher Logic**: Uses `Promise.allSettled` internally so that one failing subscriber does not crash other subscribers or the main transaction.
- **Event Structure**: Enforces the `DomainEvent` base class with auto-generated `eventId` and `timestamp`.
- **In-Process Scope**: As per constraints, this relies entirely on Node's native event loop, avoiding Kafka/RabbitMQ overhead until distributed scale is required.
