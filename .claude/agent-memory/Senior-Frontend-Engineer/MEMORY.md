# Senior Frontend Engineer - ActivaClub Memory

## Project Structure
- Frontend root: `C:/Users/Martin/Desktop/Tesis/frontend/`
- Source root: `C:/Users/Martin/Desktop/Tesis/frontend/src/`
- Path alias `@` maps to `./src/` (configured in vite.config.ts and tsconfig.json)

## Key Architectural Decisions
- Routing: React Router v6 with `createBrowserRouter`, lazy-loaded pages via `React.lazy`
- Auth: AWS Amplify v6 SDK (`aws-amplify/auth`) — imports are sub-path (e.g., `from 'aws-amplify/auth'`, NOT `from 'aws-amplify'`)
- State: Zustand stores in `src/store/` — `auth.store.ts` (persisted via `zustand/middleware`), `ui.store.ts` (not persisted)
- Toast system: Custom hook `src/hooks/useToast.ts` — uses an in-memory pub/sub reducer pattern (NOT a React context)
- Shadcn/ui: Components hand-created in `src/components/ui/` — do NOT use npx shadcn commands
- API client: Axios instance in `src/api/client.ts` — uses `fetchAuthSession()` from `aws-amplify/auth` for JWT
- Forms: react-hook-form + @hookform/resolvers/zod — schemas in `src/lib/zod-schemas.ts`

## Vitest Configuration
- `/// <reference types="vitest" />` is required at the top of `vite.config.ts`
- `"types": ["vitest/globals"]` in `tsconfig.json` enables test globals (describe, it, expect)
- Setup file: `src/test/setup.ts` imports `@testing-library/jest-dom`

## Tailwind / CSS Variables
- CSS variables for Shadcn/ui are defined in `src/index.css` under `:root` and `.dark`
- `darkMode: 'class'` in tailwind.config.ts
- Primary brand color: `#1E40AF` (blue-800)

## Patterns
- `ProtectedRoute` lives in `src/router/index.tsx` — checks Zustand `useAuthStore` directly
- `ProtectedLayout` is a default export (lazy-loadable), combines Header + Sidebar + Outlet
- All pages are default exports for lazy loading compatibility
- `UserRole` type: `'Admin' | 'Manager' | 'Member'` — stored in Cognito custom attribute `custom:role`

## Files to Know
- `src/lib/amplify.ts` — Amplify.configure() call (imported in main.tsx before App)
- `src/types/index.ts` — all shared TS types (Member, Reservation, Promotion, ApiResponse<T>, etc.)
- `src/hooks/useAuth.ts` — wraps Amplify signIn/signOut/getCurrentUser with Zustand store updates
