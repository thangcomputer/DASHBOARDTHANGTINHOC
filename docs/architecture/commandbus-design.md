# CommandBus Blueprint

## Core Interfaces (Conceptual, No Implementation)

```typescript
interface Command {
  commandId: string;
  metadata: any;
}

interface CommandHandler<T extends Command, R> {
  execute(command: T): Promise<R>;
}

interface CommandBus {
  execute<T extends Command, R>(command: T): Promise<R>;
}

interface HandlerRegistry {
  register(commandName: string, handler: CommandHandler<any, any>): void;
  get(commandName: string): CommandHandler<any, any>;
}
```
