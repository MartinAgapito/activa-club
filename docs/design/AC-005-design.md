# AC-005 Technical Design: Login Step 1 — Credential Validation

**Epic:** EP-01 - Member Onboarding
**Story Points:** 3
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-003 (user CONFIRMED in Cognito + profile in MembersTable)

---

## 1. Overview

First step of the two-factor login flow. Validates email + password against Cognito using `AdminInitiateAuth`. On success, Cognito triggers the CustomEmailSender Lambda to dispatch a 6-digit OTP (TTL 3 minutes) and returns a challenge session token. The backend forwards the challenge to the frontend to continue with AC-006.

---

## 2. API Contract

### POST /v1/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Secret123!",
  "deviceKey": "us-east-1_abc123"  // optional — from localStorage
}
```

**Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 200 | — | `{ challengeName: "EMAIL_OTP", session: "<token>" }` |
| 200 | — | `{ accessToken, idToken, refreshToken }` — device recognized, OTP skipped (AC-010) |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (generic — no user enumeration) |
| 403 | `ACCOUNT_NOT_CONFIRMED` | User exists but email not verified |
| 403 | `ACCOUNT_INACTIVE` | Member is inactive in MembersTable |

---

## 3. Lambda Design

**Module:** `activa-club-members` — `AuthController` → `AuthService.login()`

1. `AdminInitiateAuth { AuthFlow: USER_PASSWORD_AUTH, AuthParameters: { USERNAME, PASSWORD, DEVICE_KEY? } }`
2. Cognito may return:
   - `{ ChallengeName: EMAIL_OTP, Session }` → forward to frontend
   - `{ ChallengeName: DEVICE_SRP_AUTH }` → respond automatically (AC-010 flow)
   - `AuthenticationResult` directly (device recognized after DEVICE_PASSWORD_VERIFIER)
3. Map Cognito exceptions to standard error codes — never expose raw Cognito error messages.

**No DynamoDB writes.** Reads MembersTable only if additional account status check is needed.

---

## 4. Security Considerations

- `AdminInitiateAuth` uses IAM credentials (Lambda execution role) — no Cognito app client secret exposed to frontend.
- Generic `INVALID_CREDENTIALS` for both wrong password and non-existent user — prevents user enumeration.
- `DEVICE_KEY` from localStorage is passed as an auth parameter; Cognito validates it server-side.
