# Backend - ActivaClub

NestJS serverless backend.
Each sub-directory under `services/` is an independent Lambda function deployed via Terraform.

## Architecture: Clean Architecture per Module

Every service follows the same internal layering:

```
<service>/
├── src/
│   ├── application/        # Use cases (commands, queries, handlers)
│   │   ├── commands/
│   │   └── queries/
│   ├── domain/             # Entities, value objects, domain events, repository interfaces
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── repositories/   # Interfaces only
│   ├── infrastructure/     # DynamoDB adapters, external clients, Lambda handler entry point
│   │   ├── repositories/   # Concrete DynamoDB implementations
│   │   └── handlers/       # Lambda handler (main.ts wrapping NestJS app)
│   └── presentation/       # NestJS controllers + DTOs
│       ├── controllers/
│       └── dtos/
├── test/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md
```

## Services

| Service        | Lambda name (dev)                | Domain                                 |
|----------------|----------------------------------|----------------------------------------|
| members        | activa-club-members-dev          | Member onboarding, DNI match, profile  |
| reservations   | activa-club-reservations-dev     | Area booking, slots, capacity          |
| payments       | activa-club-payments-dev         | Stripe checkout, webhooks, billing     |
| promotions     | activa-club-promotions-dev       | Promotion CRUD, SNS broadcast          |
| guests         | activa-club-guests-dev           | Guest registration, access codes       |
| areas          | activa-club-areas-dev            | Areas catalog and schedule config      |
| admin          | activa-club-admin-dev            | Admin queries, analytics, user mgmt    |

## Shared Libraries (`libs/`)

| Library    | Purpose                                              |
|------------|------------------------------------------------------|
| auth       | Cognito JWT validation, RBAC guards, decorators      |
| dto        | Shared request/response DTOs and Zod schemas         |
| logging    | Structured logging (AWS Lambda PowerTools pattern)   |
| utils      | Date helpers, pagination, response builders          |
| dynamodb   | DynamoDB DocumentClient factory, base repository     |
| errors     | Domain error classes and HTTP exception mappers      |

## Local Development

```bash
# Install dependencies for a specific service
cd services/members && npm install

# Run a service locally (serverless-offline or NestJS HTTP adapter)
npm run start:dev

# Run unit tests
npm run test

# Run integration tests (requires localstack or real AWS dev env)
npm run test:integration
```

## Lambda Entry Point Convention

Each service exposes a `handler` export from `src/infrastructure/handlers/lambda.handler.ts`
using `@vendia/serverless-express` or NestJS's native Lambda adapter.

## Environment Variables

All environment-specific values are injected by Lambda environment configuration defined in Terraform.
Never hard-code credentials. Use SSM Parameter Store for secrets.

| Variable              | Description                                 |
|-----------------------|---------------------------------------------|
| `DYNAMODB_REGION`     | AWS region for DynamoDB                     |
| `COGNITO_USER_POOL_ID`| Cognito User Pool ID                        |
| `COGNITO_CLIENT_ID`   | Cognito App Client ID                       |
| `STRIPE_SECRET_KEY`   | Stripe secret key (from SSM)                |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (from SSM)  |
| `SNS_PROMOTIONS_TOPIC_ARN` | SNS topic ARN for promotions          |
| `ENV`                 | Deployment environment (dev/stage/prod)     |
