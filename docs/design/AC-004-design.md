# AC-004 Technical Design: Resend Verification Code

**Epic:** EP-01 - Member Onboarding
**Story Points:** 2
**Priority:** Medium
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-002 (user exists in Cognito with status UNCONFIRMED)

---

## 1. Overview

Allows a user whose OTP has expired (TTL 24h) or was not received to request a new verification code. Implemented as a thin wrapper around Cognito's `ResendConfirmationCode` API, which re-triggers the CustomEmailSender Lambda.

---

## 2. API Contract

### POST /v1/auth/resend-code

**Request:**
```json
{ "email": "user@example.com" }
```

**Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 200 | — | New OTP dispatched |
| 400 | `USER_ALREADY_CONFIRMED` | Account is already confirmed — resend is irrelevant |
| 404 | `USER_NOT_FOUND` | No Cognito user with this email |
| 429 | `TOO_MANY_REQUESTS` | Cognito rate limit exceeded (LimitExceededException) |

All errors follow the standard schema: `{ status, error: { code, message } }`.

---

## 3. Lambda Design

**Module:** `activa-club-members` — `AuthController`

1. Call `ResendConfirmationCode { ClientId, Username: email }` on Cognito.
2. Cognito triggers `CustomEmailSender` Lambda with a new KMS-encrypted OTP.
3. `CustomEmailSender` decrypts via KMS → sends via SES.
4. Return `200 OK` — no body beyond a success message.

**No DynamoDB writes.** This endpoint does not touch MembersTable or SeedMembersTable.

---

## 4. Security Considerations

- Public endpoint (no auth token) — the user is unconfirmed and cannot authenticate.
- Response is identical whether the email exists or not (prevents user enumeration).
- Native Cognito rate limiting caps abuse of this endpoint.
