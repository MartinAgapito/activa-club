# AC-002: Login de Socio con OTP (One-Time Password)

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 8
**Estado:** Done
**Fecha de Creación:** 2026-02-27
**Última Actualización:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio registrado y verificado,
Quiero iniciar sesión con mi email, contraseña y un código OTP enviado a mi email,
Para que el acceso a mi cuenta tenga una capa adicional de seguridad que proteja mis datos y mis reservas.

---

## Valor de Negocio

El login con OTP (autenticación de dos pasos) reduce drásticamente el riesgo de acceso no autorizado por robo de credenciales.
Al agregar un segundo factor basado en un código de un solo uso con TTL corto, el sistema garantiza que solo el titular de la cuenta —quien tiene acceso al email registrado— puede completar el login.
Esto es especialmente relevante dado que la plataforma gestiona datos personales, reservas y pagos de los socios.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                  |
| -------------------- | ------ | ------------------------------------------------------------ |
| Socio Registrado     | Member | Inicia sesión con email, contraseña y código OTP             |
| Administrador        | Admin  | Puede consultar logs de intentos fallidos si es necesario    |

---

## Precondiciones

- El socio tiene una cuenta en Cognito con estado `CONFIRMED` (completó el flujo de AC-001).
- El Cognito User Pool tiene MFA configurado en modo `ON` (obligatorio para todos los usuarios) con entrega de código vía email (Cognito Email OTP challenge).
- El socio tiene un email válido y verificado asociado a su cuenta Cognito.
- Los endpoints de login son públicamente accesibles (no requieren token de autenticación).

---

## Criterios de Aceptación

**Flujo Exitoso — Paso 1: Autenticación de credenciales:**

- [ ] El socio ingresa su email y contraseña en el formulario de login.
- [x] El backend llama a `AdminInitiateAuth` de Cognito con `AuthFlow = ADMIN_USER_PASSWORD_AUTH` (autenticado con el IAM role del Lambda).
- [x] Si las credenciales son válidas, Cognito no retorna tokens aún sino un challenge de tipo `EMAIL_OTP`.
- [x] El backend envía el challenge al frontend y el sistema notifica al socio que se ha enviado un código OTP a su email.
- [x] El sistema retorna HTTP 200 con un `session` token temporal (de corta vida, emitido por Cognito) y el tipo de challenge.

**Flujo Exitoso — Paso 2: Verificación del OTP:**

- [x] El socio ingresa el código OTP de 6 dígitos recibido en su email.
- [x] El backend llama a `AdminRespondToAuthChallenge` de Cognito con el código OTP y el `session` token.
- [x] Si el OTP es correcto y no ha expirado, Cognito retorna `AccessToken`, `IdToken` y `RefreshToken`.
- [x] El backend retorna HTTP 200 con los tokens.
- [x] El frontend almacena los tokens y redirige al dashboard del socio.

**Credenciales Incorrectas:**

- [x] Si el email no existe en Cognito, el sistema retorna HTTP 401 con mensaje genérico (no revelar si es email o contraseña la causa, para evitar user enumeration).
- [x] Si la contraseña es incorrecta, el sistema retorna HTTP 401 con el mismo mensaje genérico.
- [x] Después de N intentos fallidos consecutivos, Cognito bloquea la cuenta temporalmente; el sistema retorna HTTP 429.

**OTP Inválido o Expirado:**

- [x] Si el código OTP ingresado es incorrecto, el sistema retorna HTTP 400 con mensaje claro.
- [x] Si el `session` token temporal de Cognito expiró (TTL: 3 minutos), el sistema retorna HTTP 410 e indica que el socio debe iniciar el proceso de login nuevamente.
- [x] Si el código OTP fue ingresado más de 3 veces incorrectamente en la misma sesión, Cognito invalida la sesión; el sistema retorna HTTP 429.

**Cuenta No Confirmada:**

- [x] Si el socio existe en Cognito pero tiene estado `UNCONFIRMED` (no completó la verificación de email de AC-001), el sistema retorna HTTP 403 con mensaje que indica que debe completar la verificación de su cuenta.

**Cuenta Deshabilitada:**

- [x] Si el administrador ha deshabilitado la cuenta en Cognito, el sistema retorna HTTP 403 con mensaje que indica que debe contactar a la administración del club.

---

## Fuera de Alcance

- Login con redes sociales (Google, Facebook) — no forma parte del MVP.
- Recuperación de contraseña (Forgot Password) — cubierto en historia futura.
- TOTP con aplicación de autenticación (Google Authenticator, Authy) — diferido a historia de seguridad post-MVP.
- Opción "Recordar dispositivo" (Device tracking de Cognito) — diferido a historia de seguridad post-MVP.
- Refresh automático de tokens — cubierto en historia transversal de gestión de sesión.

---

## Reglas de Negocio

- **Mensaje de error genérico para credenciales:** Nunca indicar si el error es de email o contraseña; siempre retornar el mismo mensaje genérico para prevenir user enumeration.
- **TTL del session token de challenge:** El token de sesión emitido por Cognito al completar el paso 1 tiene un TTL de 3 minutos. Si expira, el flujo debe reiniciarse desde el paso 1.
- **TTL del código OTP:** El código OTP tiene un TTL de 3 minutos (configurable en Cognito).
- **Bloqueo por intentos fallidos:** Cognito aplica bloqueo temporal tras 5 intentos fallidos de credenciales (configurable en Advanced Security Features).
- **Tokens seguros:** El `AccessToken` y el `RefreshToken` no deben almacenarse en `localStorage`; el frontend debe usar memoria o `httpOnly cookie`.
- **Cuenta debe estar CONFIRMED:** Solo cuentas con estado `CONFIRMED` en Cognito pueden completar el login. Las cuentas `UNCONFIRMED` son rechazadas con HTTP 403.

---

## Flujo de Interacción

```
Socio                   Frontend                Backend (Lambda)          Cognito
  |                        |                           |                      |
  |-- email + password -->>|                           |                      |
  |                        |-- POST /v1/auth/login --->|                      |
  |                        |                           |-- AdminInitiateAuth ->|
  |                        |                           |<-- MFA_CHALLENGE ----|
  |                        |<-- HTTP 200 (session) ----|                      |
  |<-- "Ingresa tu OTP" ---|                           |                      |
  |                        |                           |        [Cognito envía OTP al email]
  |-- OTP (6 dígitos) -->>|                           |                      |
  |                        |-- POST /v1/auth/verify-otp->|                   |
  |                        |                           |-- AdminRespondToAuthChallenge->|
  |                        |                           |<-- tokens -----------|
  |                        |<-- HTTP 200 (tokens) -----|                      |
  |<-- Redirige dashboard -|                           |                      |
```

---

## Dependencias

| Historia / Artefacto     | Motivo                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| AC-001 Registro de Socio | El login requiere una cuenta Cognito CONFIRMED creada en AC-001.               |
| Cognito MFA Config       | El User Pool debe tener email OTP challenge habilitado (Cognito Email MFA).    |
| AC-003 Perfil de Socio   | Tras el login, el frontend consume datos del perfil del socio.                 |

---

## Endpoints

| Método | Path                    | Auth  | Descripción                                              |
|--------|-------------------------|-------|----------------------------------------------------------|
| POST   | `/v1/auth/login`        | None  | Paso 1: valida credenciales e inicia el MFA challenge    |
| POST   | `/v1/auth/verify-otp`   | None  | Paso 2: valida el OTP y retorna tokens de Cognito        |

### Request `POST /v1/auth/login`

```json
{
  "email": "socio@example.com",
  "password": "MySecureP@ss1"
}
```

### Response `POST /v1/auth/login` (HTTP 200)

```json
{
  "message": "Código OTP enviado a tu email.",
  "session": "<cognito_session_token>",
  "challengeName": "EMAIL_OTP"
}
```

### Request `POST /v1/auth/verify-otp`

```json
{
  "session": "<cognito_session_token>",
  "otp": "482917"
}
```

### Response `POST /v1/auth/verify-otp` (HTTP 200)

```json
{
  "accessToken": "...",
  "idToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600
}
```

---

## Definition of Done

**Endpoints:**
- [x] `POST /v1/auth/login` implementado y desplegado en dev: llama a `AdminInitiateAuth` con `ADMIN_USER_PASSWORD_AUTH`, retorna HTTP 200 con `session` y tipo de challenge, o HTTP 401/429 según corresponda.
- [x] `POST /v1/auth/verify-otp` implementado y desplegado en dev: llama a `AdminRespondToAuthChallenge`, retorna HTTP 200 con tokens o HTTP 400/410/429 según corresponda.
- [x] Ambos endpoints son públicos (sin token) y excluidos del autorizador de API Gateway.

**Lógica de Negocio:**
- [x] Mensaje de error genérico aplicado para credenciales incorrectas (HTTP 401) sin revelar si es email o contraseña (`UserNotFoundException` y `NotAuthorizedException` mapean al mismo `INVALID_CREDENTIALS`).
- [x] Bloqueo temporal por intentos fallidos de credenciales retorna HTTP 429.
- [x] Cuentas `UNCONFIRMED` retornan HTTP 403 `ACCOUNT_NOT_CONFIRMED`.
- [x] Cuentas deshabilitadas por administrador retornan HTTP 403 `ACCOUNT_DISABLED`.
- [x] OTP inválido retorna HTTP 400; session expirado retorna HTTP 410.
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.

**Tests:**
- [x] Tests unitarios cubren: flujo exitoso completo (paso 1 + paso 2), credenciales incorrectas, OTP inválido, OTP expirado (session expirado), cuenta UNCONFIRMED, cuenta deshabilitada y bloqueo por intentos.

**Frontend:**
- [x] Pantalla de login (paso 1: email + contraseña) conectada a `POST /v1/auth/login`.
- [x] Pantalla de verificación OTP (paso 2: código de 6 dígitos) conectada a `POST /v1/auth/verify-otp`.
- [x] Frontend muestra errores de validación y mapea códigos de error a mensajes amigables.
- [x] Tras login exitoso, redirige al dashboard del socio.

**General:**
- [x] Probado manualmente en ambiente dev con un usuario `CONFIRMED` (fixes aplicados y verificados via PRs).
- [x] Código revisado y aprobado (PRs #20 y #21 mergeados a main).
- [x] Listo para despliegue.
