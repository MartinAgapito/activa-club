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

Two entry points exist depending on the use case:

| Mode | Command | Port | Entry point | Module |
|------|---------|------|-------------|--------|
| **Members standalone** (recommended) | `nest start members --watch` | 3001 | `services/members/src/main.ts` | `MembersModule` |
| **Combined app** | `npm run start:dev` | 3000 | `src/main.ts` | `AppModule` |

```bash
# Install all dependencies (from backend/ root)
npm install

# Run members service standalone (uses services/members/.env)
nest start members --watch
# API:     http://localhost:3001/v1
# Swagger: http://localhost:3001/api/docs

# Run members service with debugger (attach VS Code to port 9229)
nest start members --debug --watch

# Run all unit tests
npm test

# Run tests for a specific service
npm test -- --testPathPattern="services/members"

# Run with coverage
npm run test:cov -- --testPathPattern="services/members"
```

## Lambda Entry Point Convention

Each service exposes a `handler` export from `src/infrastructure/handlers/lambda.handler.ts`
using `@vendia/serverless-express`. The handler caches the bootstrapped app across warm invocations.

## Implementation Status

| Service        | Status       | Stories        |
|----------------|--------------|----------------|
| members        | Implemented  | AC-001, AC-002 |
| reservations   | Scaffolded   | —              |
| payments       | Scaffolded   | —              |
| promotions     | Scaffolded   | —              |
| guests         | Scaffolded   | —              |
| areas          | Scaffolded   | —              |
| admin          | Scaffolded   | —              |

## Environment Variables

Each service has its own `.env` at `services/<name>/.env` for local development.
In production, all values are injected by Terraform via Lambda environment configuration.
Secrets (Stripe) are fetched at runtime from AWS SSM Parameter Store.

| Variable                  | Used by            | Description                          |
|---------------------------|---------------------|--------------------------------------|
| `PORT`                    | All (local)         | Local HTTP server port               |
| `ENV`                     | All                 | `local` / `dev` / `production`       |
| `DYNAMODB_REGION`         | All                 | AWS region for DynamoDB              |
| `MEMBERS_TABLE_NAME`      | members             | DynamoDB table for member profiles   |
| `SEED_MEMBERS_TABLE_NAME` | members             | Pre-seeded DNI data (read-only)      |
| `COGNITO_USER_POOL_ID`    | members             | Cognito User Pool ID                 |
| `COGNITO_CLIENT_ID`       | members             | Cognito App Client ID                |
| `STRIPE_SECRET_KEY`       | payments (SSM)      | Stripe secret key                    |
| `STRIPE_WEBHOOK_SECRET`   | payments (SSM)      | Stripe webhook signing secret        |
| `SNS_PROMOTIONS_TOPIC_ARN`| promotions          | SNS topic ARN for promotions         |
