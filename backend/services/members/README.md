# Service: members

Lambda: `activa-club-members-<env>`
Tables: `MembersTable`, `SeedMembersTable`

## Responsibility

Handles the full member lifecycle:
- DNI lookup against pre-seeded legacy data (onboarding gate) — AC-001
- Member profile creation via public registration endpoint — AC-001
- Membership tier management (VIP, Gold, Silver)
- Member status transitions (Active, Inactive, Suspended)

---

## AC-001: POST /v1/auth/register (Implemented)

Public endpoint. Validates DNI against `SeedMembersTable`, creates a Cognito
user (permanent password, `Member` group), and persists the member profile.

### Request

```json
{
  "dni": "20345678",
  "email": "martin.garcia@email.com",
  "password": "SecurePass1!",
  "full_name": "Martin Garcia",
  "phone": "+5491112345678"
}
```

### Success Response (HTTP 201)

```json
{
  "status": "success",
  "data": {
    "member_id": "01JKZP7QR8S9T0UVWX1YZ2AB3C",
    "full_name": "Martin Garcia",
    "email": "martin.garcia@email.com",
    "membership_type": "Gold",
    "account_status": "active",
    "created_at": "2026-02-20T15:30:00.000Z"
  },
  "message": "Registration successful. Please check your email to confirm your account."
}
```

### Error Codes

| HTTP | Code                       | Cause                                      |
|------|----------------------------|--------------------------------------------|
| 400  | `VALIDATION_ERROR`         | Missing or malformed fields                |
| 403  | `ACCOUNT_INACTIVE`         | Seed record has account_status=inactive    |
| 404  | `DNI_NOT_FOUND`            | DNI not in SeedMembersTable                |
| 409  | `DNI_ALREADY_REGISTERED`   | DNI already in MembersTable                |
| 409  | `EMAIL_ALREADY_IN_USE`     | Email already in MembersTable              |
| 422  | `PASSWORD_POLICY_VIOLATION`| Cognito rejected the password              |
| 500  | `INTERNAL_ERROR`           | Unexpected server-side failure             |

---

## Environment Variables

| Variable                  | Description                               | Example                      |
|---------------------------|-------------------------------------------|------------------------------|
| `PORT`                    | Local HTTP server port                    | `3001`                       |
| `ENV`                     | Environment (`local`, `dev`, `prod`)      | `local`                      |
| `DYNAMODB_REGION`         | AWS region for DynamoDB                   | `us-east-1`                  |
| `MEMBERS_TABLE_NAME`      | DynamoDB table for member profiles        | `MembersTable-production`    |
| `SEED_MEMBERS_TABLE_NAME` | DynamoDB table with pre-seeded data       | `SeedMembersTable-production`|
| `COGNITO_REGION`          | AWS region for Cognito                    | `us-east-1`                  |
| `COGNITO_USER_POOL_ID`    | Cognito User Pool ID                      | `us-east-1_XXXXXXXXX`        |
| `COGNITO_CLIENT_ID`       | Cognito App Client ID                     | `XXXXXXXXXXXXXXXXXX`         |

Copy `.env.example` to `.env` for local development.

---

## Local Setup

```bash
# From backend/ root
npm install

# Copy env template
cp services/members/.env.example services/members/.env
# Edit .env with your values

# Start local dev server
npm run start:dev
# API: http://localhost:3001/v1
# Swagger: http://localhost:3001/api/docs
```

---

## Running Tests

```bash
# From backend/ root

# All members service tests
npm test -- --testPathPattern="services/members"

# Specific test files
npm test -- --testPathPattern="register-member.handler"
npm test -- --testPathPattern="dynamo-member.repository"

# With coverage
npm run test:cov -- --testPathPattern="services/members"
```

---

## Clean Architecture Layout

```
src/
├── application/
│   ├── commands/
│   │   ├── create-member.command.ts
│   │   ├── update-member.command.ts
│   │   └── update-membership-tier.command.ts
│   └── queries/
│       ├── get-member-by-id.query.ts
│       ├── get-member-by-dni.query.ts
│       └── list-members.query.ts
├── domain/
│   ├── entities/
│   │   └── member.entity.ts
│   ├── value-objects/
│   │   ├── dni.vo.ts
│   │   ├── membership-tier.vo.ts
│   │   └── member-status.vo.ts
│   └── repositories/
│       └── member.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── member.dynamo.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── members.controller.ts
    └── dtos/
        ├── create-member.dto.ts
        └── update-member.dto.ts
```

## API Endpoints

| Method | Path                   | Auth             | Description               |
|--------|------------------------|------------------|---------------------------|
| POST   | /v1/members/onboard    | Public           | DNI lookup + registration |
| GET    | /v1/members/:id        | Member+          | Get own profile           |
| PATCH  | /v1/members/:id        | Member (own)     | Update profile            |
| GET    | /v1/members            | Admin/Manager    | List all members          |
| PATCH  | /v1/members/:id/tier   | Admin            | Change membership tier    |
| PATCH  | /v1/members/:id/status | Admin            | Activate/suspend member   |

## DynamoDB: MembersTable

| Attribute      | Type   | Notes                                     |
|----------------|--------|-------------------------------------------|
| `PK`           | String | `MEMBER#<memberId>`                       |
| `SK`           | String | `PROFILE`                                 |
| `memberId`     | String | ULID                                      |
| `dni`          | String | National ID (indexed)                     |
| `email`        | String | Cognito identity email                    |
| `firstName`    | String |                                           |
| `lastName`     | String |                                           |
| `membershipTier` | String | VIP / Gold / Silver                     |
| `status`       | String | Active / Inactive / Suspended / Pending   |
| `cognitoSub`   | String | Cognito user sub                          |
| `createdAt`    | String | ISO 8601                                  |
| `updatedAt`    | String | ISO 8601                                  |

GSI: `GSI_DNI` - PK: `dni` (for onboarding lookup)
GSI: `GSI_Email` - PK: `email` (for Cognito post-confirmation trigger)

## Membership Tier Rules

| Tier   | Max Reservations/Month | Guest Limit/Reservation |
|--------|------------------------|-------------------------|
| VIP    | Unlimited              | 5                        |
| Gold   | 10                     | 3                        |
| Silver | 5                      | 1                        |
