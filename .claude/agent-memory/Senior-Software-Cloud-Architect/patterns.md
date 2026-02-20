# ActivaClub - Architecture Patterns Reference

## Full Repository Layout (as initialized)

```
C:/Users/Martin/Desktop/Tesis/
├── README.md
├── backend/
│   ├── README.md
│   ├── libs/
│   │   ├── auth/README.md          - Cognito JWT guard, RolesGuard, decorators
│   │   ├── dto/README.md           - Shared DTOs, Zod schemas, pagination
│   │   ├── dynamodb/README.md      - DynamoDB DocumentClient factory, BaseRepository
│   │   ├── errors/README.md        - Domain error hierarchy + HTTP mapping
│   │   ├── logging/README.md       - Structured logging (Lambda PowerTools)
│   │   └── utils/README.md         - Date, ULID, pagination, access codes
│   └── services/
│       ├── members/        - Lambda: member lifecycle, DNI onboarding
│       ├── reservations/   - Lambda: slot booking, capacity, quotas
│       ├── payments/       - Lambda: Stripe checkout + webhooks
│       ├── promotions/     - Lambda: CRUD + SNS broadcast
│       ├── guests/         - Lambda: guest registration + access codes
│       ├── areas/          - Lambda: areas catalog + schedule
│       └── admin/          - Lambda: cross-table analytics, admin ops
├── frontend/
│   ├── README.md
│   └── src/
│       ├── api/            - Axios client + per-resource API modules
│       ├── assets/
│       ├── components/     - ui/, layout/, auth/, members/, reservations/, payments/, promotions/, guests/, admin/
│       ├── hooks/          - Custom React hooks
│       ├── pages/          - auth/, member/, admin/, shared/
│       ├── router/         - React Router config + ProtectedRoute
│       ├── store/          - Zustand (auth.store, ui.store)
│       ├── types/          - TypeScript interfaces per domain
│       └── utils/          - date, format, qr utilities
├── infrastructure/
│   ├── README.md
│   ├── modules/
│   │   ├── dynamodb/       - DynamoDB table + GSI module
│   │   ├── lambda/         - Lambda + IAM role module
│   │   ├── api-gateway/    - HTTP API + JWT authorizer + routes
│   │   ├── cognito/        - User Pool + Groups module
│   │   ├── sns/            - SNS topics module
│   │   └── s3-cloudfront/  - S3 + CloudFront SPA module
│   └── envs/
│       └── dev/            - Dev environment Terraform overlay
├── docs/
│   ├── README.md
│   ├── architecture/
│   │   ├── README.md
│   │   └── architecture.mmd  - Mermaid: system overview, auth, Stripe, SNS flows
│   ├── design/             - AC-XXX-design.md per story
│   └── api/                - OpenAPI specs (generated from NestJS)
├── backlog/
│   ├── README.md
│   ├── epics/
│   └── stories/            - AC-XXX.md per user story
└── scripts/
    └── README.md           - seed-legacy-members, seed-areas, seed-dev-users
```

## Clean Architecture Layers per Lambda Service

```
services/<name>/src/
├── application/
│   ├── commands/    - Write use cases (create, update, delete, cancel)
│   └── queries/     - Read use cases (get, list, check)
├── domain/
│   ├── entities/    - Rich domain entities
│   ├── value-objects/  - Immutable domain concepts (status, tier, slot)
│   └── repositories/   - Repository interfaces (no DynamoDB deps here)
├── infrastructure/
│   ├── repositories/   - DynamoDB concrete implementations
│   └── handlers/       - lambda.handler.ts (entry point)
└── presentation/
    ├── controllers/    - NestJS controllers (HTTP binding)
    └── dtos/           - Request/response DTOs
```

## DynamoDB Table Inventory

| Table             | PK pattern           | SK pattern            | Key GSIs                         |
|-------------------|----------------------|-----------------------|----------------------------------|
| MembersTable      | MEMBER#<id>          | PROFILE               | GSI_DNI (dni), GSI_Email (email) |
| ReservationsTable | RESERVATION#<id>     | MEMBER#<memberId>     | GSI_Member, GSI_Area             |
| AreasTable        | AREA#<id>            | METADATA              | GSI_Status                       |
| GuestsTable       | GUEST#<id>           | RESERVATION#<resId>   | GSI_Reservation, GSI_AccessCode  |
| PaymentsTable     | PAYMENT#<id>         | MEMBER#<memberId>     | GSI_Member, GSI_StripeSession    |
| PromotionsTable   | PROMOTION#<id>       | METADATA              | GSI_Status                       |

## Stripe Webhook Special Rule
POST /v1/payments/webhook does NOT use the Cognito JWT authorizer.
Stripe signature verified inside PaymentsLambda using STRIPE_WEBHOOK_SECRET from SSM.

## ID Strategy
All PKs use ULID (time-sortable, URL-safe). Package: `ulid`.

## Env Variables Injected by Terraform into Each Lambda
DYNAMODB_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, ENV
Plus service-specific: MEMBERS_TABLE_NAME, SNS_PROMOTIONS_TOPIC_ARN, etc.
Secrets (Stripe keys) fetched at runtime from SSM Parameter Store path: /activa-club/<env>/<secret-name>
