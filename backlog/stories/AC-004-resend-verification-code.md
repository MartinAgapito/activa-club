# AC-004: Reenvío de Link de Verificación de Email

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Media
**Story Points:** 2
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio potencial,
Quiero solicitar el reenvío del link de verificación si no lo recibí o expiró,
Para poder completar la verificación de mi cuenta sin tener que registrarme nuevamente.

---

## Valor de Negocio

El reenvío del link evita que el socio quede bloqueado en el proceso de registro
por problemas de entrega de email o por expiración del token.
Sin este mecanismo, el socio debería registrarse nuevamente, generando inconsistencias
en Cognito y degradando la experiencia de usuario.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                    |
|----------------------|--------|----------------------------------------------------------------|
| Socio Potencial      | Member | Solicita el reenvío del link desde la pantalla de verificación |

---

## Precondiciones

- AC-002 completado: el socio completó el formulario de registro.
- El usuario existe en Cognito con estado `UNCONFIRMED`.
- El endpoint es público — no requiere token de autenticación.

---

## Criterios de Aceptación

- [x] Email no encontrado en Cognito → HTTP 404.
- [x] Límite de reenvíos excedido (definido por Cognito) → HTTP 429.
- [x] Flujo exitoso: solicitud válida → el socio recibe un nuevo link de verificación por email (con plantilla HTML profesional) → HTTP 200.
- [x] El nuevo link enviado permite completar la verificación de la misma forma que el link original.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Reenvío de código OTP para el flujo de login — ese flujo es distinto y no aplica aquí.
- Configuración del límite de reenvíos — es un parámetro de Cognito, no de esta historia.

---

## Reglas de Negocio

- **Solo para cuentas UNCONFIRMED:** El reenvío solo aplica a usuarios que aún no completaron la verificación de email.
- **Límite de reenvíos:** Existe un límite nativo de reenvíos; al superarlo el sistema retorna HTTP 429.
- **Link, no OTP:** El reenvío envía un nuevo link de verificación; no se envía un código OTP de 6 dígitos. El nuevo email usa la misma plantilla HTML profesional que el original.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                   |
|----------------------|--------------------------------------------------------------------------|
| AC-002               | El usuario debe existir en Cognito con estado `UNCONFIRMED`.             |
| AC-003               | Este endpoint es el paso previo cuando el token expira antes de verificar. |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/resend-code` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] Reenvío del link implementado correctamente; el nuevo email usa la plantilla HTML profesional.
- [x] Manejo de email no encontrado (HTTP 404) y límite excedido (HTTP 429).
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso, email no encontrado y límite de reenvíos excedido.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-001-design.md`
- **Endpoint:** `POST /v1/auth/resend-code` — público, sin token.
- **Lambda Trigger:** El `CustomEmailSender` se invoca también en el reenvío; no requiere lógica adicional en este endpoint.
