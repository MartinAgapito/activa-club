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
- [x] Flujo exitoso: OTP válido → HTTP 200 con los tres tokens JWT (`AccessToken`, `IdToken`, `RefreshToken`).
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.
- [x] El email con el OTP usa la plantilla HTML profesional: código OTP visualmente destacado (tipografía grande, box con contraste), advertencia de expiración de 3 minutos, mensaje de seguridad ("Si no solicitaste este código, ignorá este email"), diseño responsive apto para móvil y escritorio.

---

## Fuera de Alcance

- Refresh automático de tokens — diferido a historia transversal de gestión de sesión.
- Opción "Recordar dispositivo" — diferida a AC-010.
- Revocación de tokens (logout) — diferida a historia de cierre de sesión.

---

## Reglas de Negocio

- **TTL del session token:** El session token del paso 1 tiene un TTL de 3 minutos. Si expira, el flujo completo debe reiniciarse desde AC-005.
- **Invalidación por intentos:** Tras 3 intentos OTP incorrectos en la misma sesión, la sesión queda invalidada y no puede reutilizarse.
- **Tokens seguros:** Los tokens de acceso no deben almacenarse en `localStorage`; se requiere almacenamiento en memoria o cookie segura.
- **Plantilla HTML obligatoria:** El email con el OTP de login debe usar la plantilla HTML profesional; no se acepta texto plano.
- **Código OTP destacado:** El código de 6 dígitos debe ser visualmente prominente en el email para facilitar la lectura en móvil.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                           |
|----------------------|----------------------------------------------------------------------------------|
| AC-005               | Paso previo: provee el `session` token requerido por este endpoint.              |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/verify-otp` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] Verificación del OTP implementada correctamente; emite los tres tokens JWT en la respuesta exitosa.
- [x] Manejo de OTP inválido (HTTP 400), session expirado (HTTP 410) y exceso de intentos (HTTP 429).
- [x] Email OTP usa plantilla HTML profesional validada: código destacado, advertencia de expiración, mensaje de seguridad, diseño responsive.
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso completo, OTP inválido, session expirado y bloqueo por intentos.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-002-design.md`
- **Endpoint:** `POST /v1/auth/verify-otp` — público, sin token.
- **Lambda Trigger:** `CustomEmailSender` en Cognito reemplaza el email de texto plano del OTP de login por la plantilla HTML profesional.
