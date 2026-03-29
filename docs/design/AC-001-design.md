# AC-001 Technical Design: Member Registration via DNI Matching

**Epic:** EP-01 - Member Onboarding
**Story Points:** 13
**Priority:** High
**Status:** Implemented (Rev 2 — Email OTP Verification + Seed Script)
**Author:** Senior Software & Cloud Architect
**Date:** 2026-02-20
**Last Updated:** 2026-03-29
**Changelog:** Rev 2 — Changed from `AdminCreateUser` to native `SignUp` + `ConfirmSignUp` flow to support Cognito email OTP verification. Added `/v1/auth/verify-email` and `/v1/auth/resend-code` endpoints. Seed script requirements formalized.

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Context](#2-system-context)
3. [DynamoDB Table Schema](#3-dynamodb-table-schema)
4. [API Contract](#4-api-contract)
5. [Architecture Flow](#5-architecture-flow)
6. [Lambda Design](#6-lambda-design)
7. [Cognito Configuration](#7-cognito-configuration)
8. [Security Considerations](#8-security-considerations)
9. [Infrastructure (Terraform)](#9-infrastructure-terraform)
10. [Frontend Changes](#10-frontend-changes)
11. [Open Questions](#11-open-questions)

---

## 1. Overview

This document describes the technical design for **AC-001: Member Registration via DNI Matching**, the entry point for all member lifecycle flows in ActivaClub.

When a prospective member registers, the system must execute a **two-step flow**:

**Step 1 — Registration (`POST /v1/auth/register`):**
1. Validate that the DNI exists in the pre-seeded legacy data table (`SeedMembersTable`).
2. Enforce business rules: block inactive records (`account_status = "inactive"`), reject duplicate DNI or email registrations.
3. Call Cognito's `SignUp` API (backend-orchestrated) — creates the user in `UNCONFIRMED` state and triggers Cognito to send a 6-digit OTP to the member's email automatically.
4. Return HTTP 202 — "Code sent. Please verify your email."

**Step 2 — Email Verification (`POST /v1/auth/verify-email`):**
5. Call Cognito's `ConfirmSignUp` with the OTP entered by the member — Cognito marks the account as `CONFIRMED`.
6. Assign the Cognito user to the `Member` group (`AdminAddUserToGroup`).
7. Persist the member profile in DynamoDB `MembersTable`, inheriting `membership_type` from the seed record.
8. Return HTTP 201 — "Account activated."

**Supporting endpoint — Resend Code (`POST /v1/auth/resend-code`):**
9. Call Cognito's `ResendConfirmationCode` if the OTP expired or was not received.

> **Rev 2 Design Decision — `SignUp` vs `AdminCreateUser`:**
> The original AC-001 design used `AdminCreateUser` + `AdminSetUserPassword` with `AllowAdminCreateUserOnly = true`. This approach does **not** natively support email OTP verification (it sends a temporary password instead). To fulfill AC-002's requirement of Cognito Email MFA (which requires a confirmed email), the registration flow has been updated to use `SignUp` + `ConfirmSignUp`. `AllowAdminCreateUserOnly` is set to `false`, but the backend Lambda acts as the sole gatekeeper — the frontend never calls Cognito APIs directly for registration.

**Prerequisite:** The `seed-legacy-members.ts` script must have been executed to populate `SeedMembersTable` from the club's on-premise CSV export before any registration attempt.

This story is a prerequisite for AC-002 (Login), AC-003 (Profile), and AC-004 (Membership Payment).

---

## 2. System Context

AC-001 touches the following infrastructure layers:

```
Prospective Member (browser)
        |
        | HTTPS POST /v1/auth/register  [no auth token required]
        v
Amazon CloudFront  -->  React SPA (S3)
        |
        | API call
        v
Amazon API Gateway HTTP API
  - Route: POST /v1/auth/register
  - NO JWT Authorizer on this route (public endpoint)
        |
        v
AWS Lambda: activa-club-members-dev
  [NestJS, Clean Architecture]
        |
        |-- Query -->  DynamoDB: SeedMembersTable  (read-only, DNI lookup)
        |-- Query -->  DynamoDB: MembersTable       (duplicate DNI/email check)
        |-- SignUp / ConfirmSignUp / AdminAddUserToGroup --> Amazon Cognito User Pool
        |-- PutItem --> DynamoDB: MembersTable      (persist member profile)
```

All other ActivaClub routes that require authentication use a Cognito JWT Authorizer attached to API Gateway. The registration route is explicitly excluded from that authorizer.

---

## 3. DynamoDB Table Schema

### 3.1 SeedMembersTable (Pre-loaded Legacy Data)

This table is populated once via a migration script (`scripts/seed-legacy-members`) from the club's on-premise system. It is **read-only** from the application perspective; no Lambda writes to it after the initial seed.

| Property       | Value                         |
|----------------|-------------------------------|
| Table Name     | `SeedMembersTable`            |
| Partition Key  | `DNI` (String) — value: raw DNI number (e.g., `20345678`) |
| Sort Key       | None                          |
| Billing Mode   | PAY_PER_REQUEST (on-demand)   |
| Encryption     | AWS-managed (SSE)             |

> **Note:** The Terraform hash key attribute is `DNI` (uppercase). Values are stored as plain DNI numbers without any prefix. GetItem key: `{ DNI: "20345678" }`.

**Attributes:**

| Attribute        | Type   | Required | Description                                        |
|------------------|--------|----------|----------------------------------------------------|
| `DNI`            | String | Yes      | Partition key. Raw DNI number (e.g., `20345678`). No prefix. |
| `dni`            | String | Yes      | National ID number (redundant denormalized copy, plain value) |
| `full_name`      | String | Yes      | Full legal name imported from legacy system        |
| `membership_type`| String | Yes      | Enum: `VIP`, `Gold`, `Silver`                      |
| `account_status` | String | Yes      | Enum: `active`, `inactive`                         |
| `email`          | String | No       | Pre-existing email if available in legacy data     |
| `phone`          | String | No       | Phone number from legacy data                      |
| `imported_at`    | String | Yes      | ISO-8601 timestamp of import                       |

**Access Patterns:**

| Pattern                      | Key used            | Notes                              |
|------------------------------|---------------------|------------------------------------|
| Look up record by DNI number | `pk = DNI#<dni>`   | GetItem — O(1), no GSI needed      |

**No GSIs required** on this table; all lookups are direct GetItem by PK.

---

### 3.2 MembersTable (Application Member Profiles)

This is the primary operational table for member data, written by the `activa-club-members` Lambda.

| Property       | Value                              |
|----------------|------------------------------------|
| Table Name     | `MembersTable`                     |
| Partition Key  | `pk` (String) — value: `MEMBER#<ulid>` |
| Sort Key       | `sk` (String) — value: `PROFILE`   |
| Billing Mode   | PAY_PER_REQUEST (on-demand)        |
| Encryption     | AWS-managed (SSE)                  |
| TTL Attribute  | None (member records are permanent)|

**Attributes:**

| Attribute          | Type   | Required | Description                                                      |
|--------------------|--------|----------|------------------------------------------------------------------|
| `pk`               | String | Yes      | Partition key. Format: `MEMBER#<ulid>`                           |
| `sk`               | String | Yes      | Sort key. Fixed value: `PROFILE`                                 |
| `member_id`        | String | Yes      | ULID — same value as in `pk` (denormalized for query convenience)|
| `dni`              | String | Yes      | National ID number. Unique per member.                           |
| `full_name`        | String | Yes      | Full name inherited from seed record                             |
| `email`            | String | Yes      | Email provided at registration. Unique per member.               |
| `membership_type`  | String | Yes      | Enum: `VIP`, `Gold`, `Silver`. Inherited from `SeedMembersTable`.|
| `account_status`   | String | Yes      | Enum: `active`, `inactive`, `suspended`. Default: `active`.     |
| `cognito_user_id`  | String | Yes      | Cognito `sub` (UUID) returned by `SignUp` → `AdminGetUser`       |
| `created_at`       | String | Yes      | ISO-8601 UTC timestamp of registration                           |
| `updated_at`       | String | Yes      | ISO-8601 UTC timestamp of last update                            |
| `membership_expiry`| String | No       | ISO-8601 date — set when first payment is processed (AC-004)     |
| `phone`            | String | No       | Optional phone number                                            |

**Global Secondary Indexes (GSIs):**

#### GSI_DNI

| Property         | Value                      |
|------------------|----------------------------|
| Index Name       | `GSI_DNI`                  |
| Partition Key    | `dni` (String)             |
| Sort Key         | None                       |
| Projection       | `KEYS_ONLY`                |
| Read Capacity    | On-demand (follows table)  |

**Purpose:** Detect duplicate DNI before creating a new Cognito user. A non-empty result means the DNI is already registered → HTTP 409.

#### GSI_Email

| Property         | Value                      |
|------------------|----------------------------|
| Index Name       | `GSI_Email`                |
| Partition Key    | `email` (String)           |
| Sort Key         | None                       |
| Projection       | `KEYS_ONLY`                |
| Read Capacity    | On-demand (follows table)  |

**Purpose:** Detect duplicate email before creating a new Cognito user. A non-empty result means the email is already in use → HTTP 409.

#### GSI_CognitoSub

| Property         | Value                             |
|------------------|-----------------------------------|
| Index Name       | `GSI_CognitoSub`                  |
| Partition Key    | `cognito_user_id` (String)        |
| Sort Key         | None                              |
| Projection       | `KEYS_ONLY`                       |
| Read Capacity    | On-demand (follows table)         |

**Purpose:** Allow future lookups of member profile by Cognito `sub` from the JWT authorizer context. Used by AC-002 (login profile fetch) and all subsequent authenticated flows.

**Access Patterns Summary:**

| Pattern                              | Operation         | Key / Index           |
|--------------------------------------|-------------------|-----------------------|
| Create member profile                | PutItem           | `pk = MEMBER#<ulid>`, `sk = PROFILE` |
| Get member profile by ID             | GetItem           | `pk`, `sk`            |
| Check if DNI already registered      | Query GSI_DNI     | `dni = <value>`       |
| Check if email already in use        | Query GSI_Email   | `email = <value>`     |
| Get member by Cognito sub (auth)     | Query GSI_CognitoSub | `cognito_user_id = <sub>` |

---

## 4. API Contract

All three endpoints are **public** (no JWT authorizer) and served by `activa-club-members-dev`.

### Common Request Headers

| Header         | Required | Value                               |
|----------------|----------|-------------------------------------|
| `Content-Type` | Yes      | `application/json`                  |
| `X-Request-ID` | No       | Client-generated UUID for tracing   |

### Common Error Envelope

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message safe for display.",
    "details": []
  }
}
```

---

### 4.1 Endpoint: POST /v1/auth/register (Step 1 — DNI Validation + SignUp)

| Property      | Value                       |
|---------------|-----------------------------|
| Method        | `POST`                      |
| Path          | `/v1/auth/register`         |
| Authorization | None (public route)         |
| Lambda        | `activa-club-members-dev`   |

#### Request Body

```json
{
  "dni": "string",
  "email": "string",
  "password": "string",
  "full_name": "string",
  "phone": "string"
}
```

| Field       | Type   | Required | Constraints                                                                     |
|-------------|--------|----------|---------------------------------------------------------------------------------|
| `dni`       | string | Yes      | 7–8 alphanumeric characters (Argentine DNI format). Trim whitespace.            |
| `email`     | string | Yes      | Valid RFC 5322 email. Max 254 chars. Lowercased before use.                     |
| `password`  | string | Yes      | Min 8 chars. At least 1 uppercase, 1 digit, 1 special character.                |
| `full_name` | string | No       | 2–100 chars. Overrides seed value if provided; seed value used if omitted.      |
| `phone`     | string | No       | E.164 format recommended. Max 20 chars.                                         |

#### Example Request

```json
{
  "dni": "20345678",
  "email": "martin.garcia@email.com",
  "password": "SecurePass1!",
  "full_name": "Martin Garcia",
  "phone": "+5491112345678"
}
```

#### Success Response — HTTP 202 (Accepted — OTP sent)

```json
{
  "status": "success",
  "data": {
    "email": "martin.garcia@email.com",
    "message": "A verification code has been sent to your email. Please enter it to activate your account."
  }
}
```

> **HTTP 202** (not 201) signals that the registration is pending email verification. The account does not exist yet from the application's perspective — only an `UNCONFIRMED` Cognito user exists.

#### Error Responses

| HTTP | Code                     | Trigger                                           |
|------|--------------------------|---------------------------------------------------|
| 400  | `VALIDATION_ERROR`       | Missing/malformed fields. `details[]` per-field.  |
| 403  | `ACCOUNT_INACTIVE`       | `account_status = "inactive"` in SeedMembersTable |
| 404  | `DNI_NOT_FOUND`          | DNI absent from SeedMembersTable                  |
| 409  | `DNI_ALREADY_REGISTERED` | DNI already confirmed in MembersTable             |
| 409  | `EMAIL_ALREADY_IN_USE`   | Email already in MembersTable or Cognito          |
| 422  | `PASSWORD_POLICY_VIOLATION` | Password doesn't meet Cognito policy           |
| 500  | `INTERNAL_ERROR`         | Unexpected Cognito/DynamoDB error                 |

---

### 4.2 Endpoint: POST /v1/auth/verify-email (Step 2 — OTP Confirmation)

| Property      | Value                       |
|---------------|-----------------------------|
| Method        | `POST`                      |
| Path          | `/v1/auth/verify-email`     |
| Authorization | None (public route)         |
| Lambda        | `activa-club-members-dev`   |

#### Request Body

```json
{
  "email": "string",
  "code": "string"
}
```

| Field   | Type   | Required | Constraints                                           |
|---------|--------|----------|-------------------------------------------------------|
| `email` | string | Yes      | Must match the email used in Step 1. Lowercased.      |
| `code`  | string | Yes      | Exactly 6 numeric digits. Example: `"482917"`.        |

#### Example Request

```json
{
  "email": "martin.garcia@email.com",
  "code": "482917"
}
```

#### Success Response — HTTP 201 (Account activated)

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

#### Error Responses

| HTTP | Code                  | Trigger                                                    |
|------|-----------------------|------------------------------------------------------------|
| 400  | `VALIDATION_ERROR`    | Missing/malformed fields                                   |
| 400  | `INVALID_CODE`        | OTP code is incorrect (`CodeMismatchException` in Cognito) |
| 404  | `USER_NOT_FOUND`      | No UNCONFIRMED user for this email in Cognito              |
| 410  | `CODE_EXPIRED`        | OTP TTL exceeded (24h Cognito default)                     |
| 429  | `TOO_MANY_ATTEMPTS`   | Exceeded Cognito's max confirmation attempts               |
| 500  | `INTERNAL_ERROR`      | Unexpected error during group assignment or DynamoDB write |

---

### 4.3 Endpoint: POST /v1/auth/resend-code (Resend OTP)

| Property      | Value                       |
|---------------|-----------------------------|
| Method        | `POST`                      |
| Path          | `/v1/auth/resend-code`      |
| Authorization | None (public route)         |
| Lambda        | `activa-club-members-dev`   |

#### Request Body

```json
{
  "email": "string"
}
```

#### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "message": "A new verification code has been sent to your email."
  }
}
```

#### Error Responses

| HTTP | Code                  | Trigger                                              |
|------|-----------------------|------------------------------------------------------|
| 404  | `USER_NOT_FOUND`      | No UNCONFIRMED user for this email                   |
| 429  | `TOO_MANY_ATTEMPTS`   | Cognito rate limit on resend (`LimitExceededException`) |
| 500  | `INTERNAL_ERROR`      | Unexpected Cognito error                             |

---

## 5. Architecture Flow

### 5.1 Step 1 — Registration (POST /v1/auth/register)

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser / React SPA
    participant APIGW as API Gateway HTTP API
    participant Lambda as activa-club-members Lambda
    participant SeedDB as DynamoDB SeedMembersTable
    participant MembersDB as DynamoDB MembersTable
    participant Cognito as Amazon Cognito User Pool

    Client->>APIGW: POST /v1/auth/register { dni, email, password, full_name }
    Note over APIGW: No JWT authorizer — public route
    APIGW->>Lambda: Invoke with HTTP event payload

    Lambda->>Lambda: 1. Parse & validate request body (DTO — class-validator)
    alt Validation fails
        Lambda-->>Client: HTTP 400 VALIDATION_ERROR
    end

    Lambda->>Lambda: 2. Validate password policy (strength rules pre-check)
    alt Password too weak
        Lambda-->>Client: HTTP 422 PASSWORD_POLICY_VIOLATION
    end

    Lambda->>SeedDB: 3. GetItem { pk: "DNI#<dni>" }
    alt DNI not found in seed
        Lambda-->>Client: HTTP 404 DNI_NOT_FOUND
    end

    Lambda->>Lambda: 4. Check account_status from seed record
    alt account_status == "inactive"
        Lambda-->>Client: HTTP 403 ACCOUNT_INACTIVE
    end

    Lambda->>MembersDB: 5. Query GSI_DNI { dni: <dni> }
    alt DNI already confirmed in MembersTable
        Lambda-->>Client: HTTP 409 DNI_ALREADY_REGISTERED
    end

    Lambda->>MembersDB: 6. Query GSI_Email { email: <email> }
    alt Email already in MembersTable
        Lambda-->>Client: HTTP 409 EMAIL_ALREADY_IN_USE
    end

    Lambda->>Cognito: 7. SignUp { ClientId, Username: email, Password: password, UserAttributes: [{ Name: "email", Value: email }, { Name: "custom:dni", Value: dni }] }
    Note over Cognito: AllowAdminCreateUserOnly = false<br/>Cognito creates UNCONFIRMED user<br/>Sends 6-digit OTP to email automatically
    Cognito->>Client: Email with 6-digit OTP code (TTL: 24h)
    Cognito-->>Lambda: { UserSub: "cognito-uuid-xxx", UserConfirmed: false }

    Lambda-->>APIGW: HTTP 202 { status: "success", data: { email, message: "Code sent..." } }
    APIGW-->>Client: HTTP 202 — Awaiting email verification
```

### 5.2 Step 2 — Email Verification (POST /v1/auth/verify-email)

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser / React SPA
    participant APIGW as API Gateway HTTP API
    participant Lambda as activa-club-members Lambda
    participant SeedDB as DynamoDB SeedMembersTable
    participant MembersDB as DynamoDB MembersTable
    participant Cognito as Amazon Cognito User Pool

    Client->>APIGW: POST /v1/auth/verify-email { email, code }
    Note over APIGW: No JWT authorizer — public route
    APIGW->>Lambda: Invoke

    Lambda->>Lambda: 1. Parse & validate request body (email, 6-digit code)
    alt Validation fails
        Lambda-->>Client: HTTP 400 VALIDATION_ERROR
    end

    Lambda->>Cognito: 2. ConfirmSignUp { ClientId, Username: email, ConfirmationCode: code }
    alt CodeMismatchException
        Cognito-->>Lambda: CodeMismatchException
        Lambda-->>Client: HTTP 400 INVALID_CODE
    end
    alt ExpiredCodeException
        Cognito-->>Lambda: ExpiredCodeException
        Lambda-->>Client: HTTP 410 CODE_EXPIRED
    end
    alt TooManyFailedAttemptsException
        Cognito-->>Lambda: TooManyFailedAttemptsException
        Lambda-->>Client: HTTP 429 TOO_MANY_ATTEMPTS
    end
    Cognito-->>Lambda: Success — user status: CONFIRMED

    Lambda->>Cognito: 3. AdminGetUser { UserPoolId, Username: email }
    Note over Lambda: Read custom:dni and sub from confirmed user attributes
    Cognito-->>Lambda: { Username, UserAttributes: [sub, email, custom:dni, ...] }

    Lambda->>SeedDB: 4. GetItem { pk: "DNI#<dni>" } — retrieve membership_type
    SeedDB-->>Lambda: { membership_type, full_name, ... }

    Lambda->>Cognito: 5. AdminAddUserToGroup { UserPoolId, Username: email, GroupName: "Member" }
    Cognito-->>Lambda: Success

    Lambda->>Lambda: 6. Generate ULID for member_id

    Lambda->>MembersDB: 7. PutItem { pk: "MEMBER#<ulid>", sk: "PROFILE", member_id, dni, full_name, email, membership_type, account_status: "active", cognito_user_id: sub, created_at, updated_at }
    alt DynamoDB write fails
        Lambda->>Cognito: AdminDeleteUser (rollback — remove orphaned confirmed user)
        Lambda-->>Client: HTTP 500 INTERNAL_ERROR
    end
    MembersDB-->>Lambda: Success

    Lambda-->>APIGW: HTTP 201 { status: "success", data: { member_id, full_name, email, membership_type, account_status, created_at } }
    APIGW-->>Client: HTTP 201 — Account activated
```

### 5.3 Resend Code (POST /v1/auth/resend-code)

```mermaid
sequenceDiagram
    participant Client as Browser / React SPA
    participant APIGW as API Gateway HTTP API
    participant Lambda as activa-club-members Lambda
    participant Cognito as Amazon Cognito User Pool

    Client->>APIGW: POST /v1/auth/resend-code { email }
    APIGW->>Lambda: Invoke

    Lambda->>Cognito: ResendConfirmationCode { ClientId, Username: email }
    alt LimitExceededException
        Cognito-->>Lambda: LimitExceededException
        Lambda-->>Client: HTTP 429 TOO_MANY_ATTEMPTS
    end
    Cognito->>Client: New 6-digit OTP sent to email
    Cognito-->>Lambda: Success

    Lambda-->>Client: HTTP 200 { message: "New code sent." }
```

### 5.4 Rollback Strategy

The critical window is between `ConfirmSignUp` (Step 2.2) and `PutItem` to MembersTable (Step 2.7). If `PutItem` fails after a successful confirm:

- The Lambda calls `AdminDeleteUser` to remove the now-confirmed Cognito user.
- Returns HTTP 500. The member can retry registration from Step 1 (new `SignUp` → new OTP).
- The SeedMembersTable record is not modified at any point — it remains available for retry.

If `AdminAddUserToGroup` (Step 2.5) fails after a successful `ConfirmSignUp`:
- Similarly, call `AdminDeleteUser` and return HTTP 500. The member retries registration.

---

## 6. Lambda Design

### 6.1 Service Location

```
backend/services/members/
```

### 6.2 Clean Architecture File Structure

```
backend/services/members/
├── src/
│   ├── application/
│   │   └── commands/
│   │       └── register-member/
│   │           ├── register-member.command.ts       # Input contract (plain object)
│   │           ├── register-member.handler.ts       # Use case orchestration logic
│   │           └── register-member.result.ts        # Output contract
│   ├── domain/
│   │   ├── entities/
│   │   │   └── member.entity.ts                    # Member domain entity (rich model)
│   │   ├── value-objects/
│   │   │   ├── dni.vo.ts                           # DNI format validation
│   │   │   ├── membership-type.vo.ts               # Enum: VIP | Gold | Silver
│   │   │   └── account-status.vo.ts                # Enum: active | inactive | suspended
│   │   └── repositories/
│   │       ├── member.repository.interface.ts      # Port: findByDni, findByEmail, save
│   │       └── seed-member.repository.interface.ts # Port: findByDni (read-only)
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── dynamo-member.repository.ts         # Adapter: MembersTable operations
│   │   │   └── dynamo-seed-member.repository.ts    # Adapter: SeedMembersTable operations
│   │   ├── cognito/
│   │   │   └── cognito.service.ts                  # AdminCreateUser, AdminAddUserToGroup, AdminDeleteUser
│   │   └── handlers/
│   │       └── lambda.handler.ts                   # Entry point — NestJS bootstrap
│   └── presentation/
│       ├── controllers/
│       │   └── auth.controller.ts                  # POST /v1/auth/register route binding
│       └── dtos/
│           ├── register-member.request.dto.ts      # class-validator decorated DTO
│           └── register-member.response.dto.ts     # Response shape
├── test/
│   ├── unit/
│   │   └── register-member.handler.spec.ts         # Unit tests for use case
│   └── integration/
│       └── auth.controller.spec.ts                 # Integration tests (mock DynamoDB/Cognito)
├── package.json
├── tsconfig.json
└── webpack.config.js                               # Bundle for Lambda deployment
```

### 6.3 Key Type Definitions

**register-member.request.dto.ts**

```typescript
import { IsString, IsEmail, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterMemberRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(8)
  @Matches(/^[0-9A-Za-z]+$/, { message: 'dni must contain only alphanumeric characters' })
  @Transform(({ value }) => value?.trim())
  dni: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: 'password must contain at least 1 uppercase letter, 1 number, and 1 special character',
  })
  password: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  full_name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;
}
```

**register-member.handler.ts (use case skeleton)**

```typescript
@Injectable()
export class RegisterMemberHandler {
  constructor(
    private readonly seedMemberRepo: SeedMemberRepositoryInterface,
    private readonly memberRepo: MemberRepositoryInterface,
    private readonly cognitoService: CognitoService,
  ) {}

  async execute(command: RegisterMemberCommand): Promise<RegisterMemberResult> {
    // 1. Look up DNI in seed table
    const seedRecord = await this.seedMemberRepo.findByDni(command.dni);
    if (!seedRecord) throw new DniNotFoundException();

    // 2. Enforce account_status
    if (seedRecord.accountStatus === 'inactive') throw new AccountInactiveException();

    // 3. Check DNI uniqueness in MembersTable
    const existingByDni = await this.memberRepo.findByDni(command.dni);
    if (existingByDni) throw new DniAlreadyRegisteredException();

    // 4. Check email uniqueness in MembersTable
    const existingByEmail = await this.memberRepo.findByEmail(command.email);
    if (existingByEmail) throw new EmailAlreadyInUseException();

    // 5. Create Cognito user (permanent password)
    let cognitoSub: string;
    try {
      cognitoSub = await this.cognitoService.adminCreateUser(command.email, command.password);
      await this.cognitoService.adminAddUserToGroup(command.email, 'Member');
    } catch (cognitoError) {
      // Rollback: delete Cognito user if group assignment fails
      await this.cognitoService.adminDeleteUser(command.email).catch(() => {});
      throw cognitoError;
    }

    // 6. Persist member profile
    const memberId = ulid();
    const now = new Date().toISOString();
    const member = new MemberEntity({
      memberId,
      dni: command.dni,
      fullName: command.full_name ?? seedRecord.fullName,
      email: command.email,
      phone: command.phone,
      membershipType: seedRecord.membershipType,
      accountStatus: 'active',
      cognitoUserId: cognitoSub,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await this.memberRepo.save(member);
    } catch (dbError) {
      // Rollback: delete Cognito user if DynamoDB write fails
      await this.cognitoService.adminDeleteUser(command.email).catch(() => {});
      throw dbError;
    }

    return new RegisterMemberResult(member);
  }
}
```

### 6.4 Domain Exceptions (mapped by global exception filter)

| Exception Class              | HTTP Status | Error Code                  |
|------------------------------|-------------|-----------------------------|
| `DniNotFoundException`       | 404         | `DNI_NOT_FOUND`             |
| `AccountInactiveException`   | 403         | `ACCOUNT_INACTIVE`          |
| `DniAlreadyRegisteredException` | 409      | `DNI_ALREADY_REGISTERED`    |
| `EmailAlreadyInUseException` | 409         | `EMAIL_ALREADY_IN_USE`      |
| `ValidationException`        | 400         | `VALIDATION_ERROR`          |
| `PasswordPolicyException`    | 422         | `PASSWORD_POLICY_VIOLATION` |

These exceptions are defined in `backend/libs/errors/` and caught by a NestJS global exception filter that maps them to the standard error envelope.

---

## 7. Cognito Configuration

### 7.1 User Pool Settings Relevant to AC-001 (Rev 2)

| Setting                                     | Rev 1 Value | Rev 2 Value (current)  | Rationale for Change                                          |
|---------------------------------------------|-------------|------------------------|---------------------------------------------------------------|
| `allow_self_registration`                   | `false`     | `true`                 | Required for `SignUp` API; Lambda is the sole gatekeeper      |
| `username_attributes`                       | `["email"]` | `["email"]`            | No change                                                     |
| `auto_verified_attributes`                  | `["email"]` | `["email"]`            | Cognito sends OTP automatically on `SignUp`                   |
| `mfa_configuration`                         | `OFF`       | `ON`                   | Email MFA required for all users (AC-002)                     |
| `email_mfa_configuration`                   | Not set     | Enabled (custom msg)   | OTP delivery for registration verification and login          |
| `software_token_mfa_configuration.enabled`  | Not set     | `false`                | Disable TOTP; use email OTP exclusively for MVP               |
| `account_recovery_setting`                  | Email only  | Email only             | No change                                                     |

**Custom User Pool Attributes (new in Rev 2):**

| Attribute    | Type   | Mutable | Purpose                                                                    |
|--------------|--------|---------|----------------------------------------------------------------------------|
| `custom:dni` | String | No      | Passed at `SignUp`; read via `AdminGetUser` in `verify-email` to look up seed |

### 7.2 Password Policy

| Rule                    | Value |
|-------------------------|-------|
| Minimum length          | 8     |
| Require uppercase       | Yes   |
| Require lowercase       | Yes   |
| Require numbers         | Yes   |
| Require symbols         | Yes   |

### 7.3 Cognito Groups

| Group Name | Description                                      | Precedence |
|------------|--------------------------------------------------|------------|
| `Admin`    | Full platform access                             | 1          |
| `Manager`  | Promotions + analytics access                    | 2          |
| `Member`   | Standard member access (reservations, guests...) | 3          |

AC-001 assigns every confirmed member to the `Member` group via `AdminAddUserToGroup` during `verify-email` (Step 2), not during `SignUp` (Step 1).

### 7.4 Cognito API Calls Made by Lambda (Rev 2)

| Cognito API Call           | Auth Method    | Called In        | Parameters                                                                                |
|----------------------------|----------------|------------------|-------------------------------------------------------------------------------------------|
| `SignUp`                   | App Client     | `register`       | `ClientId`, `Username: email`, `Password`, `UserAttributes: [email, custom:dni]`          |
| `ConfirmSignUp`            | App Client     | `verify-email`   | `ClientId`, `Username: email`, `ConfirmationCode: code`                                   |
| `AdminGetUser`             | IAM            | `verify-email`   | `UserPoolId`, `Username: email` — reads `custom:dni` and `sub`                            |
| `AdminAddUserToGroup`      | IAM            | `verify-email`   | `UserPoolId`, `Username: email`, `GroupName: "Member"`                                    |
| `AdminDeleteUser`          | IAM            | Rollback only    | `UserPoolId`, `Username: email`                                                            |
| `ResendConfirmationCode`   | App Client     | `resend-code`    | `ClientId`, `Username: email`                                                              |

> `SignUp`, `ConfirmSignUp`, and `ResendConfirmationCode` use the **App Client** (clientId) — no IAM credentials required for these calls.
> `AdminGetUser`, `AdminAddUserToGroup`, and `AdminDeleteUser` use **IAM credentials** (Lambda execution role).

### 7.5 IAM Permissions Required by Lambda Execution Role (Rev 2)

```
# AC-001 (registration)
cognito-idp:AdminGetUser
cognito-idp:AdminAddUserToGroup
cognito-idp:AdminDeleteUser

# AC-002 (login) — also applied to the same Lambda
cognito-idp:AdminInitiateAuth
cognito-idp:AdminRespondToAuthChallenge
```

**Removed from Rev 1:** `cognito-idp:AdminCreateUser`, `cognito-idp:AdminSetUserPassword`, `cognito-idp:ListUsersInGroup`

Scoped to the specific User Pool ARN only (least privilege).

---

## 8. Security Considerations

### 8.1 Input Sanitization

- All string inputs are trimmed of leading/trailing whitespace via `class-transformer` `@Transform`.
- Email is lowercased before any comparison or storage.
- DNI is matched case-insensitively (normalize to uppercase before lookup if alphanumeric DNIs are supported).
- No raw HTML or script content is accepted; the `ValidationPipe` with `whitelist: true` strips unknown properties.

### 8.2 Error Response Hardening

- Error messages must **never** reveal internal implementation details (table names, Lambda ARNs, stack traces).
- The `DNI_NOT_FOUND` and `ACCOUNT_INACTIVE` errors intentionally use vague phrasing ("contact administration") to prevent enumeration of member status by external actors.
- HTTP 500 responses return only a generic message.

### 8.3 Rate Limiting

- API Gateway throttling should be configured at the stage level: default 100 req/s burst, 50 req/s steady-state.
- The `/v1/auth/register` route can be additionally throttled to 10 req/s to mitigate registration abuse.
- Optionally, AWS WAF can be attached to API Gateway with a rate-based rule for the registration path. **Note:** AWS WAF incurs cost beyond Free Tier (~$5/month minimum); escalate to PO before enabling.

### 8.4 Password Handling

- The password is **never stored** by the Lambda or in DynamoDB. It is transmitted directly to Cognito via `AdminCreateUser` / `AdminSetUserPassword` over TLS.
- Lambda logs must be configured to **redact** the `password` field. Use AWS Lambda Powertools logger with a custom redaction pattern.

### 8.5 DNI as Sensitive Data

- The `SeedMembersTable` contains PII (DNI, full name). IAM policies must restrict read access to the `activa-club-members` Lambda execution role only.
- Enable DynamoDB encryption at rest (AWS-managed key) for both `SeedMembersTable` and `MembersTable`.
- Enable AWS CloudTrail for all DynamoDB API calls on these tables.

### 8.6 Cognito Client Configuration

- The Cognito App Client used by the frontend must **not** have the `AdminCreateUser` permission. All admin API calls are made from the Lambda using the Lambda execution role's IAM credentials, not client credentials.
- The App Client must enable `USER_PASSWORD_AUTH` flow only (not `ALLOW_USER_SRP_AUTH` at minimum for MVP; SRP is preferred long-term).

---

## 9. Infrastructure (Terraform)

All resources below reside in `infrastructure/envs/dev/` and reference reusable modules from `infrastructure/modules/`.

### 9.1 New Resources for AC-001

#### DynamoDB — SeedMembersTable

```hcl
# Module call: infrastructure/modules/dynamodb/
module "seed_members_table" {
  source      = "../../modules/dynamodb"
  table_name  = "SeedMembersTable"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "pk"
  attributes = [
    { name = "pk", type = "S" }
  ]

  tags = {
    Environment = var.env
    Service     = "members"
    ManagedBy   = "terraform"
  }
}
```

#### DynamoDB — MembersTable

```hcl
module "members_table" {
  source      = "../../modules/dynamodb"
  table_name  = "MembersTable"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "pk"
  range_key = "sk"

  attributes = [
    { name = "pk",               type = "S" },
    { name = "sk",               type = "S" },
    { name = "dni",              type = "S" },
    { name = "email",            type = "S" },
    { name = "cognito_user_id",  type = "S" },
  ]

  global_secondary_indexes = [
    {
      name            = "GSI_DNI"
      hash_key        = "dni"
      projection_type = "KEYS_ONLY"
    },
    {
      name            = "GSI_Email"
      hash_key        = "email"
      projection_type = "KEYS_ONLY"
    },
    {
      name            = "GSI_CognitoSub"
      hash_key        = "cognito_user_id"
      projection_type = "KEYS_ONLY"
    }
  ]

  tags = {
    Environment = var.env
    Service     = "members"
    ManagedBy   = "terraform"
  }
}
```

#### Lambda — activa-club-members

```hcl
module "members_lambda" {
  source        = "../../modules/lambda"
  function_name = "activa-club-members-${var.env}"
  handler       = "dist/infrastructure/handlers/lambda.handler"
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 15
  source_path   = "../../../backend/services/members"

  environment_variables = {
    ENV                   = var.env
    DYNAMODB_REGION       = var.aws_region
    MEMBERS_TABLE_NAME    = module.members_table.table_name
    SEED_MEMBERS_TABLE_NAME = module.seed_members_table.table_name
    COGNITO_USER_POOL_ID  = module.cognito.user_pool_id
    COGNITO_CLIENT_ID     = module.cognito.app_client_id
  }

  iam_policy_statements = [
    # DynamoDB permissions
    {
      effect    = "Allow"
      actions   = ["dynamodb:GetItem", "dynamodb:Query"]
      resources = [module.seed_members_table.table_arn]
    },
    {
      effect    = "Allow"
      actions   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem"]
      resources = [
        module.members_table.table_arn,
        "${module.members_table.table_arn}/index/*"
      ]
    },
    # Cognito Admin permissions
    {
      effect  = "Allow"
      actions = [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminDeleteUser",
      ]
      resources = [module.cognito.user_pool_arn]
    }
  ]

  tags = {
    Environment = var.env
    Service     = "members"
    ManagedBy   = "terraform"
  }
}
```

#### API Gateway — Routes (all public, no authorizer)

```hcl
# infrastructure/envs/dev/main.tf (or api-gateway module)

resource "aws_apigatewayv2_route" "register" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /v1/auth/register"
  target    = "integrations/${module.members_lambda.apigw_integration_id}"
  # authorization_type omitted → defaults to NONE (public route)
}

resource "aws_apigatewayv2_route" "verify_email" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /v1/auth/verify-email"
  target    = "integrations/${module.members_lambda.apigw_integration_id}"
}

resource "aws_apigatewayv2_route" "resend_code" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /v1/auth/resend-code"
  target    = "integrations/${module.members_lambda.apigw_integration_id}"
}
```

#### Cognito — User Pool (updated settings Rev 2)

```hcl
module "cognito" {
  source         = "../../modules/cognito"
  user_pool_name = "activa-club-${var.env}"

  password_policy = {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }

  # Rev 2: allow_self_registration = true (SignUp API used from backend Lambda)
  allow_self_registration  = true
  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  # Rev 2: Email MFA required for all users (AC-002)
  mfa_configuration = "ON"

  software_token_mfa_enabled = false  # Disable TOTP; email MFA only

  email_mfa_message = "Tu código de verificación ActivaClub es: {####}. Válido por 3 minutos."

  # Rev 2: Custom attribute to pass DNI through Cognito lifecycle
  schema_attributes = [
    {
      name                = "dni"
      attribute_data_type = "String"
      mutable             = false
      required            = false
      string_constraints = {
        min_length = 7
        max_length = 8
      }
    }
  ]

  groups = [
    { name = "Admin",   precedence = 1 },
    { name = "Manager", precedence = 2 },
    { name = "Member",  precedence = 3 },
  ]
}
```

### 9.2 Free Tier Impact Assessment

| Resource                   | Free Tier Limit                  | AC-001 Impact           | Risk  |
|----------------------------|----------------------------------|-------------------------|-------|
| DynamoDB (on-demand)       | 25 WCU / 25 RCU (provisioned) or 1M requests/month (on-demand) | Very low for dev        | Low   |
| Lambda                     | 1M invocations / month           | Very low for dev        | Low   |
| API Gateway HTTP API       | 1M API calls / month             | Very low for dev        | Low   |
| Cognito User Pool          | 50,000 MAU free                  | Well within dev limits  | Low   |
| CloudWatch Logs            | 5 GB ingestion free              | Monitor log verbosity   | Low   |

No paid services are introduced by AC-001.

---

## 10. Frontend Changes

### 10.1 New Pages (Rev 2 — Two-Step Flow)

```
frontend/src/pages/auth/
├── RegisterPage.tsx        # Step 1: DNI + email + password form
└── VerifyEmailPage.tsx     # Step 2: OTP input form
```

**Routes:**
- `/register` — public, no auth required
- `/verify-email` — public, but shows only if email state is present (from Step 1)

### 10.2 Component Structure

```
frontend/src/pages/auth/
├── RegisterPage.tsx               # Multi-step form orchestration
└── VerifyEmailPage.tsx            # OTP verification form

frontend/src/components/auth/
├── RegisterForm.tsx               # Step 1 controlled form
├── PasswordStrengthIndicator.tsx  # Visual password strength feedback
└── OtpInput.tsx                   # 6-digit OTP input (split fields)

frontend/src/api/
└── auth.api.ts                    # postRegister(), postVerifyEmail(), postResendCode()
```

### 10.3 Form Fields

**Step 1 — RegisterPage:**

| Field     | Input Type | Validation (client-side)                       |
|-----------|------------|------------------------------------------------|
| DNI       | text       | Required, 7–8 chars, alphanumeric              |
| Full Name | text       | Optional, 2–100 chars                          |
| Email     | email      | Required, valid email format                   |
| Password  | password   | Required, min 8 chars, pattern check           |
| Phone     | tel        | Optional, E.164 format hint                    |

**Step 2 — VerifyEmailPage:**

| Field | Input Type | Validation (client-side)              |
|-------|------------|---------------------------------------|
| Code  | text       | Required, exactly 6 numeric digits    |

### 10.4 Registration State Machine

```
State: IDLE
  → user submits form (Step 1)
State: SUBMITTING
  → POST /v1/auth/register
  → on HTTP 202: save { email } in state → navigate to VerifyEmailPage
  → on error: State: IDLE (display error)

State: AWAITING_VERIFICATION (in VerifyEmailPage)
  → user enters OTP
  → POST /v1/auth/verify-email { email, code }
  → on HTTP 201: navigate to /login with success toast
  → on HTTP 400 INVALID_CODE: show inline error (allow retry)
  → on HTTP 410 CODE_EXPIRED: show "Código expirado" + Resend button
  → user clicks Resend
  → POST /v1/auth/resend-code { email } → show success toast
```

### 10.5 Error Code to User Message Mapping

**Step 1 errors:**

| API Error Code              | User-facing Message (Spanish)                                                           |
|-----------------------------|-----------------------------------------------------------------------------------------|
| `VALIDATION_ERROR`          | Inline per-field errors from `details[]`                                                |
| `PASSWORD_POLICY_VIOLATION` | "La contraseña no cumple los requisitos. Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 caracter especial." |
| `DNI_NOT_FOUND`             | "Tu DNI no está registrado en el sistema. Por favor, contactá a la administración."     |
| `ACCOUNT_INACTIVE`          | "Tu membresía se encuentra inactiva. Contactá a la administración para regularizar."    |
| `DNI_ALREADY_REGISTERED`    | "Ya existe una cuenta con este DNI. Por favor, iniciá sesión."                          |
| `EMAIL_ALREADY_IN_USE`      | "Este email ya está asociado a una cuenta. Iniciá sesión o usá otro email."             |
| `INTERNAL_ERROR`            | "Ocurrió un error inesperado. Por favor, intentá de nuevo más tarde."                   |

**Step 2 errors:**

| API Error Code       | User-facing Message (Spanish)                                                           |
|----------------------|-----------------------------------------------------------------------------------------|
| `INVALID_CODE`       | "El código ingresado es incorrecto. Verificá tu email e intentalo de nuevo."            |
| `CODE_EXPIRED`       | "El código expiró. Solicitá uno nuevo usando el botón 'Reenviar código'."               |
| `TOO_MANY_ATTEMPTS`  | "Demasiados intentos fallidos. Por favor, volvé a registrarte."                         |
| `INTERNAL_ERROR`     | "Ocurrió un error al activar tu cuenta. Contactá a soporte."                            |

### 10.6 State Management

- Form state: React Hook Form.
- API calls: React Query `useMutation` in `auth.api.ts`.
- Email passed between steps: component state (prop or React Router `location.state`).
- Auth store (Zustand): **not updated** during registration — member must complete login (AC-002) separately.

### 10.7 Router Configuration

```
frontend/src/router/index.tsx

Public routes:
  <Route path="/register"     element={<RegisterPage />} />
  <Route path="/verify-email" element={<VerifyEmailPage />} />

Both wrapped with PublicOnlyRoute guard (redirect to /dashboard if already authenticated).
```

---

## 11. Open Questions

| #  | Question | Status | Owner | Impact |
|----|----------|--------|-------|--------|
| 1  | **Cognito email sender:** Cognito's default email uses SES sandbox (limited to verified addresses). For production, SES must be moved out of sandbox. Should this be configured in dev now? | Open | DevOps | Affects email deliverability in dev |
| 2  | **DNI format:** Is the Argentine DNI always 7–8 numeric digits, or can it include letters? The current regex `/^[0-9A-Za-z]+$/` is permissive. Should it be tightened to digits only? | Open | PO / Business | Affects DTO validation and seed data format |
| 3  | **`full_name` source of truth:** If the member provides a `full_name` different from the seed record, which takes precedence? Current design: request value wins; seed used if omitted. | Open | PO | Affects data consistency with legacy records |
| 4  | **Seed record cleanup:** After successful registration, should the seed record be marked (e.g., `onboarded = true`) to prevent parallel re-registration attempts? `SeedMembersTable` is currently write-protected from Lambda. | Open | Architect / PO | Affects SeedMembersTable write permissions |
| 5  | **Rate limiting / WAF:** Is AWS WAF within budget for dev? API Gateway throttling alone is sufficient for MVP. | Open | PO / Budget | Cost: ~$5/month minimum for WAF |
| 6  | **Email verification flow:** ~~Deferred.~~ **RESOLVED** — Email verification via Cognito OTP is now **required** (not optional). `mfa_configuration = ON` + `auto_verified_attributes = ["email"]` enforces this. Accounts remain `UNCONFIRMED` until OTP is entered. | Resolved | Architect | — |
| 7  | **`SeedMembersTable` co-location:** Is the seed table always in the same AWS account/region as application DynamoDB tables, or does the legacy import target a different account? | Open | DevOps | Affects IAM and cross-account config |
| 8  | **`allow_self_registration = true` risk:** With `SignUp` API enabled, someone with the `clientId` could attempt to call Cognito `SignUp` directly (bypassing Lambda). Mitigation: add a Cognito pre-signup Lambda trigger that validates `custom:dni` exists in SeedMembersTable. Recommended for production hardening. | Open (post-MVP) | Architect | Security posture vs. implementation complexity |

---

*Document maintained by the Senior Software & Cloud Architect agent. Review required before implementation begins.*
