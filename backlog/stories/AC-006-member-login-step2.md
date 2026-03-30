# AC-006: Login de Socio — Verificación OTP y Emisión de Tokens JWT

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio registrado,
Quiero verificar el código OTP recibido por email para completar el login,
Para obtener mis tokens de acceso y operar dentro de la plataforma de forma segura.

---

## Valor de Negocio

La verificación OTP como segundo factor garantiza que solo el titular del email registrado
puede completar la autenticación, incluso si las credenciales fueron comprometidas.
La emisión de tokens JWT estándar de Cognito habilita el acceso seguro a todos los
endpoints protegidos de la plataforma.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                   |
|----------------------|--------|---------------------------------------------------------------|
| Socio Registrado     | Member | Ingresa el código OTP de 6 dígitos recibido en su email       |

---

## Precondiciones

- AC-005 completado: el backend retornó HTTP 200 con `{ challengeName, session }`.
- El frontend conserva el `session` token de Cognito (válido por 3 minutos).
- El endpoint es público — no requiere token de autenticación.

---

## Criterios de Aceptación

- [x] OTP inválido (código incorrecto) → HTTP 400.
- [x] Session token expirado (TTL: 3 minutos) → HTTP 410; el socio debe reiniciar el flujo de login desde AC-005.
- [x] Más de 3 intentos OTP incorrectos en la misma sesión → HTTP 429; la sesión queda invalidada.
- [x] Flujo exitoso: backend llama a `AdminRespondToAuthChallenge` → Cognito retorna `AccessToken`, `IdToken` y `RefreshToken` → HTTP 200 con los tres tokens.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Refresh automático de tokens — diferido a historia transversal de gestión de sesión.
- Opción "Recordar dispositivo" — diferida a historia de seguridad post-MVP.
- Revocación de tokens (logout) — diferida a historia de cierre de sesión.

---

## Reglas de Negocio

- **TTL del session token:** El session token emitido por Cognito en el paso 1 tiene un TTL de 3 minutos. Si expira, el flujo completo debe reiniciarse desde el paso 1 (AC-005).
- **Invalidación por intentos:** Tras 3 intentos OTP incorrectos en la misma sesión, Cognito invalida la sesión y no puede reutilizarse.
- **Tokens seguros:** El `AccessToken` y `RefreshToken` no deben almacenarse en `localStorage` en el frontend; se recomienda memoria o `httpOnly cookie`.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                           |
|----------------------|----------------------------------------------------------------------------------|
| AC-005               | Paso previo: provee el `session` token requerido por este endpoint.              |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/verify-otp` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] `AdminRespondToAuthChallenge` implementado correctamente.
- [x] Manejo de OTP inválido (HTTP 400), session expirado (HTTP 410) y exceso de intentos (HTTP 429).
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso completo, OTP inválido, session expirado y bloqueo por intentos.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-002-design.md`
- **Endpoint:** `POST /v1/auth/verify-otp` — público, sin token.
