# AC-010 Technical Design: Remember Device — Skip OTP on Trusted Devices

**Epic:** EP-01 - Member Onboarding
**Story Points:** 5
**Priority:** Medium
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-005, AC-006 (login + verify-otp endpoints), AC-007 (VerifyOtpPage)

---

## 1. Overview

After a successful OTP login, the user can opt in to trust their device for 30 days. On subsequent logins from a remembered device, Cognito issues a `DEVICE_SRP_AUTH` challenge (instead of `EMAIL_OTP`) which the backend resolves automatically — the user never sees the OTP screen.

---

## 2. Cognito Configuration (Terraform)

```hcl
device_configuration {
  challenge_required_on_new_device      = true
  device_only_remembered_on_user_prompt = true
}
```

`device_only_remembered_on_user_prompt = true` means Cognito only remembers the device when the backend explicitly calls `ConfirmDevice` — not automatically.

---

## 3. API Contract Changes

### POST /v1/auth/verify-otp (extended)

New optional request field:
```json
{ "rememberDevice": true }
```

New optional response field (only when `rememberDevice: true`):
```json
{ "accessToken": "...", "idToken": "...", "refreshToken": "...", "deviceKey": "us-east-1_abc123" }
```

### POST /v1/auth/login (extended)

New optional request field:
```json
{ "deviceKey": "us-east-1_abc123" }
```

Returns either `{ challengeName: "EMAIL_OTP", session }` (new device) or `{ accessToken, idToken, refreshToken }` directly (remembered device).

---

## 4. Backend Flow

### ConfirmDevice (in verify-otp when rememberDevice=true)

1. Cognito returns `DeviceKey` + `DeviceGroupKey` in `AuthenticationResult`.
2. Generate `PasswordVerifier` (SRP-based device verifier using `DeviceKey` + `DeviceGroupKey`).
3. `ConfirmDevice { AccessToken, DeviceKey, DeviceSecretVerifierConfig: { PasswordVerifier, Salt } }`.

### Device challenge handling (in login)

1. `AdminInitiateAuth` with `DEVICE_KEY` in `AuthParameters`.
2. If Cognito returns `DEVICE_SRP_AUTH`:
   - Respond with `AdminRespondToAuthChallenge { DEVICE_SRP_AUTH, SRP_A }`.
   - Cognito returns `DEVICE_PASSWORD_VERIFIER`.
   - Respond with `AdminRespondToAuthChallenge { DEVICE_PASSWORD_VERIFIER, ... }`.
   - Cognito returns `AuthenticationResult` (tokens directly).
3. If Cognito returns `EMAIL_OTP` → forward challenge to frontend as normal.

---

## 5. Frontend Changes

**VerifyOtpPage:** Added checkbox "Recordar este dispositivo por 30 días" (unchecked by default). Sends `rememberDevice: true` in request body when checked.

**localStorage:** `deviceKey` stored after successful remember-device flow. Read and sent on every subsequent `POST /v1/auth/login` call (`null` if absent).

**Zustand:** No persistent storage for tokens. `deviceKey` lives exclusively in `localStorage`.

---

## 6. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| `deviceKey` in localStorage | No standalone value — requires user password to authenticate |
| Automatic device trust | Requires explicit checkbox — never automatic |
| Device expiry | Cognito enforces 30-day TTL automatically |
| Stolen `deviceKey` | Attacker still needs the user's password to complete login |
| Multiple devices | Each device gets its own `DeviceKey`; revocation per-device via Cognito |
