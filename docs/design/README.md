# Design Documents

Per-story technical design documents for ActivaClub.

## Naming Convention

Each document is named after the backlog item it covers: `AC-XXX-design.md`
Epic-level design documents are named `EP-XX-design.md`.

## Index

### EP-01: Member Onboarding

| Story | Title | Status |
|-------|-------|--------|
| [AC-001](AC-001-design.md) | Member Registration via DNI Matching | Implemented |
| [AC-002](AC-002-design.md) | Member Login with OTP | Implemented |
| [AC-003](AC-003-design.md) | Email Verification (ConfirmSignUp) | Implemented |
| [AC-004](AC-004-design.md) | Resend Verification Code | Implemented |
| [AC-005](AC-005-design.md) | Login Step 1 — Credential Validation | Implemented |
| [AC-006](AC-006-design.md) | Login Step 2 — OTP Verification + JWT Emission | Implemented |
| [AC-007](AC-007-design.md) | Frontend — Full Authentication Flow | Implemented |
| [AC-008](AC-008-design.md) | Logout — Token Revocation | Implemented |
| [AC-009](AC-009-design.md) | Post-Login Role Redirect | Implemented |
| [AC-010](AC-010-design.md) | Remember Device — Skip OTP on Trusted Devices | Implemented |

### EP-02: Reservations

| Story | Title | Status |
|-------|-------|--------|
| [EP-02](EP-02-design.md) | Reservations — Epic-level design (all stories) | Implemented |
| [AC-011](AC-011-design.md) | Area Availability Query (incl. `bookedByMe` extension) | Implemented |
| [AC-012](AC-012-design.md) | Create Reservation (TransactWrite + capacity alias fix) | Implemented |
| [AC-013](AC-013-design.md) | Cancel Own Reservation | Implemented |
| [AC-014](AC-014-design.md) | Member Reservation List | Implemented |
| [AC-015](AC-015-design.md) | Manager Dashboard — Calendar, Cancel, Blocks | Implemented |
| [AC-016](AC-016-design.md) | Automatic Reservation Expiration (EventBridge) | Implemented |

### EP-06: Admin Dashboard

| Story | Title | Status |
|-------|-------|--------|
| [AC-017](AC-017-design.md) | Admin CRUD for Recreational Areas | Implemented |
