# AC-008 Technical Design: Logout — Token Revocation

**Epic:** EP-01 - Member Onboarding
**Story Points:** 3
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-006 (AccessToken in Zustand), AC-007 (frontend session management)

---

## 1. Overview

Authenticated logout endpoint. The backend extracts the username from the `AccessToken` and calls `AdminUserGlobalSignOut`, invalidating all active sessions for that user in Cognito. The frontend always clears the Zustand store and redirects to `/login` — even on non-network errors.

---

## 2. API Contract

### POST /v1/auth/logout

**Headers:** `Authorization: Bearer <AccessToken>`

**Request body:** none

**Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 200 | — | `{ message: "Sesión cerrada correctamente" }` |
| 401 | `TOKEN_EXPIRED` | AccessToken already expired (frontend still clears store) |
| 500 | `LOGOUT_FAILED` | Cognito error (frontend still clears store) |

---

## 3. Lambda Design

**Module:** `activa-club-members` — `AuthController` → `AuthService.logout()`

1. API Gateway JWT Authorizer validates `AccessToken` before Lambda executes.
2. Lambda decodes the `AccessToken` JWT payload to extract `username` (the `sub` claim maps to `username` in Cognito).
3. `AdminUserGlobalSignOut { UserPoolId, Username }` → invalidates all refresh tokens and marks access tokens as revoked.
4. Return 200.

**IAM permission required:** `cognito-idp:AdminUserGlobalSignOut` on the User Pool ARN.

---

## 4. Frontend Behavior

| Scenario | Backend response | Frontend action |
|----------|-----------------|-----------------|
| Success | 200 | Clear store → redirect to /login |
| Token expired | 401 | Clear store → redirect to /login |
| Cognito error | 500 | Clear store → redirect to /login |
| Network error | No response | Show Spanish error message, preserve session |

**Rationale:** The store is always cleared except on network error — a user who logged out intentionally should never remain authenticated due to a server-side error.

---

## 5. Security Considerations

- `AdminUserGlobalSignOut` invalidates all refresh tokens globally (not just the current session). Access tokens remain technically valid for their remaining TTL (up to 1 hour) but are flagged as revoked for calls to the User Pool.
- The endpoint is protected by the API Gateway JWT Authorizer — unauthenticated callers receive 401 before reaching Lambda.
- No session state is maintained server-side; invalidation is delegated entirely to Cognito.
