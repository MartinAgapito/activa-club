# AC-007 Technical Design: Frontend — Full Authentication Flow

**Epic:** EP-01 - Member Onboarding
**Story Points:** 5
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-05
**Depends on:** AC-002 to AC-006 (all auth endpoints deployed)

---

## 1. Overview

React SPA implementation of the complete authentication flow: registration, email verification, resend code, login (step 1 + step 2), logout, role-based redirect, and device memory. Built with React + TypeScript, Vite, Zustand, React Query, React Hook Form, Zod, and Shadcn/ui.

---

## 2. Pages and Routes

| Route | Component | Auth required |
|-------|-----------|---------------|
| `/register` | `RegisterPage` | No |
| `/verify-email` | `VerifyEmailPage` | No |
| `/login` | `LoginPage` | No |
| `/verify-otp` | `VerifyOtpPage` | No |
| `/member/dashboard` | `MemberDashboardPage` | Yes (Member) |
| `/admin/dashboard` | `AdminDashboardPage` | Yes (Admin / Manager) |

---

## 3. State Management (Zustand)

**`useAuthStore` slice:**

```typescript
interface AuthState {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  role: "Admin" | "Manager" | "Member" | null;
  // Actions
  setAuth(tokens, role): void;
  clearAuth(): void;
}
```

- Tokens stored in memory only (not persisted to localStorage or sessionStorage).
- `role` resolved once after verify-otp, stored in memory for the session lifetime.
- `deviceKey` stored separately in `localStorage` (outside Zustand persistence).

---

## 4. API Integration

- All API calls go through a central `apiClient` configured with `VITE_API_URL`.
- Vite dev proxy forwards `/v1/*` to `http://localhost:3001` when `VITE_API_URL` is empty.
- React Query manages caching and loading states for mutating endpoints.

---

## 5. Route Guards (PrivateRoute)

`PrivateRoute` wraps every protected route:
1. If no `accessToken` in Zustand → redirect to `/login`.
2. If `role` does not satisfy the route's required role → redirect to the user's own dashboard.

Role precedence: `Admin > Manager > Member`.

---

## 6. Form Validation

All forms use React Hook Form + Zod schemas. Validation is client-side only; server errors are mapped to Spanish-language messages and displayed inline on the form.

---

## 7. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Tokens in memory (not localStorage) | Prevents XSS token theft |
| `deviceKey` in localStorage | Safe — no standalone value; enables remember-device across sessions |
| Spanish error messages | All user-visible text is in Spanish regardless of API error code |
| Vite proxy for local dev | Avoids CORS issues; `VITE_API_URL` left empty locally |
