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

### Test Structure
- Root-level tests: `backend/test/unit/`
- Per-service tests: `backend/services/<name>/src/test/unit/` (or `test/unit/`)
- Coverage threshold: 80% branches/functions/lines/statements on application layer.
- Use `aws-sdk-client-mock` for DynamoDB mocking in repository tests.

### Husky Hooks (backend root)
- pre-commit: `npx lint-staged` (eslint --fix + prettier --write on *.ts)
- pre-push: `npm run test`

### services/ Directory Layout (per service README)
```
src/
  application/commands/ & queries/   # Use cases
  domain/entities/ & value-objects/ & repositories/
  infrastructure/repositories/ & handlers/
  presentation/controllers/ & dtos/
```
Note: The existing project uses `presentation/` not `infrastructure/controllers/`.
Align with existing structure when implementing service features.

### .env.example Key Variables
DYNAMODB_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_REGION,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SNS_PROMOTIONS_TOPIC_ARN, ENV, PORT

See: `C:/Users/Martin/Desktop/Tesis/backend/patterns.md` for per-service setup patterns.
