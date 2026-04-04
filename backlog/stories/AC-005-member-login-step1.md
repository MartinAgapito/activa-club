# AC-005: Login de Socio — Validación de Credenciales

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio registrado,
Quiero ingresar mi email y contraseña para iniciar el proceso de autenticación en el sistema,
Para acceder a las funcionalidades de la plataforma de forma segura.

---

## Valor de Negocio

El login es el punto de entrada a toda la plataforma para los socios.
El uso de `ADMIN_USER_PASSWORD_AUTH` desde el backend (en lugar de flujos del SDK de Cognito
directamente desde el frontend) centraliza la autenticación en el servidor,
mejorando la postura de seguridad y habilitando el MFA obligatorio por email OTP.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                             |
|----------------------|--------|---------------------------------------------------------|
| Socio Registrado     | Member | Ingresa email y contraseña en el formulario de login    |
| Administrador        | Admin  | Puede consultar logs de intentos fallidos si es necesario |

---

## Precondiciones

- AC-003 completado: el socio tiene una cuenta en Cognito con estado `CONFIRMED` y perfil en `MembersTable`.
- El Cognito User Pool tiene MFA configurado en modo ON con entrega de código vía email (Email OTP challenge).
- El endpoint es público — no requiere token de autenticación.

---

## Criterios de Aceptación

- [x] Credenciales incorrectas (email o contraseña inválidos) → HTTP 401 con código `INVALID_CREDENTIALS`.
- [x] `UserNotFoundException` y `NotAuthorizedException` de Cognito mapean al mismo código de error `INVALID_CREDENTIALS` (prevenir user enumeration: no revelar cuál campo falló).
- [x] Cuenta con estado `UNCONFIRMED` → HTTP 403 con código `ACCOUNT_NOT_CONFIRMED`.
- [x] Cuenta deshabilitada por administrador → HTTP 403 con código `ACCOUNT_DISABLED`.
- [x] Bloqueo temporal por exceso de intentos fallidos → HTTP 429.
- [x] Flujo exitoso: backend llama a `AdminInitiateAuth` con `ADMIN_USER_PASSWORD_AUTH` → Cognito retorna challenge `EMAIL_OTP` → HTTP 200 con `{ challengeName, session }`.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Verificación del OTP de login — cubierta en AC-006.
- Recuperación de contraseña (Forgot Password) — diferida a historia futura.
- Login con redes sociales — no forma parte del MVP.
- Opción "Recordar dispositivo" — diferida a AC-010.

---

## Reglas de Negocio

- **Mensaje de error genérico:** Nunca indicar si el error es de email o de contraseña; siempre retornar el mismo mensaje genérico `INVALID_CREDENTIALS` para prevenir user enumeration.
- **AuthFlow exclusivo del backend:** Solo el backend Lambda llama a `AdminInitiateAuth`; el frontend nunca interactúa directamente con Cognito.
- **Cuenta CONFIRMED requerida:** Solo cuentas con estado `CONFIRMED` pueden iniciar el flujo de login.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                         |
|----------------------|--------------------------------------------------------------------------------|
| AC-003               | La cuenta debe estar `CONFIRMED` y el perfil DynamoDB debe existir.            |
| AC-006               | Paso 2 del login: verificación del OTP enviado como resultado de este paso.    |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/login` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] `AdminInitiateAuth` con `ADMIN_USER_PASSWORD_AUTH` implementado correctamente.
- [x] Mensaje de error genérico aplicado: `UserNotFoundException` y `NotAuthorizedException` mapean a `INVALID_CREDENTIALS` (HTTP 401).
- [x] `UNCONFIRMED` retorna HTTP 403 `ACCOUNT_NOT_CONFIRMED`.
- [x] Cuenta deshabilitada retorna HTTP 403 `ACCOUNT_DISABLED`.
- [x] Bloqueo por intentos fallidos retorna HTTP 429.
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso, credenciales incorrectas, cuenta UNCONFIRMED, cuenta deshabilitada y bloqueo por intentos.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-002-design.md`
- **Endpoint:** `POST /v1/auth/login` — público, sin token.
