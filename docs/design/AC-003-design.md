# AC-003 Technical Design: Email Verification (ConfirmSignUp)

**Epic:** EP-01 - Member Onboarding
**Story Points:** 5
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-002 (user exists in Cognito with status UNCONFIRMED)

---

## 1. Overview

After registration (AC-002), the user receives a 6-digit OTP via email (delivered by CustomEmailSender Lambda → KMS → SES). This endpoint confirms the user's email in Cognito, creates their profile in MembersTable, and assigns them the `Member` group.

---

## 2. API Contract

### POST /v1/auth/verify-email

**Request:**
```json
{ "email": "user@example.com", "code": "123456" }
```

**Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 201 | — | Account activated, profile created |
| 400 | `INVALID_CODE` | OTP does not match |
| 410 | `CODE_EXPIRED` | OTP TTL (24h) exceeded |
| 404 | `USER_NOT_FOUND` | Email not registered in Cognito |

### POST /v1/auth/resend-code

**Request:**
```json
{ "email": "user@example.com" }
```

**Responses:**

| Status | Description |
|--------|-------------|
| 200 | New OTP sent |
| 400 | `USER_ALREADY_CONFIRMED` — account already active |

---

## 3. Lambda Design

**Module:** `activa-club-members` — `AuthController`

**verify-email flow:**
1. `ConfirmSignUp { email, code }` → Cognito
2. On success: `AdminGetUser` to read `custom:dni` and `sub`
3. `GetItem` on SeedMembersTable to read `membership_type`
4. `AdminAddUserToGroup { GroupName: "Member" }` → Cognito
5. `PutItem` on MembersTable with full profile

**resend-code flow:**
1. `ResendConfirmationCode { email }` → Cognito
2. Cognito triggers CustomEmailSender with a fresh OTP

---

## 4. DynamoDB Changes

MembersTable record created on verify-email success:

| Attribute | Value |
|-----------|-------|
| `pk` | `MEMBER#<ulid>` |
| `sk` | `PROFILE` |
| `cognitoSub` | Cognito user `sub` |
| `dni` | From `custom:dni` |
| `email` | User email |
| `membershipTier` | From SeedMembersTable |
| `accountStatus` | `active` |
| `createdAt` | ISO timestamp |

---

## 5. Security Considerations

- OTP is delivered KMS-encrypted to CustomEmailSender; Lambda decrypts inline — never stored in plaintext.
- `ConfirmSignUp` is a public endpoint (no auth token required by design — user is not yet authenticated).
- Rate limiting on resend-code is handled natively by Cognito (LimitExceededException after multiple attempts).
