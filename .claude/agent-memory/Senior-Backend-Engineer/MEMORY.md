# Senior Backend Engineer - Agent Memory

## Project: ActivaClub

### Repository Root
`C:/Users/Martin/Desktop/Tesis`

### Key Paths
- Backend root: `C:/Users/Martin/Desktop/Tesis/backend/`
- Shared libs: `C:/Users/Martin/Desktop/Tesis/backend/libs/`
- Services: `C:/Users/Martin/Desktop/Tesis/backend/services/`
- Root NestJS src: `C:/Users/Martin/Desktop/Tesis/backend/src/`

### Architecture Decision: Monorepo with Separate Lambdas
- One `nest-cli.json` at `backend/` root registers all 7 services as NestJS monorepo projects.
- Each service in `services/<name>/` is an independent Lambda with its own `package.json` and `tsconfig.json`.
- Root `backend/package.json` holds shared devDependencies and Jest config.
- Shared code lives in `libs/` (auth, dto, dynamodb, errors, logging, utils).

### Lambda Handler Pattern
```typescript
// src/lambda.ts
let cachedHandler: Handler; // cached across warm invocations
export const handler: Handler = async (event, context, callback) => {
  if (!cachedHandler) cachedHandler = await bootstrapLambda();
  context.callbackWaitsForEmptyEventLoop = false;
  return cachedHandler(event, context, callback);
};
```
Handler path convention: `dist/src/lambda.handler`

### Shared src/ Structure (backend root)
- `src/shared/filters/` — GlobalExceptionFilter
- `src/shared/guards/` — JwtAuthGuard, RolesGuard
- `src/shared/interceptors/` — LoggingInterceptor, TransformInterceptor
- `src/shared/decorators/` — @Roles, @CurrentUser, @Public

### Cognito Groups = UserRole
`'Admin' | 'Manager' | 'Member'` — read from JWT claim `cognito:groups`.

### Error Response Shape (GlobalExceptionFilter)
```json
{ "statusCode": 400, "message": "...", "error": "Bad Request",
  "timestamp": "ISO", "path": "/v1/..." }
```

### Success Response Envelope (TransformInterceptor)
```json
{ "data": <payload>, "timestamp": "ISO" }
```

### Global Route Prefix
All routes are prefixed with `v1` (`app.setGlobalPrefix('v1')`).

### Swagger
Available locally at `/api/docs`. Auth scheme: `cognito-jwt` (Bearer JWT).

### Path Aliases (tsconfig.json)
`@libs/auth`, `@libs/dto`, `@libs/dynamodb`, `@libs/errors`, `@libs/logging`, `@libs/utils`
each resolving to `libs/<name>/src/index.ts`.

### Jest Config
- Canonical config: `backend/jest.config.ts` (has coverage thresholds).
- The `jest` key was REMOVED from `package.json` to avoid dual-config conflict.
- Per-service tests go in `services/<name>/src/test/unit/` (discovered by roots config).
- `aws-sdk-client-mock` v4.x: use `ddbMock.commandCalls(Command)` for assertions.
  Do NOT import `aws-sdk-client-mock-jest` — it is a separate uninstalled package.
- Coverage threshold: 80% branches/functions/lines/statements (global).

### Husky Hooks (backend root)
- pre-commit: `npx lint-staged` (eslint --fix + prettier --write on *.ts)
- pre-push: `npm run test`

### libs/ Status
All libs (auth, dto, dynamodb, errors, logging, utils) have only README files — no src/.
Do NOT import @libs/* until the source is implemented.
For members service, use direct implementations in the service's infrastructure layer.

### DI Token Pattern
```typescript
export const MEMBER_REPOSITORY = Symbol('MemberRepositoryInterface');
// Module: { provide: MEMBER_REPOSITORY, useFactory: (client) => new DynamoMemberRepository(client), inject: [DYNAMODB_CLIENT] }
// Handler: @Inject(MEMBER_REPOSITORY) private readonly repo: MemberRepositoryInterface
```

### Domain Exception Pattern
Exceptions set `this.name` in constructor and have a `code` string property.
GlobalExceptionFilter maps via `DOMAIN_EXCEPTION_MAP[exception.name]` → HTTP status.
Import domain exceptions from service path (not @libs/errors — not yet implemented).

### services/ Directory Layout (confirmed from AC-001 implementation)
```
services/<name>/
  <name>.module.ts           # NestJS module at root of service dir
  src/
    application/commands/<use-case>/   # command.ts, handler.ts, result.ts
    domain/entities/ value-objects/ repositories/ exceptions/
    infrastructure/repositories/ cognito/ dynamo-client.factory.ts
    presentation/controllers/ dtos/
    test/unit/
```

### AC-001 Members Service: COMPLETE
- POST /v1/auth/register with full Clean Architecture + 24 passing unit tests
- MembersModule registered in AppModule
- GlobalExceptionFilter updated with domain exception mappings

### .env.example Key Variables (Members Service)
DYNAMODB_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_REGION,
MEMBERS_TABLE_NAME, SEED_MEMBERS_TABLE_NAME, ENV, PORT

See: `C:/Users/Martin/Desktop/Tesis/.claude/agent-memory/Senior-Backend-Engineer/patterns.md`
