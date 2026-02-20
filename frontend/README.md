# Frontend - ActivaClub

React + TypeScript SPA built with Vite.

## Tech Stack

| Tool            | Purpose                                          |
|-----------------|--------------------------------------------------|
| Vite            | Build tool and dev server                        |
| React 18        | UI library                                       |
| TypeScript      | Static typing                                    |
| React Router v6 | Client-side routing                              |
| Zustand         | Global state management (auth, user session)     |
| React Query     | Server state, caching, background refetching     |
| Axios           | HTTP client with Cognito token interceptor       |
| Shadcn/ui       | Accessible component primitives (Radix-based)   |
| Tailwind CSS    | Utility-first styling                            |
| React Hook Form | Form state and validation                        |
| Zod             | Schema validation (shared with backend DTOs)     |

## Directory Layout

```
src/
├── api/                # Axios client + per-resource API functions
│   ├── client.ts       # Axios instance with Cognito auth interceptor
│   ├── members.api.ts
│   ├── reservations.api.ts
│   ├── payments.api.ts
│   ├── promotions.api.ts
│   ├── guests.api.ts
│   ├── areas.api.ts
│   └── admin.api.ts
├── assets/             # Static images, icons, fonts
├── components/         # Reusable UI components
│   ├── ui/             # Shadcn/ui re-exports and customizations
│   ├── layout/         # AppShell, Sidebar, Header, Footer
│   ├── auth/           # DNI onboarding, login forms
│   ├── members/        # Member profile card, tier badge
│   ├── reservations/   # Booking calendar, slot picker, reservation card
│   ├── payments/       # Payment history table, checkout button
│   ├── promotions/     # Promotion card, promotions list
│   ├── guests/         # Guest registration form, access code display
│   └── admin/          # Dashboard widgets, data tables, charts
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   ├── useCurrentMember.ts
│   ├── useReservations.ts
│   ├── usePayments.ts
│   └── usePromotions.ts
├── pages/              # Route-level components (one per route)
│   ├── auth/
│   │   ├── OnboardingPage.tsx
│   │   └── LoginPage.tsx
│   ├── member/
│   │   ├── DashboardPage.tsx
│   │   ├── ReservationsPage.tsx
│   │   ├── NewReservationPage.tsx
│   │   ├── GuestsPage.tsx
│   │   ├── PaymentsPage.tsx
│   │   └── PromotionsPage.tsx
│   ├── admin/
│   │   ├── AdminDashboardPage.tsx
│   │   ├── AdminMembersPage.tsx
│   │   ├── AdminReservationsPage.tsx
│   │   ├── AdminPaymentsPage.tsx
│   │   ├── AdminPromotionsPage.tsx
│   │   └── AdminAnalyticsPage.tsx
│   └── shared/
│       ├── NotFoundPage.tsx
│       └── UnauthorizedPage.tsx
├── router/             # React Router configuration
│   ├── index.tsx
│   ├── ProtectedRoute.tsx
│   └── routes.ts
├── store/              # Zustand stores
│   ├── auth.store.ts   # Cognito session, tokens, user claims
│   └── ui.store.ts     # Global UI state (sidebar, modals)
├── types/              # TypeScript interfaces and enums
│   ├── member.types.ts
│   ├── reservation.types.ts
│   ├── payment.types.ts
│   ├── promotion.types.ts
│   ├── guest.types.ts
│   └── area.types.ts
└── utils/              # Pure utility functions
    ├── date.utils.ts
    ├── format.utils.ts
    └── qr.utils.ts     # QR code generation for guest access codes
```

## Routing Structure

| Path                          | Component              | Auth Required | Role        |
|-------------------------------|------------------------|---------------|-------------|
| `/onboarding`                 | OnboardingPage         | No            | -           |
| `/login`                      | LoginPage              | No            | -           |
| `/dashboard`                  | DashboardPage          | Yes           | Member+     |
| `/reservations`               | ReservationsPage       | Yes           | Member+     |
| `/reservations/new`           | NewReservationPage     | Yes           | Member+     |
| `/guests`                     | GuestsPage             | Yes           | Member+     |
| `/payments`                   | PaymentsPage           | Yes           | Member+     |
| `/promotions`                 | PromotionsPage         | Yes           | Member+     |
| `/admin`                      | AdminDashboardPage     | Yes           | Admin       |
| `/admin/members`              | AdminMembersPage       | Yes           | Admin       |
| `/admin/reservations`         | AdminReservationsPage  | Yes           | Admin       |
| `/admin/payments`             | AdminPaymentsPage      | Yes           | Admin       |
| `/admin/promotions`           | AdminPromotionsPage    | Yes           | Admin/Mgr   |
| `/admin/analytics`            | AdminAnalyticsPage     | Yes           | Admin       |

## State Management Philosophy

- **Zustand** for client-side global state: auth tokens, user claims, UI preferences.
- **React Query** for all server state: data fetching, mutations, optimistic updates, cache invalidation.
- Local component state (`useState`) for ephemeral UI state (form steps, modal open/close).

## Authentication Flow

1. User enters DNI on `/onboarding` -> calls `POST /v1/members/onboard`
2. On success, Cognito sign-up or sign-in is triggered via Amplify Auth
3. Cognito returns ID token + Access token stored in Zustand `auth.store`
4. Axios interceptor attaches `Authorization: Bearer <id_token>` to every request
5. On token expiry, interceptor uses Amplify `Auth.currentSession()` to refresh

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in API Gateway URL + Cognito config
npm run dev
```

## Environment Variables

| Variable                       | Description                         |
|--------------------------------|-------------------------------------|
| `VITE_API_BASE_URL`            | API Gateway HTTP API base URL       |
| `VITE_COGNITO_USER_POOL_ID`    | Cognito User Pool ID                |
| `VITE_COGNITO_CLIENT_ID`       | Cognito App Client ID               |
| `VITE_COGNITO_REGION`          | AWS region                          |
| `VITE_STRIPE_PUBLISHABLE_KEY`  | Stripe publishable key              |
