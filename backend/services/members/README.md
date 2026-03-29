# Service: members

Lambda: `activa-club-members-<env>`
Tables: `MembersTable`, `SeedMembersTable`

## Responsibility

Handles member onboarding and authentication:

- **AC-001 Rev2:** Member registration via DNI matching (SignUp + email OTP verification flow)
- **AC-002:** Member login with Email MFA (Cognito AdminInitiateAuth + EMAIL_OTP challenge)

---

## Endpoints

| Method | Path                       | Auth   | HTTP | Description                                         |
|--------|----------------------------|--------|------|-----------------------------------------------------|
| POST   | `/v1/auth/register`        | Public | 202  | Step 1: DNI validation + Cognito SignUp → OTP sent  |
| POST   | `/v1/auth/verify-email`    | Public | 201  | Step 2: OTP confirmation + profile creation         |
| POST   | `/v1/auth/resend-code`     | Public | 200  | Resend OTP to member email                          |
| POST   | `/v1/auth/login`           | Public | 200  | Step 1: Credential validation → EMAIL_OTP challenge |
| POST   | `/v1/auth/verify-otp`      | Public | 200  | Step 2: OTP challenge response → JWT tokens         |

---

## AC-001 Rev2: Registration Flow

### Step 1 — POST /v1/auth/register → HTTP 202

Validates DNI against `SeedMembersTable`, checks for duplicate accounts, then calls
Cognito `SignUp` to create an `UNCONFIRMED` user and send a 6-digit OTP to the email.
**No DynamoDB profile is created at this stage.**

#### Request

```json
{
  "dni": "20345678",
  "email": "martin.garcia@email.com",
  "password": "SecurePass1!",
  "full_name": "Martin Garcia",
  "phone": "+5491112345678"
}
```

#### Success Response (HTTP 202)

```json
{
  "status": "success",
  "data": {
    "email": "martin.garcia@email.com",
    "message": "A verification code has been sent to your email. Please enter it to activate your account."
  }
}
```

#### Error Codes

| HTTP | Code                       | Cause                                         |
|------|----------------------------|-----------------------------------------------|
| 400  | `VALIDATION_ERROR`         | Missing or malformed fields                   |
| 403  | `ACCOUNT_INACTIVE`         | Seed record has `account_status=inactive`     |
| 404  | `DNI_NOT_FOUND`            | DNI not in `SeedMembersTable`                 |
| 409  | `DNI_ALREADY_REGISTERED`   | DNI already confirmed in `MembersTable`       |
| 409  | `EMAIL_ALREADY_IN_USE`     | Email already confirmed in `MembersTable`     |
| 422  | `PASSWORD_POLICY_VIOLATION`| Password doesn't meet Cognito policy          |
| 500  | `INTERNAL_ERROR`           | Unexpected server-side failure                |

---

### Step 2 — POST /v1/auth/verify-email → HTTP 201

Confirms the Cognito account with the 6-digit OTP, assigns the user to the `Member` group,
and creates the member profile in DynamoDB `MembersTable`.

#### Request

```json
{
  "email": "martin.garcia@email.com",
  "code": "482917"
}
```

#### Success Response (HTTP 201)

```json
{
  "status": "success",
  "data": {
    "member_id": "01JKZP7QR8S9T0UVWX1YZ2AB3C",
    "full_name": "Martin Garcia",
    "email": "martin.garcia@email.com",
    "membership_type": "Gold",
    "account_status": "active",
    "created_at": "2026-02-27T15:30:00.000Z"
  },
  "message": "Account successfully activated. You can now sign in."
}
```

#### Error Codes

| HTTP | Code                  | Cause                                                  |
|------|-----------------------|--------------------------------------------------------|
| 400  | `VALIDATION_ERROR`    | Missing or malformed fields                            |
| 400  | `INVALID_CODE`        | Wrong OTP (`CodeMismatchException`)                    |
| 404  | `USER_NOT_FOUND`      | No `UNCONFIRMED` user for this email                   |
| 410  | `CODE_EXPIRED`        | OTP TTL exceeded (`ExpiredCodeException`)              |
| 429  | `TOO_MANY_ATTEMPTS`   | Too many incorrect OTP attempts                        |
| 500  | `INTERNAL_ERROR`      | DynamoDB write failed (Cognito user rolled back)       |

---

### Support — POST /v1/auth/resend-code → HTTP 200

Calls Cognito `ResendConfirmationCode` to send a new OTP when the original expired.

#### Request

```json
{
  "email": "martin.garcia@email.com"
}
```

#### Success Response (HTTP 200)

```json
{
  "status": "success",
  "data": { "message": "A new verification code has been sent to your email." }
}
```

---

## AC-002: Login Flow

### Step 1 — POST /v1/auth/login → HTTP 200

Calls Cognito `AdminInitiateAuth` (ADMIN_USER_PASSWORD_AUTH). With Email MFA ON, Cognito
sends a 6-digit OTP to the verified email and returns an `EMAIL_OTP` challenge.

#### Request

```json
{
  "email": "martin.garcia@email.com",
  "password": "SecurePass1!"
}
```

#### Success Response (HTTP 200)

```json
{
  "status": "success",
  "data": {
    "challengeName": "EMAIL_OTP",
    "session": "<cognito_session_token_opaque>",
    "message": "A verification code has been sent to your email."
  }
}
```

#### Error Codes

| HTTP | Code                    | Cause                                           |
|------|-------------------------|-------------------------------------------------|
| 400  | `VALIDATION_ERROR`      | Missing or malformed fields                     |
| 401  | `INVALID_CREDENTIALS`   | Wrong email or password (generic — no enumeration) |
| 403  | `ACCOUNT_NOT_CONFIRMED` | `UNCONFIRMED` Cognito account                   |
| 403  | `ACCOUNT_DISABLED`      | Admin-disabled account                          |
| 429  | `TOO_MANY_ATTEMPTS`     | Cognito rate limiting                           |

---

### Step 2 — POST /v1/auth/verify-otp → HTTP 200

Calls Cognito `AdminRespondToAuthChallenge` (EMAIL_OTP). Returns JWT tokens on success.

#### Request

```json
{
  "email": "martin.garcia@email.com",
  "session": "<cognito_session_token>",
  "otp": "482917"
}
```

#### Success Response (HTTP 200)

```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJraWQiOiJ...",
    "idToken": "eyJraWQiOiJ...",
    "refreshToken": "eyJjdHkiOiJ...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

#### Error Codes

| HTTP | Code               | Cause                                                   |
|------|--------------------|---------------------------------------------------------|
| 400  | `INVALID_OTP`      | Wrong OTP code (`CodeMismatchException`)                |
| 410  | `SESSION_EXPIRED`  | Cognito session expired (3-minute TTL)                  |
| 429  | `TOO_MANY_ATTEMPTS`| Too many incorrect OTP attempts                         |

---

## Standard Error Envelope

All error responses follow this format:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message safe for display.",
    "details": []
  }
}
```

Validation errors include per-field messages in `details[]`.

---

## Environment Variables

| Variable                  | Description                               | Example                        |
|---------------------------|-------------------------------------------|--------------------------------|
| `PORT`                    | Local HTTP server port                    | `3001`                         |
| `ENV`                     | Environment (`local`, `dev`, `prod`)      | `local`                        |
| `DYNAMODB_REGION`         | AWS region for DynamoDB                   | `us-east-1`                    |
| `MEMBERS_TABLE_NAME`      | DynamoDB table for member profiles        | `MembersTable-production`      |
| `SEED_MEMBERS_TABLE_NAME` | DynamoDB table with pre-seeded data       | `SeedMembersTable-production`  |
| `COGNITO_REGION`          | AWS region for Cognito                    | `us-east-1`                    |
| `COGNITO_USER_POOL_ID`    | Cognito User Pool ID                      | `us-east-1_XXXXXXXXX`          |
| `COGNITO_CLIENT_ID`       | Cognito App Client ID (for SignUp/Login)  | `XXXXXXXXXXXXXXXXXXXXXXXXXX`   |

Copy `.env.example` to `.env` for local development.

---

## Local Setup

```bash
# From backend/ root
npm install

# Verify services/members/.env exists with correct values (PORT, COGNITO_*, DYNAMODB_*)
# See Environment Variables table above

# Start local dev server (NestJS HTTP)
nest start members --watch
# API:     http://localhost:3001/v1
# Swagger: http://localhost:3001/api/docs

# Start with debugger attached (port 9229)
nest start members --debug --watch
```

---

## Running Tests

```bash
# From backend/ root

# All members service unit tests
npm test -- --testPathPattern="services/members"

# Individual test files
npm test -- --testPathPattern="register-member.handler"
npm test -- --testPathPattern="verify-email.handler"
npm test -- --testPathPattern="resend-code.handler"
npm test -- --testPathPattern="login.handler"
npm test -- --testPathPattern="verify-otp.handler"
npm test -- --testPathPattern="global-exception.filter"
npm test -- --testPathPattern="dynamo-member.repository"

# With coverage
npm run test:cov -- --testPathPattern="services/members"
```

---

## Clean Architecture Layout

```
src/
├── application/
│   └── commands/
│       ├── register-member/           # AC-001 Step 1: SignUp flow
│       │   ├── register-member.command.ts
│       │   ├── register-member.handler.ts
│       │   └── register-member.result.ts
│       ├── verify-email/              # AC-001 Step 2: ConfirmSignUp + profile
│       │   ├── verify-email.command.ts
│       │   ├── verify-email.handler.ts
│       │   └── verify-email.result.ts
│       ├── resend-code/               # AC-001 Support: ResendConfirmationCode
│       │   ├── resend-code.command.ts
│       │   └── resend-code.handler.ts
│       ├── login/                     # AC-002 Step 1: AdminInitiateAuth
│       │   ├── login.command.ts
│       │   ├── login.handler.ts
│       │   └── login.result.ts
│       └── verify-otp/                # AC-002 Step 2: AdminRespondToAuthChallenge
│           ├── verify-otp.command.ts
│           ├── verify-otp.handler.ts
│           └── verify-otp.result.ts
├── domain/
│   ├── entities/
│   │   └── member.entity.ts
│   ├── exceptions/
│   │   └── member.exceptions.ts       # All domain exceptions (AC-001 + AC-002)
│   ├── value-objects/
│   │   ├── account-status.vo.ts
│   │   ├── dni.vo.ts
│   │   └── membership-type.vo.ts
│   └── repositories/
│       ├── member.repository.interface.ts
│       └── seed-member.repository.interface.ts
├── infrastructure/
│   ├── cognito/
│   │   └── cognito.service.ts         # signUp, confirmSignUp, resendConfirmationCode,
│   │                                  # adminGetUser, adminAddUserToGroup, adminDeleteUser,
│   │                                  # adminInitiateAuth, adminRespondToAuthChallenge
│   ├── handlers/
│   │   └── lambda.handler.ts          # AWS Lambda entry point
│   ├── repositories/
│   │   ├── dynamo-member.repository.ts
│   │   └── dynamo-seed-member.repository.ts
│   └── dynamo-client.factory.ts
├── presentation/
│   ├── controllers/
│   │   └── auth.controller.ts         # All 5 auth endpoints
│   └── dtos/
│       ├── register-member.request.dto.ts
│       ├── register-member.response.dto.ts
│       ├── verify-email.request.dto.ts
│       ├── verify-email.response.dto.ts
│       ├── resend-code.request.dto.ts
│       ├── login.request.dto.ts
│       ├── login.response.dto.ts
│       ├── verify-otp.request.dto.ts
│       └── verify-otp.response.dto.ts
├── shared/
│   └── filters/
│       └── global-exception.filter.ts # Maps domain exceptions → HTTP responses
├── main.ts                            # Local NestJS HTTP bootstrap
└── test/
    └── unit/                          # Jest unit tests
        ├── register-member.handler.spec.ts
        ├── verify-email.handler.spec.ts
        ├── resend-code.handler.spec.ts
        ├── login.handler.spec.ts
        ├── verify-otp.handler.spec.ts
        ├── global-exception.filter.spec.ts
        └── dynamo-member.repository.spec.ts
```

## DynamoDB Tables

### MembersTable

| Attribute          | Type   | Notes                                  |
|--------------------|--------|----------------------------------------|
| `PK`               | String | `MEMBER#<ulid>`                        |
| `SK`               | String | `PROFILE`                              |
| `member_id`        | String | ULID                                   |
| `dni`              | String | National ID (GSI_DNI partition key)    |
| `email`            | String | Email (GSI_Email partition key)        |
| `full_name`        | String | From seed record                       |
| `membership_type`  | String | `VIP` / `Gold` / `Silver`              |
| `account_status`   | String | `active` / `inactive` / `suspended`   |
| `cognito_user_id`  | String | Cognito `sub` (GSI_CognitoSub PK)      |
| `created_at`       | String | ISO-8601 UTC                           |
| `updated_at`       | String | ISO-8601 UTC                           |
| `phone`            | String | Optional                               |
| `membership_expiry`| String | Optional — set after first payment     |

GSIs: `GSI_DNI` (PK=`dni`), `GSI_Email` (PK=`email`), `GSI_CognitoSub` (PK=`cognito_user_id`)

### SeedMembersTable (read-only)

| Attribute         | Type   | Notes                              |
|-------------------|--------|------------------------------------|
| `DNI`             | String | Hash key (plain DNI value)         |
| `full_name`       | String |                                    |
| `membership_type` | String | `VIP` / `Gold` / `Silver`          |
| `account_status`  | String | `active` / `inactive`              |
| `email`           | String | Optional                           |
| `phone`           | String | Optional                           |
| `imported_at`     | String | ISO-8601 UTC                       |

## Membership Tier Rules

| Tier   | Max Reservations/Month | Guest Limit/Reservation |
|--------|------------------------|-------------------------|
| VIP    | Unlimited              | 5                       |
| Gold   | 10                     | 3                       |
| Silver | 5                      | 1                       |
