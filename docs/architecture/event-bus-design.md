# Event Bus Foundation Blueprint

## Core Interfaces (Conceptual, No Implementation)

```typescript
interface DomainEvent {
  eventId: string;
  timestamp: Date;
  aggregateId: string;
  eventName: string;
  payload: any;
  metadata: EventMetadata;
}

interface EventMetadata {
  correlationId: string;
  causationId?: string;
  actorId?: string;
}

interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

interface EventRegistry {
  register<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void;
}

interface EventDispatcher {
  dispatch(event: DomainEvent): Promise<void>;
}
```
