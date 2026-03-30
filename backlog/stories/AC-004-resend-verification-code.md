# AC-004: Reenvío de Código de Verificación de Email

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Media
**Story Points:** 2
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio potencial,
Quiero solicitar el reenvío del código OTP si no lo recibí o expiró,
Para poder completar la verificación de mi cuenta sin tener que registrarme nuevamente.

---

## Valor de Negocio

El reenvío del código evita que el socio quede bloqueado en el proceso de registro
por problemas de entrega de email o por expiración del código.
Sin este mecanismo, el socio debería registrarse nuevamente, generando inconsistencias
en Cognito y degradando la experiencia de usuario.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                  |
|----------------------|--------|--------------------------------------------------------------|
| Socio Potencial      | Member | Solicita el reenvío del OTP desde la pantalla de verificación |

---

## Precondiciones

- AC-002 completado: el socio completó el formulario de registro.
- El usuario existe en Cognito con estado `UNCONFIRMED`.
- El endpoint es público — no requiere token de autenticación.

---

## Criterios de Aceptación

- [x] Email no encontrado en Cognito → HTTP 404.
- [x] Límite de reenvíos excedido (definido por Cognito) → HTTP 429.
- [x] Flujo exitoso: backend llama a `ResendConfirmationCode` de Cognito → Cognito envía un nuevo OTP al email → HTTP 200.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Reenvío de código OTP para el flujo de login — ese flujo es distinto y no aplica aquí.
- Configuración del límite de reenvíos — es un parámetro de Cognito, no de esta historia.

---

## Reglas de Negocio

- **Solo para cuentas UNCONFIRMED:** El reenvío solo aplica a usuarios que aún no completaron la verificación de email.
- **Límite de Cognito:** Cognito aplica un límite nativo de reenvíos; al superarlo retorna error y el sistema mapea a HTTP 429.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                   |
|----------------------|--------------------------------------------------------------------------|
| AC-002               | El usuario debe existir en Cognito con estado `UNCONFIRMED`.             |
| AC-003               | Este endpoint es el paso previo cuando el OTP expira antes de verificar. |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/resend-code` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] Llamada a `ResendConfirmationCode` de Cognito implementada correctamente.
- [x] Manejo de email no encontrado (HTTP 404) y límite excedido (HTTP 429).
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso, email no encontrado y límite de reenvíos excedido.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-001-design.md`
- **Endpoint:** `POST /v1/auth/resend-code` — público, sin token.
