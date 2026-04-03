# AC-002 Technical Design: Member Login with OTP

**Epic:** EP-01 - Member Onboarding
**Story Points:** 8
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-02-27
**Last Updated:** 2026-04-03
**Depends on:** AC-001-design.md (Cognito User Pool + MembersTable must exist)

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Context](#2-system-context)
3. [API Contract](#3-api-contract)
4. [Architecture Flow](#4-architecture-flow)
5. [Lambda Design](#5-lambda-design)
6. [Cognito Configuration](#6-cognito-configuration)
7. [Security Considerations](#7-security-considerations)
8. [Infrastructure (Terraform)](#8-infrastructure-terraform)
9. [Frontend Changes](#9-frontend-changes)
10. [Edge Cases](#10-edge-cases)
11. [Open Questions](#11-open-questions)

---

## 1. Overview

This document describes the technical design for **AC-002: Member Login with OTP**, the authentication entry point for all member interactions post-registration.

The login flow is implemented as a **two-step challenge** using Amazon Cognito's native Email MFA capability:

1. **Step 1 — Credential validation:** The member submits email + password. The backend calls Cognito's `AdminInitiateAuth`. If credentials are valid and MFA is required, Cognito returns an `EMAIL_OTP` challenge and sends a 6-digit code to the member's verified email.

2. **Step 2 — OTP verification:** The member submits the 6-digit OTP along with the session token received in Step 1. The backend calls `AdminRespondToAuthChallenge`. On success, Cognito returns `AccessToken`, `IdToken`, and `RefreshToken`.

**Design principle:** The backend Lambda (`activa-club-members`) is the **sole intermediary** between the frontend and Cognito for all auth operations. The frontend never calls Cognito APIs directly. This ensures business rules (account status checks, audit logging) are enforced before tokens are issued.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cognito auth flow | `AdminInitiateAuth` with `ADMIN_USER_PASSWORD_AUTH` (IAM-authenticated) | Prevents frontend from bypassing backend logic; enables server-side account validation |
| MFA delivery | Cognito Email OTP | Native, no SMS costs, uses verified email from AC-001 registration |
| MFA mode | `ON` (required for all users) | Security requirement from AC-002 story; consistent experience |
| Session token storage | Frontend memory (JavaScript variable) | OTP session is short-lived (3 min); no need to persist |
| Access/ID token storage | `httpOnly` cookie (recommended) or in-memory | Prevents XSS token theft; never `localStorage` |

---

## 2. System Context

AC-002 touches the following infrastructure layers:

```
Member (browser)
        |
        | HTTPS POST /v1/auth/login      [Step 1 - no auth token]
        | HTTPS POST /v1/auth/verify-otp [Step 2 - no auth token]
        v
Amazon CloudFront --> React SPA (S3)
        |
        | API call
        v
Amazon API Gateway HTTP API
  - Route: POST /v1/auth/login      → NO JWT Authorizer (public)
  - Route: POST /v1/auth/verify-otp → NO JWT Authorizer (public)
        |
        v
AWS Lambda: activa-club-members-dev
  [NestJS, Clean Architecture]
        |
        |-- AdminInitiateAuth ---------> Amazon Cognito User Pool
        |                                   |-- EMAIL_OTP challenge
        |                                   |-- Sends OTP to member email
        |
        |-- AdminRespondToAuthChallenge -> Amazon Cognito User Pool
                                            |-- Validates OTP
                                            |-- Returns tokens

(Optional pre-login check):
        |-- Query GSI_CognitoSub ------> DynamoDB: MembersTable
                                         (verify account_status before auth attempt)
```

> **Note on optional DynamoDB pre-check:** Before calling `AdminInitiateAuth`, the Lambda *may* query `MembersTable` by email to validate `account_status = "active"`. This adds one DynamoDB read per login attempt but enables the backend to return a more informative error for suspended accounts before consuming a Cognito auth attempt. This is a design-time tradeoff discussed in [Section 11](#11-open-questions).

---

## 3. API Contract

### 3.1 Endpoint: POST /v1/auth/login (Step 1 — Credential Validation)

| Property      | Value                          |
|---------------|--------------------------------|
| Method        | `POST`                         |
| Path          | `/v1/auth/login`               |
| Authorization | None (public route)            |
| Lambda        | `activa-club-members-dev`      |
| Content-Type  | `application/json`             |

#### Request Body

```json
{
  "email": "string",
  "password": "string"
}
```

| Field      | Type   | Required | Constraints                                |
|------------|--------|----------|--------------------------------------------|
| `email`    | string | Yes      | Valid RFC 5322 email. Lowercased before use.|
| `password` | string | Yes      | Non-empty. Min 1 char (Cognito validates). |

#### Example Request

```json
{
  "email": "martin.garcia@email.com",
  "password": "SecurePass1!"
}
```

#### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "challengeName": "EMAIL_OTP",
    "session": "<cognito_session_token_opaque_string>",
    "message": "A verification code has been sent to your email."
  }
}
```

> The `session` value is an opaque string issued by Cognito, valid for **3 minutes**. The frontend must include it in the Step 2 request.

#### Error Responses

**HTTP 401 — Invalid credentials (generic; covers both wrong email and wrong password)**

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "The email or password is incorrect. Please try again.",
    "details": []
  }
}
```

**HTTP 403 — Account not confirmed (UNCONFIRMED in Cognito)**

```json
{
  "status": "error",
  "error": {
    "code": "ACCOUNT_NOT_CONFIRMED",
    "message": "Your account email has not been verified. Please complete registration to activate your account.",
    "details": []
  }
}
```

**HTTP 403 — Account disabled (disabled by Admin)**

```json
{
  "status": "error",
  "error": {
    "code": "ACCOUNT_DISABLED",
    "message": "Your account has been disabled. Please contact club administration.",
    "details": []
  }
}
```

**HTTP 429 — Too many failed attempts (Cognito rate-limiting or account lockout)**

```json
{
  "status": "error",
  "error": {
    "code": "TOO_MANY_ATTEMPTS",
    "message": "Too many login attempts. Please wait a few minutes before trying again.",
    "details": []
  }
}
```

---

### 3.2 Endpoint: POST /v1/auth/verify-otp (Step 2 — OTP Challenge Response)

| Property      | Value                          |
|---------------|--------------------------------|
| Method        | `POST`                         |
| Path          | `/v1/auth/verify-otp`          |
| Authorization | None (public route)            |
| Lambda        | `activa-club-members-dev`      |
| Content-Type  | `application/json`             |

#### Request Body

```json
{
  "email": "string",
  "session": "string",
  "otp": "string"
}
```

| Field     | Type   | Required | Constraints                                     |
|-----------|--------|----------|-------------------------------------------------|
| `email`   | string | Yes      | Must match the email used in Step 1.            |
| `session` | string | Yes      | Opaque session token received from Step 1.      |
| `otp`     | string | Yes      | Exactly 6 numeric digits. Example: `"482917"`.  |

#### Example Request

```json
{
  "email": "martin.garcia@email.com",
  "session": "<cognito_session_token>",
  "otp": "482917"
}
```

#### Success Response — HTTP 200

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

> **Security note:** The frontend must store `accessToken` and `idToken` in memory or `httpOnly` cookies — **never in `localStorage`** (XSS risk). The `refreshToken` should only be stored in an `httpOnly` cookie if silent refresh is implemented.

#### Error Responses

**HTTP 400 — OTP code incorrect**

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_OTP",
    "message": "The verification code is incorrect. Please try again.",
    "details": []
  }
}
```

**HTTP 410 — Session expired (Cognito session token TTL exceeded)**

```json
{
  "status": "error",
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Your verification session has expired. Please start the login process again.",
    "details": []
  }
}
```

**HTTP 429 — Too many OTP attempts in the same session**

```json
{
  "status": "error",
  "error": {
    "code": "TOO_MANY_ATTEMPTS",
    "message": "Too many incorrect codes. Please start the login process again.",
    "details": []
  }
}
```

---

## 4. Architecture Flow

### 4.1 Complete Two-Step Login Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser / React SPA
    participant APIGW as API Gateway HTTP API
    participant Lambda as activa-club-members Lambda
    participant MembersDB as DynamoDB MembersTable
    participant Cognito as Amazon Cognito User Pool

    Note over Client,Cognito: ── STEP 1: Credential Validation ──

    Client->>APIGW: POST /v1/auth/login { email, password }
    Note over APIGW: No JWT authorizer on this route
    APIGW->>Lambda: Invoke with HTTP event payload

    Lambda->>Lambda: 1. Parse & validate request body (DTO)
    alt Validation fails (empty email/password)
        Lambda-->>Client: HTTP 400 VALIDATION_ERROR
    end

    Lambda->>Lambda: 2. Lowercase email
    Lambda->>Cognito: 3. AdminInitiateAuth { AuthFlow: USER_PASSWORD_AUTH, AuthParameters: { USERNAME: email, PASSWORD: password } }

    alt NotAuthorizedException (wrong password)
        Cognito-->>Lambda: NotAuthorizedException
        Lambda-->>Client: HTTP 401 INVALID_CREDENTIALS
    end
    alt UserNotConfirmedException (UNCONFIRMED account)
        Cognito-->>Lambda: UserNotConfirmedException
        Lambda-->>Client: HTTP 403 ACCOUNT_NOT_CONFIRMED
    end
    alt UserNotFoundException (email not in Cognito)
        Cognito-->>Lambda: UserNotFoundException
        Lambda-->>Client: HTTP 401 INVALID_CREDENTIALS (generic — no user enumeration)
    end
    alt TooManyRequestsException
        Cognito-->>Lambda: TooManyRequestsException
        Lambda-->>Client: HTTP 429 TOO_MANY_ATTEMPTS
    end

    Cognito->>Client: Sends EMAIL_OTP code to member's verified email
    Cognito-->>Lambda: 4. { ChallengeName: EMAIL_OTP, Session: <session_token>, ChallengeParameters: { email } }

    Lambda-->>APIGW: HTTP 200 { challengeName, session, message }
    APIGW-->>Client: HTTP 200 (session token + instructions to enter OTP)

    Note over Client,Cognito: ── STEP 2: OTP Verification ──

    Client->>APIGW: POST /v1/auth/verify-otp { email, session, otp }
    APIGW->>Lambda: Invoke

    Lambda->>Lambda: 5. Validate request body (email, session, otp format)
    alt Validation fails (otp not 6 digits)
        Lambda-->>Client: HTTP 400 VALIDATION_ERROR
    end

    Lambda->>Cognito: 6. AdminRespondToAuthChallenge { ChallengeName: EMAIL_OTP, Session: session, ChallengeResponses: { EMAIL_OTP_CODE: otp, USERNAME: email } }

    alt CodeMismatchException (wrong OTP)
        Cognito-->>Lambda: CodeMismatchException
        Lambda-->>Client: HTTP 400 INVALID_OTP
    end
    alt ExpiredCodeException (session expired)
        Cognito-->>Lambda: ExpiredCodeException
        Lambda-->>Client: HTTP 410 SESSION_EXPIRED
    end
    alt TooManyRequestsException (too many attempts)
        Cognito-->>Lambda: TooManyRequestsException
        Lambda-->>Client: HTTP 429 TOO_MANY_ATTEMPTS
    end

    Cognito-->>Lambda: 7. { AuthenticationResult: { AccessToken, IdToken, RefreshToken, ExpiresIn } }

    Lambda-->>APIGW: HTTP 200 { accessToken, idToken, refreshToken, expiresIn, tokenType }
    APIGW-->>Client: HTTP 200 — Login complete; tokens issued

    Note over Client: Frontend stores tokens in memory / httpOnly cookie
    Note over Client: Redirects to /dashboard
```

### 4.2 Error Mapping from Cognito Exceptions

| Cognito Exception              | HTTP Status | Error Code             | Notes                                       |
|-------------------------------|-------------|------------------------|---------------------------------------------|
| `NotAuthorizedException`       | 401         | `INVALID_CREDENTIALS`  | Wrong password; intentionally generic       |
| `UserNotFoundException`        | 401         | `INVALID_CREDENTIALS`  | Email not found; same message as above      |
| `UserNotConfirmedException`    | 403         | `ACCOUNT_NOT_CONFIRMED`| UNCONFIRMED state — didn't complete AC-001  |
| `NotAuthorizedException` (disabled) | 403  | `ACCOUNT_DISABLED`     | Admin disabled the account                  |
| `TooManyRequestsException`     | 429         | `TOO_MANY_ATTEMPTS`    | Cognito rate limiter or lockout             |
| `CodeMismatchException`        | 400         | `INVALID_OTP`          | Wrong OTP in step 2                         |
| `ExpiredCodeException`         | 410         | `SESSION_EXPIRED`      | Cognito session > 3 minutes                 |

> **User enumeration prevention:** `UserNotFoundException` and `NotAuthorizedException` (wrong password) MUST return the same HTTP 401 body (`INVALID_CREDENTIALS`) so that an attacker cannot determine whether an email address is registered.

---

## 5. Lambda Design

### 5.1 Service Location

```
backend/services/members/
```

The login use cases are added to the existing `activa-club-members` Lambda to avoid a separate Lambda for auth-only operations. Both `RegisterMemberHandler` (AC-001) and `LoginHandler` / `VerifyOtpHandler` (AC-002) live in the same service.

### 5.2 New Files for AC-002

```
backend/services/members/src/
├── application/
│   └── commands/
│       ├── login/
│       │   ├── login.command.ts             # { email, password }
│       │   ├── login.handler.ts             # Calls CognitoService.adminInitiateAuth
│       │   └── login.result.ts              # { challengeName, session }
│       └── verify-otp/
│           ├── verify-otp.command.ts        # { email, session, otp }
│           ├── verify-otp.handler.ts        # Calls CognitoService.adminRespondToAuthChallenge
│           └── verify-otp.result.ts         # { accessToken, idToken, refreshToken, expiresIn }
├── infrastructure/
│   └── cognito/
│       └── cognito.service.ts               # Extended: adminInitiateAuth (ADMIN_USER_PASSWORD_AUTH), adminRespondToAuthChallenge
└── presentation/
    ├── controllers/
    │   └── auth.controller.ts               # Add: POST /v1/auth/login, POST /v1/auth/verify-otp
    └── dtos/
        ├── login.request.dto.ts             # (LoginRequestDto)
        ├── login.response.dto.ts            # (LoginDataDto)
        ├── verify-otp.request.dto.ts        # (VerifyOtpRequestDto)
        └── verify-otp.response.dto.ts       # (VerifyOtpDataDto)
```

### 5.3 Key Type Definitions

**login-member.request.dto.ts**

```typescript
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginMemberRequestDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
```

**verify-otp.request.dto.ts**

```typescript
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpRequestDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  session: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 numeric digits' })
  otp: string;
}
```

**login.handler.ts (use case skeleton)**

```typescript
@Injectable()
export class LoginHandler {
  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    try {
      const result = await this.cognitoService.adminInitiateAuth(
        command.email,
        command.password,
        // Uses ADMIN_USER_PASSWORD_AUTH flow — requires Lambda IAM role
      );

      // Cognito returns EMAIL_OTP challenge when MFA is required
      if (result.ChallengeName !== 'EMAIL_OTP') {
        // Unexpected challenge; should not happen with proper Cognito config
        throw new UnexpectedAuthChallengeException(result.ChallengeName);
      }

      return new LoginResult({
        challengeName: result.ChallengeName,
        session: result.Session,
      });
    } catch (error) {
      if (error.name === 'NotAuthorizedException') throw new InvalidCredentialsException();
      if (error.name === 'UserNotFoundException') throw new InvalidCredentialsException(); // generic — no enum
      if (error.name === 'UserNotConfirmedException') throw new AccountNotConfirmedException();
      if (error.name === 'TooManyRequestsException') throw new TooManyAttemptsException();
      throw error;
    }
  }
}
```

**verify-otp.handler.ts (use case skeleton)**

```typescript
@Injectable()
export class VerifyOtpHandler {
  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    try {
      const result = await this.cognitoService.adminRespondToAuthChallenge(
        command.email,
        command.session,
        command.otp,
      );

      const auth = result.AuthenticationResult;
      return new VerifyOtpResult({
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: 'Bearer',
      });
    } catch (error) {
      if (error.name === 'CodeMismatchException') throw new InvalidOtpException();
      if (error.name === 'ExpiredCodeException') throw new SessionExpiredException();
      if (error.name === 'TooManyRequestsException') throw new TooManyAttemptsException();
      throw error;
    }
  }
}
```

### 5.4 CognitoService Extensions (in cognito.service.ts)

```typescript
// New methods added to the existing CognitoService class

async adminInitiateAuth(email: string, password: string) {
  return this.client.send(new AdminInitiateAuthCommand({
    UserPoolId: this.userPoolId,
    ClientId: this.clientId,
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  }));
}

async adminRespondToAuthChallenge(email: string, session: string, otp: string) {
  return this.client.send(new AdminRespondToAuthChallengeCommand({
    UserPoolId: this.userPoolId,
    ClientId: this.clientId,
    ChallengeName: 'EMAIL_OTP',
    Session: session,
    ChallengeResponses: {
      USERNAME: email,
      EMAIL_OTP_CODE: otp,
    },
  }));
}
```

### 5.5 New Domain Exceptions for AC-002

| Exception Class                  | HTTP Status | Error Code              |
|-----------------------------------|-------------|-------------------------|
| `InvalidCredentialsException`     | 401         | `INVALID_CREDENTIALS`   |
| `AccountNotConfirmedException`    | 403         | `ACCOUNT_NOT_CONFIRMED` |
| `AccountDisabledException`        | 403         | `ACCOUNT_DISABLED`      |
| `InvalidOtpException`             | 400         | `INVALID_OTP`           |
| `SessionExpiredException`         | 410         | `SESSION_EXPIRED`       |
| `TooManyAttemptsException`        | 429         | `TOO_MANY_ATTEMPTS`     |
| `UnexpectedAuthChallengeException`| 500         | `INTERNAL_ERROR`        |

All exceptions inherit from the base domain error hierarchy in `backend/libs/errors/`.

---

## 6. Cognito Configuration

### 6.1 User Pool Settings Relevant to AC-002

The following settings are **additive** to what was established in AC-001. The Cognito module in `infrastructure/modules/cognito/` must be updated.

| Setting                          | Old Value (AC-001) | New Value (AC-002) | Rationale                                              |
|----------------------------------|--------------------|--------------------|--------------------------------------------------------|
| `mfa_configuration`              | `OFF`              | `ON`               | Email MFA required for all members                     |
| `email_mfa_configuration`        | Not set            | Enabled with custom message | Delivers 6-digit OTP to verified email      |
| `software_token_mfa_configuration.enabled` | Not set | `false`            | Disable TOTP; use email MFA exclusively                |

> **MFA mode `ON` vs `OPTIONAL`:** Setting `mfa_configuration = "ON"` makes MFA mandatory for every user. Since all members register with a verified email (AC-001), this is viable. If `OPTIONAL` were chosen, users who skip MFA setup could log in without it. For the security requirement in AC-002, `ON` is the correct choice.

### 6.2 Email MFA Message Template

The OTP email sent by Cognito is configurable:

```
Subject: Tu código de acceso ActivaClub
Body: Tu código de verificación es: {####}. Válido por 3 minutos. No lo compartas con nadie.
```

> `{####}` is Cognito's placeholder for the generated 6-digit code.

### 6.3 Cognito API Calls Made by Lambda

| Cognito API Call                 | Auth Method | When Called                          | Parameters                                                                      |
|----------------------------------|-------------|--------------------------------------|---------------------------------------------------------------------------------|
| `AdminInitiateAuth`              | IAM         | Step 1 — credential submission       | `AuthFlow: USER_PASSWORD_AUTH`, `USERNAME: email`, `PASSWORD: password`         |
| `AdminRespondToAuthChallenge`    | IAM         | Step 2 — OTP submission              | `ChallengeName: EMAIL_OTP`, `Session: session`, `EMAIL_OTP_CODE: otp`, `USERNAME: email` |

### 6.4 IAM Permissions Required by Lambda Execution Role (AC-002 additions)

```
cognito-idp:AdminInitiateAuth
cognito-idp:AdminRespondToAuthChallenge
```

These are **added** to the existing permissions from AC-001.

### 6.5 Cognito Token Configuration

| Token            | Default TTL | Notes                                                       |
|------------------|-------------|-------------------------------------------------------------|
| `AccessToken`    | 60 minutes  | Used to call protected API endpoints (Authorization header) |
| `IdToken`        | 60 minutes  | Contains user claims: `sub`, `email`, `cognito:groups`      |
| `RefreshToken`   | 30 days     | Used to obtain new access/ID tokens silently                |
| OTP Session      | 3 minutes   | Cognito challenge session; expired sessions return 410      |

The API Gateway JWT Authorizer validates `IdToken` on all protected routes (see architecture overview).

---

## 7. Security Considerations

### 7.1 User Enumeration Prevention

`UserNotFoundException` and `NotAuthorizedException` (wrong password) MUST map to the **same** HTTP 401 response body with error code `INVALID_CREDENTIALS`. The Lambda's exception handler must not leak which condition triggered the 401. This is enforced at the handler level, not the global exception filter.

### 7.2 OTP Brute Force Protection

Cognito limits the number of incorrect OTP attempts per session. After 3 incorrect attempts, the session is invalidated and Cognito returns `TooManyRequestsException` → HTTP 429. The member must restart the login flow from Step 1.

### 7.3 Session Token Handling

- The `session` token from Cognito is an opaque, time-limited string. It must be treated as sensitive; losing it means the member re-authenticates from Step 1.
- The frontend must keep the session token in memory only (not persisted to storage).

### 7.4 Token Storage (Frontend)

| Token          | Storage Strategy      | Rationale                                 |
|----------------|-----------------------|-------------------------------------------|
| `accessToken`  | Memory (JS variable)  | Cleared on page refresh; safe from XSS   |
| `idToken`      | Memory (JS variable)  | Same — used for API calls                |
| `refreshToken` | `httpOnly` cookie     | Cannot be read by JS; survives refresh   |

> Silent token refresh (using `refreshToken`) is deferred to a future story. For MVP, the member re-authenticates after the `accessToken` expires (60 min).

### 7.5 Rate Limiting

- API Gateway stage-level throttling: 50 req/s steady-state, 100 req/s burst (shared with all routes).
- The `/v1/auth/login` route can be additionally throttled to **5 req/s** per source IP to mitigate credential stuffing.
- Cognito's built-in account lockout (after N failed attempts) provides a second layer.

### 7.6 Password Never Logged

- Lambda Powertools logger must redact the `password` field. The `POST /v1/auth/login` handler must not log the raw request body.
- Tokens returned by Cognito must not appear in CloudWatch logs. Redact `AuthenticationResult.*` in log outputs.

---

## 8. Infrastructure (Terraform)

### 8.1 Updated Cognito Module — MFA Settings

```hcl
# infrastructure/modules/cognito/main.tf
resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name

  # ... existing settings from AC-001 ...

  mfa_configuration = "ON"

  software_token_mfa_configuration {
    enabled = false   # Disable TOTP; email MFA only
  }

  # Email MFA (requires AWS provider >= 5.50)
  email_mfa_configuration {
    message = var.email_mfa_message
  }

  # ... rest of existing settings ...
}
```

**Variable added to cognito module:**

```hcl
variable "email_mfa_message" {
  type        = string
  description = "Message template for email MFA OTP. Must include {####} placeholder."
  default     = "Tu código de verificación ActivaClub es: {####}. Válido por 3 minutos."
}
```

### 8.2 Updated Lambda IAM Policy — New Cognito Permissions

```hcl
# Addition to members_lambda iam_policy_statements in infrastructure/envs/dev/main.tf
{
  effect  = "Allow"
  actions = [
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:AdminRespondToAuthChallenge",
  ]
  resources = [module.cognito.user_pool_arn]
}
```

Combined IAM block for `activa-club-members` Lambda (all Cognito permissions AC-001 + AC-002):

```hcl
{
  effect  = "Allow"
  actions = [
    # AC-001: Registration + Email Verification
    "cognito-idp:AdminAddUserToGroup",
    "cognito-idp:AdminDeleteUser",
    "cognito-idp:AdminGetUser",
    # AC-002: Login + OTP
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:AdminRespondToAuthChallenge",
  ]
  resources = [module.cognito.user_pool_arn]
}
```

> Note: `AdminCreateUser` and `AdminSetUserPassword` are **removed** from the AC-001 update; the new `SignUp`-based flow does not require them.

### 8.3 New API Gateway Routes

```hcl
# infrastructure/envs/dev/main.tf (or api-gateway module)

resource "aws_apigatewayv2_route" "login" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /v1/auth/login"
  target    = "integrations/${module.members_lambda.apigw_integration_id}"
  # No authorization_type — public route
}

resource "aws_apigatewayv2_route" "verify_otp" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /v1/auth/verify-otp"
  target    = "integrations/${module.members_lambda.apigw_integration_id}"
  # No authorization_type — public route
}
```

### 8.4 Free Tier Impact Assessment (AC-002 additions)

| Resource             | Free Tier Limit          | AC-002 Impact                              | Risk |
|----------------------|--------------------------|--------------------------------------------|------|
| Cognito MFA          | Included in 50,000 MAU   | Email MFA is free (not Advanced Security)  | Low  |
| Lambda invocations   | 1M/month                 | 2 additional invocations per login attempt | Low  |
| API Gateway          | 1M calls/month           | 2 additional calls per login attempt       | Low  |
| SES (email delivery) | Cognito sends via internal SES (no cost to user for Cognito MFA emails) | | Low |

No paid services are introduced by AC-002.

---

## 9. Frontend Changes

### 9.1 New Pages and Components

```
frontend/src/pages/auth/
├── LoginPage.tsx              # Step 1: email + password form
└── VerifyOtpPage.tsx          # Step 2: OTP input form

frontend/src/components/auth/
├── LoginForm.tsx              # Controlled form: email + password
└── OtpInput.tsx               # 6-digit OTP input (split or single field)

frontend/src/api/
└── auth.api.ts                # Add: postLogin(), postVerifyOtp()
```

### 9.2 Login State Machine

The two-step login flow is managed by a lightweight state machine in `LoginPage.tsx`:

```
State: IDLE
  → user submits email + password
State: SUBMITTING_CREDENTIALS
  → POST /v1/auth/login
  → on HTTP 200: save { session, email } in component state → State: AWAITING_OTP
  → on error: State: IDLE (display error)
State: AWAITING_OTP
  → user enters OTP
  → POST /v1/auth/verify-otp { email, session, otp }
  → on HTTP 200: store tokens → redirect to /dashboard
  → on HTTP 400/410/429: display error (allow retry or restart)
```

### 9.3 Router Changes

```
frontend/src/router/index.tsx

Public routes:
  <Route path="/login"      element={<LoginPage />} />
  <Route path="/verify-otp" element={<VerifyOtpPage />} />
    Note: VerifyOtpPage renders only if session token is present in component state;
          otherwise redirects back to /login.
```

> **Alternative:** Implement both steps in a single `LoginPage.tsx` using a multi-step form (step 1 form → step 2 form), avoiding a route change. This simplifies state passing (no URL params or `sessionStorage` needed). Recommended for MVP.

### 9.4 Error Code to User Message Mapping

| API Error Code         | User-facing Message (Spanish)                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------|
| `INVALID_CREDENTIALS`  | "El email o la contraseña son incorrectos. Por favor, verificá tus datos."                          |
| `ACCOUNT_NOT_CONFIRMED`| "Tu cuenta no está verificada. Revisá tu email y completá el registro."                             |
| `ACCOUNT_DISABLED`     | "Tu cuenta ha sido deshabilitada. Contactá a la administración del club."                           |
| `TOO_MANY_ATTEMPTS`    | "Demasiados intentos. Por favor, esperá unos minutos antes de volver a intentarlo."                 |
| `INVALID_OTP`          | "El código ingresado es incorrecto. Verificá tu email e intentalo de nuevo."                        |
| `SESSION_EXPIRED`      | "El tiempo de verificación expiró. Por favor, iniciá sesión nuevamente."                            |

### 9.5 Auth Store Update (Zustand)

```
frontend/src/store/auth.store.ts

Fields (implemented):
  - user: CognitoUser | null   (sub, username, email, role — decoded from idToken claims)
  - idToken: string | null     (kept in memory only — NOT persisted to localStorage)
  - isAuthenticated: boolean
  - isLoading: boolean

Actions:
  - setTokens(idToken: string): void   (decodes JWT, builds CognitoUser, sets isAuthenticated)
  - login(user: CognitoUser): void
  - logout(): void
  - clearAuth(): void
  - setLoading(loading: boolean): void
  - updateUser(partial: Partial<CognitoUser>): void

Persistence (zustand/persist — localStorage key: "activa-club-auth"):
  - Persisted: user profile only (for display — e.g. welcome messages on refresh)
  - NOT persisted: idToken, isAuthenticated (JWT must not survive page reload per AC-006/AC-007)
  - On page refresh: isAuthenticated resets to false; user re-authenticates
```

---

## 10. Edge Cases

| Scenario                                      | Expected Behavior                                                                                  |
|-----------------------------------------------|----------------------------------------------------------------------------------------------------|
| User registered but never verified email      | `UserNotConfirmedException` → HTTP 403 `ACCOUNT_NOT_CONFIRMED`. User directed to re-verify.       |
| Admin disables a Cognito user                 | `NotAuthorizedException` with message "User is disabled." → HTTP 403 `ACCOUNT_DISABLED`.          |
| User submits Step 2 after session TTL (3 min) | Cognito returns `ExpiredCodeException` → HTTP 410 `SESSION_EXPIRED`. Full restart required.        |
| User calls verify-otp without calling login   | Invalid/missing session → Cognito `NotAuthorizedException` → HTTP 401 `INVALID_CREDENTIALS`.      |
| Concurrent login attempts from same user      | Each `AdminInitiateAuth` issues a new session; only the latest session is valid.                  |
| MFA not set up (should not happen with MFA=ON)| If Cognito somehow returns tokens directly (no challenge), Lambda returns 500 `INTERNAL_ERROR`.    |
| Cognito email OTP delivery fails              | Out of Lambda control; Cognito handles delivery; member can restart login after 3 minutes.         |

---

## 11. Open Questions

| #  | Question | Status | Resolution |
|----|----------|--------|------------|
| 1  | **DynamoDB pre-check before `AdminInitiateAuth`:** Should the Lambda query `MembersTable` by email before calling Cognito to check `account_status`? | **Resolved** | Not implemented for MVP. Cognito's own `NotAuthorizedException` (disabled message) covers the account-disabled case. Pre-check deferred to future story. |
| 2  | **Silent token refresh:** Should the frontend implement silent refresh via `RefreshToken` for MVP? | **Resolved** | Deferred to post-MVP. User re-authenticates after 60-minute access token expiry. |
| 3  | **Logout endpoint:** Should there be a `POST /v1/auth/logout` that calls `AdminUserGlobalSignOut`? | **Open** | Deferred. Frontend clears local state on logout; server-side token revocation is a post-MVP story. |
| 4  | **MFA mode `ON` vs `OPTIONAL`:** With `mfa_configuration = ON`, Admin and Manager users also require email MFA. | **Resolved** | `mfa_configuration = ON` applied to all users. Group-level MFA exclusion requires a custom Lambda trigger — deferred to post-MVP. |
| 5  | **`AdminInitiateAuth` vs `InitiateAuth`:** IAM-authenticated vs App Client only. | **Resolved** | `AdminInitiateAuth` with `ADMIN_USER_PASSWORD_AUTH` was required. `USER_PASSWORD_AUTH` via `InitiateAuth` does not support Email MFA challenge in the same flow. Fix applied in commit `f8ed6fa`. |

---

*Document maintained by the Senior Software & Cloud Architect agent. Updated 2026-03-29 to reflect implemented state.*
