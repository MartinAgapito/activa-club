# AC-009 Technical Design: Post-Login Role Redirect

**Epic:** EP-01 - Member Onboarding
**Story Points:** 2
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-006 (IdToken with cognito:groups claim), AC-007 (Zustand store, React Router)

---

## 1. Overview

After `verify-otp` returns 200, the frontend decodes the IdToken payload to extract the `cognito:groups` claim and redirects the user to the appropriate dashboard. Route guards (`PrivateRoute`) enforce role-based access on every subsequent navigation.

No backend changes — this is a pure frontend implementation.

---

## 2. Role Resolution Logic

```
cognito:groups → resolved role → redirect target
─────────────────────────────────────────────────
["Admin"]            → Admin   → /admin/dashboard
["Manager"]          → Manager → /admin/dashboard
["Member"]           → Member  → /member/dashboard
["Admin","Manager"]  → Admin   → /admin/dashboard  (Admin wins)
[] or absent         → Member  → /member/dashboard (safe fallback)
decode error         → Member  → /member/dashboard (safe fallback + console.warn)
```

Precedence: `Admin > Manager > Member`.

---

## 3. IdToken Decoding

```typescript
const payload = JSON.parse(atob(idToken.split('.')[1]));
const groups: string[] = payload['cognito:groups'] ?? [];
```

No cryptographic verification on the client — the JWT signature is verified by the API Gateway JWT Authorizer on every backend request. Client-side decode is read-only for UX purposes only.

---

## 4. PrivateRoute Implementation

```tsx
<PrivateRoute requiredRole={["Admin", "Manager"]}>
  <AdminDashboardPage />
</PrivateRoute>
```

Guard behavior:
1. No `accessToken` in Zustand → redirect to `/login`.
2. `role` not in `requiredRole` list → redirect to the user's own dashboard.

---

## 5. Zustand Store Extension

Field `role: "Admin" | "Manager" | "Member" | null` added to `AuthState`. Set during `setAuth()` after verify-otp. Cleared in `clearAuth()` on logout.

---

## 6. Security Considerations

- Role elevation is impossible via client manipulation — every API endpoint is protected by the Cognito JWT Authorizer, which re-validates the token and checks group membership on each request.
- The frontend role is used only for UX routing, never for access control of backend resources.
- Safe fallback to `Member` on any ambiguity ensures no unintentional privilege escalation.
