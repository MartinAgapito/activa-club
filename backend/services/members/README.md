# Servicio: members

Lambda: `activa-club-members-<env>`
Tablas: `MembersTable`, `SeedMembersTable`

## Responsabilidad

Gestiona la incorporación de socios y autenticación completa (EP-01):

- Registro vía validación de DNI + SignUp en Cognito con OTP por email
- Verificación de email (ConfirmSignUp + creación de perfil en DynamoDB)
- Reenvío de código de verificación
- Login con doble factor (contraseña + OTP EMAIL_OTP)
- Logout con revocación global de tokens en Cognito
- Recordar dispositivo — omisión de OTP en dispositivos confiables (30 días)

---

## Endpoints

| Método | Ruta | Auth | HTTP | Descripción |
|--------|------|------|------|-------------|
| POST | `/v1/auth/register` | Público | 202 | Paso 1: Validación DNI + Cognito SignUp → OTP enviado |
| POST | `/v1/auth/verify-email` | Público | 201 | Paso 2: Confirmación OTP + creación de perfil |
| POST | `/v1/auth/resend-code` | Público | 200 | Reenviar OTP al email del socio |
| POST | `/v1/auth/login` | Público | 200 | Paso 1: Validación de credenciales → challenge EMAIL_OTP |
| POST | `/v1/auth/verify-otp` | Público | 200 | Paso 2: Respuesta al challenge → tokens JWT |
| POST | `/v1/auth/logout` | JWT | 200 | Logout — revocación global de tokens en Cognito |

---

## Flujo de Registro (AC-001 / AC-002 / AC-003 / AC-004)

### Paso 1 — POST /v1/auth/register → HTTP 202

Valida el DNI contra `SeedMembersTable`, verifica duplicados y llama a Cognito `SignUp` para crear un usuario `UNCONFIRMED` y enviar un OTP de 6 dígitos al email. **No se crea perfil en DynamoDB en este paso.**

**Request:**
```json
{ "dni": "20345678", "email": "martin.garcia@email.com", "password": "SecurePass1!" }
```

**Codes de error:**

| HTTP | Código | Causa |
|------|--------|-------|
| 400 | `VALIDATION_ERROR` | Campos faltantes o malformados |
| 403 | `ACCOUNT_INACTIVE` | Registro seed con `account_status=inactive` |
| 404 | `DNI_NOT_FOUND` | DNI no encontrado en `SeedMembersTable` |
| 409 | `DNI_ALREADY_REGISTERED` | DNI ya confirmado en `MembersTable` |
| 409 | `EMAIL_ALREADY_IN_USE` | Email ya confirmado en `MembersTable` |
| 422 | `PASSWORD_POLICY_VIOLATION` | Contraseña no cumple la política de Cognito |

### Paso 2 — POST /v1/auth/verify-email → HTTP 201

Confirma la cuenta Cognito con el OTP, asigna al usuario al grupo `Member` y crea el perfil en `MembersTable`.

**Request:**
```json
{ "email": "martin.garcia@email.com", "code": "482917" }
```

**Codes de error:**

| HTTP | Código | Causa |
|------|--------|-------|
| 400 | `INVALID_CODE` | OTP incorrecto (`CodeMismatchException`) |
| 404 | `USER_NOT_FOUND` | No existe usuario `UNCONFIRMED` para este email |
| 410 | `CODE_EXPIRED` | TTL del OTP expirado (24h) |
| 429 | `TOO_MANY_ATTEMPTS` | Demasiados intentos incorrectos |

### Soporte — POST /v1/auth/resend-code → HTTP 200

Llama a `ResendConfirmationCode` de Cognito para enviar un nuevo OTP.

---

## Flujo de Login (AC-005 / AC-006)

### Paso 1 — POST /v1/auth/login → HTTP 200

```json
// Request
{ "email": "martin.garcia@email.com", "password": "SecurePass1!", "deviceKey": "..." }

// Response (nuevo dispositivo)
{ "status": "success", "data": { "challengeName": "EMAIL_OTP", "session": "<token>" } }

// Response (dispositivo recordado — AC-010)
{ "status": "success", "data": { "accessToken": "...", "idToken": "...", "refreshToken": "..." } }
```

### Paso 2 — POST /v1/auth/verify-otp → HTTP 200

```json
// Request
{ "email": "martin.garcia@email.com", "session": "<token>", "otp": "482917", "rememberDevice": false }

// Response
{ "status": "success", "data": { "accessToken": "...", "idToken": "...", "refreshToken": "...", "expiresIn": 3600, "deviceKey": "..." } }
```

## Logout (AC-008)

### POST /v1/auth/logout → HTTP 200

Requiere `Authorization: Bearer <AccessToken>` en el header. Llama a `AdminUserGlobalSignOut` — invalida todos los tokens activos del socio en Cognito.

```json
// Response
{ "status": "success", "data": { "message": "Sesión cerrada correctamente" } }
```

---

## Envelope de Error Estándar

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensaje legible para el usuario.",
    "details": []
  }
}
```

---

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor HTTP local | `3001` |
| `ENV` | Ambiente (`local`, `dev`, `prod`) | `local` |
| `DYNAMODB_REGION` | Región AWS | `us-east-1` |
| `MEMBERS_TABLE_NAME` | Tabla DynamoDB de perfiles | `MembersTable-dev` |
| `SEED_MEMBERS_TABLE_NAME` | Tabla con datos pre-cargados | `SeedMembersTable-dev` |
| `COGNITO_USER_POOL_ID` | ID del User Pool | `us-east-1_XXXXXXXX` |
| `COGNITO_CLIENT_ID` | ID del App Client | `XXXXXXXXXXXXXXXXX` |

Copiar `.env` a `.env` para desarrollo local.

---

## Configuración Local

```bash
# Desde backend/
npm install

# Verificar que services/members/.env exista con los valores correctos

# Iniciar servidor de desarrollo NestJS
nest start members --watch
# API:     http://localhost:3001/v1
# Swagger: http://localhost:3001/api/docs
```

---

## Tests

```bash
# Desde backend/

# Todos los tests del servicio members
npm test -- --testPathPattern="services/members"

# Archivos individuales
npm test -- --testPathPattern="register-member.handler"
npm test -- --testPathPattern="verify-email.handler"
npm test -- --testPathPattern="resend-code.handler"
npm test -- --testPathPattern="login.handler"
npm test -- --testPathPattern="verify-otp.handler"

# Con cobertura
npm run test:cov -- --testPathPattern="services/members"
```

---

## Estructura Clean Architecture

```
src/
├── application/
│   └── commands/
│       ├── register-member/      # Paso 1 del registro: SignUp
│       ├── verify-email/         # Paso 2 del registro: ConfirmSignUp + perfil
│       ├── resend-code/          # Soporte: ResendConfirmationCode
│       ├── login/                # Login paso 1: AdminInitiateAuth
│       ├── verify-otp/           # Login paso 2: AdminRespondToAuthChallenge
│       └── logout/               # Logout: AdminUserGlobalSignOut
├── domain/
│   ├── entities/
│   │   └── member.entity.ts
│   ├── exceptions/
│   │   └── member.exceptions.ts
│   ├── value-objects/
│   │   ├── account-status.vo.ts
│   │   ├── dni.vo.ts
│   │   └── membership-type.vo.ts
│   └── repositories/
│       ├── member.repository.interface.ts
│       └── seed-member.repository.interface.ts
├── infrastructure/
│   ├── cognito/
│   │   └── cognito.service.ts
│   ├── handlers/
│   │   └── lambda.handler.ts
│   └── repositories/
│       ├── dynamo-member.repository.ts
│       └── dynamo-seed-member.repository.ts
├── presentation/
│   ├── controllers/
│   │   └── auth.controller.ts
│   └── dtos/
│       ├── register-member.request.dto.ts
│       ├── verify-email.request.dto.ts
│       ├── login.request.dto.ts
│       ├── verify-otp.request.dto.ts
│       └── logout.request.dto.ts
└── test/unit/
```

---

## Tablas DynamoDB

### MembersTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `PK` | String | `MEMBER#<ulid>` |
| `SK` | String | `PROFILE` |
| `member_id` | String | ULID |
| `dni` | String | DNI (PK de GSI_DNI) |
| `email` | String | Email (PK de GSI_Email) |
| `full_name` | String | Del registro seed |
| `membership_type` | String | `VIP` / `Gold` / `Silver` |
| `account_status` | String | `active` / `inactive` / `suspended` |
| `cognito_user_id` | String | `sub` de Cognito (PK de GSI_CognitoSub) |
| `created_at` | String | ISO-8601 UTC |

GSIs: `GSI_DNI` (PK=`dni`), `GSI_Email` (PK=`email`), `GSI_CognitoSub` (PK=`cognito_user_id`)

### SeedMembersTable (solo lectura)

| Atributo | Tipo | Notas |
|----------|------|-------|
| `DNI` | String | Hash key |
| `full_name` | String | |
| `membership_type` | String | `VIP` / `Gold` / `Silver` |
| `account_status` | String | `active` / `inactive` |

## Reglas por Plan de Membresía

| Plan   | Reservas/Mes | Invitados/Reserva |
|--------|--------------|-------------------|
| VIP    | Ilimitado    | 5 |
| Gold   | 10           | 3 |
| Silver | 5            | 1 |
