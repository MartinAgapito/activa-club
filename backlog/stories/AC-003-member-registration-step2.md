# AC-003: Registro de Socio — Verificación de Email y Creación de Perfil

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 5
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio potencial,
Quiero verificar mi email con el código OTP recibido,
Para activar mi cuenta y que se cree mi perfil en el sistema.

---

## Valor de Negocio

La verificación del email es el segundo y último paso del registro.
Al confirmar la identidad mediante OTP, el sistema garantiza que el socio es el titular
real del email registrado. Solo tras esta confirmación se crea el perfil en DynamoDB
y se asigna el rol "Member" en Cognito, habilitando el acceso completo a la plataforma.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                               |
|----------------------|--------|-----------------------------------------------------------|
| Socio Potencial      | Member | Ingresa el código OTP recibido por email para confirmar su cuenta |

---

## Precondiciones

- AC-002 completado: el socio envió el formulario de registro y recibió el OTP.
- El usuario existe en Cognito con estado `UNCONFIRMED`.
- El endpoint es público — no requiere token de autenticación.

---

## Criterios de Aceptación

- [x] OTP inválido (código incorrecto) → HTTP 400.
- [x] OTP expirado (TTL Cognito: 24 hs) → HTTP 410.
- [x] Más de 3 intentos fallidos consecutivos → HTTP 429; Cognito bloquea al usuario.
- [x] Flujo exitoso: backend llama a `ConfirmSignUp` → Cognito marca el usuario como `CONFIRMED` → backend llama a `AdminAddUserToGroup("Member")` → backend crea el perfil en `MembersTable` → HTTP 201.
- [x] El perfil creado en `MembersTable` incluye los campos: `dni`, `full_name`, `membership_type`, `account_status = active`, `cognito_user_id`, `email`, `created_at`.
- [x] El `membership_type` se hereda del registro en `SeedMembersTable`.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Reenvío del código OTP — cubierto en AC-004.
- Login del socio tras el registro — cubierto en AC-005.
- Edición del perfil — diferida a historia de gestión de perfil post-MVP.

---

## Reglas de Negocio

- **Grupo Cognito:** El socio debe ser asignado al grupo "Member" mediante `AdminAddUserToGroup` inmediatamente después de la confirmación.
- **Herencia de membresía:** El `membership_type` se copia desde `SeedMembersTable` al perfil en `MembersTable`.
- **Perfil atómico:** Si la creación del perfil en DynamoDB falla tras confirmar en Cognito, el sistema debe registrar el error para reintento manual. No se revierte el estado en Cognito.
- **TTL del OTP:** El código OTP tiene un TTL de 24 horas (configurado en Cognito).

---

## Dependencias

| Historia / Artefacto | Motivo                                                                      |
|----------------------|-----------------------------------------------------------------------------|
| AC-002               | Paso previo: el usuario debe existir en Cognito con estado `UNCONFIRMED`.   |
| AC-004               | Si el OTP expira, el socio puede solicitar reenvío antes de reintentar.     |
| AC-005               | El login requiere que la cuenta esté `CONFIRMED` y el perfil exista.        |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/verify-email` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] Llamada a `ConfirmSignUp` implementada correctamente.
- [x] Asignación al grupo "Member" via `AdminAddUserToGroup` implementada.
- [x] Creación del perfil en `MembersTable` con todos los campos requeridos implementada.
- [x] Manejo de OTP inválido (HTTP 400), expirado (HTTP 410) y exceso de intentos (HTTP 429).
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso completo, OTP inválido, OTP expirado y bloqueo por intentos.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-001-design.md`
- **Endpoint:** `POST /v1/auth/verify-email` — público, sin token.
