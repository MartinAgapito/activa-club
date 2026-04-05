# Frontend — ActivaClub

SPA React + TypeScript construida con Vite.

## Stack Tecnológico

| Herramienta     | Propósito                                               |
|-----------------|---------------------------------------------------------|
| Vite            | Build tool y servidor de desarrollo                     |
| React 18        | Librería de UI                                          |
| TypeScript      | Tipado estático                                         |
| React Router v6 | Enrutamiento del lado del cliente                       |
| Zustand         | Estado global (sesión de autenticación, tokens, rol)    |
| React Query     | Estado del servidor, caché y refetching en background   |
| Axios           | Cliente HTTP con interceptor de token Cognito           |
| Shadcn/ui       | Primitivos de componentes accesibles (basados en Radix) |
| Tailwind CSS    | Estilos utility-first                                   |
| React Hook Form | Estado y validación de formularios                      |
| Zod             | Validación de esquemas (compartido con DTOs del backend)|

## Estructura de Directorios

```
src/
├── api/                # Cliente Axios + funciones de API por recurso
│   ├── client.ts       # Instancia Axios con interceptor de auth
│   ├── members.api.ts
│   ├── reservations.api.ts
│   ├── payments.api.ts
│   ├── promotions.api.ts
│   ├── guests.api.ts
│   ├── areas.api.ts
│   └── admin.api.ts
├── assets/             # Imágenes estáticas, íconos, fuentes
├── components/         # Componentes de UI reutilizables
│   ├── ui/             # Re-exports y personalizaciones de Shadcn/ui
│   ├── layout/         # AppShell, Sidebar, Header, Footer
│   ├── auth/           # Formularios de registro y login
│   ├── members/        # Tarjeta de perfil, badge de plan
│   ├── reservations/   # Calendario de reservas, selector de turno
│   ├── payments/       # Historial de pagos, botón de checkout
│   ├── promotions/     # Tarjeta de promoción, lista de promociones
│   ├── guests/         # Formulario de invitado, código de acceso
│   └── admin/          # Widgets de dashboard, tablas de datos, gráficos
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   ├── useCurrentMember.ts
│   ├── useReservations.ts
│   ├── usePayments.ts
│   └── usePromotions.ts
├── pages/              # Componentes de nivel de ruta (uno por ruta)
│   ├── auth/
│   │   ├── RegisterPage.tsx
│   │   ├── VerifyEmailPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── VerifyOtpPage.tsx
│   ├── member/
│   │   ├── MemberDashboardPage.tsx
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
├── router/             # Configuración de React Router
│   ├── index.tsx
│   ├── PrivateRoute.tsx
│   └── routes.ts
├── store/              # Stores de Zustand
│   ├── auth.store.ts   # Sesión Cognito, tokens, rol del usuario
│   └── ui.store.ts     # Estado global de UI (sidebar, modales)
├── types/              # Interfaces y enums de TypeScript
│   ├── member.types.ts
│   ├── reservation.types.ts
│   ├── payment.types.ts
│   ├── promotion.types.ts
│   ├── guest.types.ts
│   └── area.types.ts
└── utils/              # Funciones utilitarias puras
    ├── date.utils.ts
    ├── format.utils.ts
    └── qr.utils.ts     # Generación de código QR para acceso de invitados
```

## Estructura de Rutas

| Ruta | Componente | Auth requerida | Rol |
|------|------------|----------------|-----|
| `/register` | RegisterPage | No | — |
| `/verify-email` | VerifyEmailPage | No | — |
| `/login` | LoginPage | No | — |
| `/verify-otp` | VerifyOtpPage | No | — |
| `/member/dashboard` | MemberDashboardPage | Sí | Member |
| `/member/reservations` | ReservationsPage | Sí | Member |
| `/member/guests` | GuestsPage | Sí | Member |
| `/member/payments` | PaymentsPage | Sí | Member |
| `/member/promotions` | PromotionsPage | Sí | Member |
| `/admin/dashboard` | AdminDashboardPage | Sí | Admin / Manager |
| `/admin/members` | AdminMembersPage | Sí | Admin |
| `/admin/reservations` | AdminReservationsPage | Sí | Admin |
| `/admin/payments` | AdminPaymentsPage | Sí | Admin |
| `/admin/promotions` | AdminPromotionsPage | Sí | Admin / Manager |
| `/admin/analytics` | AdminAnalyticsPage | Sí | Admin |

## Filosofía de Estado

- **Zustand**: estado global del cliente — tokens de auth, rol del usuario, preferencias de UI. Tokens almacenados solo en memoria (no en localStorage) para prevenir robo por XSS.
- **React Query**: todo el estado del servidor — fetching, mutaciones, actualizaciones optimistas, invalidación de caché.
- **useState local**: estado efímero de UI (pasos de formulario, abrir/cerrar modales).

## Flujo de Autenticación

1. Usuario ingresa email + contraseña en `/login` → `POST /v1/auth/login`
2. Backend retorna `{ challengeName: "EMAIL_OTP", session }` → redirige a `/verify-otp`
3. Usuario ingresa OTP de email → `POST /v1/auth/verify-otp`
4. Backend retorna tokens JWT → se almacenan en Zustand (memoria)
5. Se decodifica el `IdToken` para extraer `cognito:groups` y resolver el rol
6. Redirección a `/member/dashboard` (Member) o `/admin/dashboard` (Admin / Manager)
7. Todas las peticiones al backend incluyen `Authorization: Bearer <accessToken>`

## Primeros Pasos

```bash
cd frontend
npm install
cp .env   # completar con los valores reales de Cognito
npm run dev
```

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base del API Gateway HTTP API. Dejar vacío para que el proxy de Vite intercepte `/v1/*` en desarrollo local. |
| `VITE_COGNITO_USER_POOL_ID` | ID del Cognito User Pool (ej. `us-east-1_XXXXXXX`) |
| `VITE_COGNITO_CLIENT_ID` | ID del App Client de Cognito |
| `VITE_COGNITO_DOMAIN` | Dominio del Cognito User Pool (ej. `activa-club-dev.auth.us-east-1.amazoncognito.com`) |

Ver `.env` para el formato completo.
