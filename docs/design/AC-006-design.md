# AC-006 Technical Design: Login Step 2 — OTP Verification + JWT Emission

**Epic:** EP-01 - Member Onboarding
**Story Points:** 3
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-005 (backend returned `{ challengeName: EMAIL_OTP, session }`)

---

## 1. Overview

Second step of the two-factor login flow. The user submits the 6-digit OTP received by email. The backend responds to the Cognito challenge and, on success, receives the JWT token set (AccessToken, IdToken, RefreshToken). Tokens are returned to the frontend. If `rememberDevice: true`, the backend also calls `ConfirmDevice` before returning (AC-010).

---

## 2. API Contract

### POST /v1/auth/verify-otp

**Request:**
```json
{
  "email": "user@example.com",
  "session": "<challenge session token>",
  "otp": "123456",
  "rememberDevice": false
}
```

**Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 200 | — | `{ accessToken, idToken, refreshToken, expiresIn, deviceKey? }` |
| 400 | `INVALID_OTP` | OTP does not match |
| 410 | `SESSION_EXPIRED` | Challenge session TTL (3 min) exceeded |

---

## 3. Lambda Design

**Module:** `activa-club-members` — `AuthController` → `AuthService.verifyOtp()`

1. `AdminRespondToAuthChallenge { ChallengeName: EMAIL_OTP, Session, ChallengeResponses: { USERNAME, EMAIL_OTP_CODE } }`
2. On success: Cognito returns `AuthenticationResult` with tokens + optional `DeviceKey`/`DeviceGroupKey`.
3. If `rememberDevice === true` and `DeviceKey` present: call `ConfirmDevice` (AC-010).
4. Return token set to frontend. `deviceKey` included in response only if `rememberDevice === true`.

---

## 4. Token Handling

| Token | TTL | Storage |
|-------|-----|---------|
| `AccessToken` | 1 hour | Zustand store (memory only — NOT localStorage) |
| `IdToken` | 1 hour | Zustand store (memory only) |
| `RefreshToken` | 30 days | Not stored on frontend for MVP |
| `DeviceKey` | 30 days | `localStorage` (safe — no credentials) |

**Rationale for memory-only JWT storage:** Eliminates XSS token theft risk. Tokens are lost on tab close/refresh — acceptable trade-off for MVP security posture.

---

## 5. Security Considerations

- Session token from AC-005 is single-use and expires in 3 minutes — replay attacks not viable.
- `deviceKey` in localStorage has no standalone value without the user's password; theft does not grant access.
- AccessToken/IdToken are never persisted to `localStorage` or `sessionStorage`.
