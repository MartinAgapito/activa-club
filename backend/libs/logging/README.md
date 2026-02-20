# Lib: logging

Structured logging utility for ActivaClub Lambda functions.

## Design

Wraps AWS Lambda PowerTools for TypeScript (`@aws-lambda-powertools/logger`) to provide:
- Consistent JSON log format across all services
- Automatic injection of `service`, `env`, `requestId`, and `userId` fields
- Log level configuration via `LOG_LEVEL` environment variable

## Usage

```typescript
import { createLogger } from '@activa-club/logging';

const logger = createLogger('members-service');
logger.info('Member created', { memberId: '123' });
logger.error('DynamoDB error', { error });
```

## Log Levels

`DEBUG | INFO | WARN | ERROR` — default is `INFO` in dev and `WARN` in production.
