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
Quiero hacer clic en el link de verificación recibido por email,
Para activar mi cuenta y que se cree mi perfil en el sistema.

---

## Valor de Negocio

La verificación del email es el segundo y último paso del registro.
Al confirmar la identidad mediante un link firmado, el sistema garantiza que el socio es el titular
real del email registrado. Solo tras esta confirmación se crea el perfil en DynamoDB
y se asigna el rol "Member" en Cognito, habilitando el acceso completo a la plataforma.
El uso de link (en lugar de OTP manual) mejora la experiencia de usuario al eliminar la fricción
de copiar y pegar un código de 6 dígitos.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                     |
|----------------------|--------|-----------------------------------------------------------------|
| Socio Potencial      | Member | Hace clic en el link de verificación recibido por email         |

---

## Precondiciones

- AC-002 completado: el socio envió el formulario de registro y recibió el email de verificación.
- El usuario existe en Cognito con estado `UNCONFIRMED`.
- El endpoint es público — no requiere token de autenticación.
- El Lambda Trigger `CustomEmailSender` está configurado en el Cognito User Pool para reemplazar el email por defecto con la plantilla HTML profesional.

---

## Criterios de Aceptación

- [x] Token inválido (link manipulado o malformado) → HTTP 400.
- [x] Token expirado (TTL Cognito: 24 hs) → HTTP 410.
- [x] Más de 3 intentos fallidos consecutivos → HTTP 429; Cognito bloquea al usuario.
- [x] Flujo exitoso: el socio hace clic en el link → el frontend extrae `email` y `token` de los query params de la URL → llama a `POST /v1/auth/verify-email` con `{ email, token }` → backend llama a `ConfirmSignUp` → Cognito marca el usuario como `CONFIRMED` → backend llama a `AdminAddUserToGroup("Member")` → backend crea el perfil en `MembersTable` → HTTP 201.
- [x] El perfil creado en `MembersTable` incluye los campos: `dni`, `full_name`, `membership_type`, `account_status = active`, `cognito_user_id`, `email`, `created_at`.
- [x] El `membership_type` se hereda del registro en `SeedMembersTable`.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.
- [x] El email enviado por Cognito usa la plantilla HTML profesional (ver criterio de plantilla más abajo).
- [x] Plantilla HTML del email de verificación: incluye logo y nombre "Activa Club", mensaje de bienvenida personalizado con el nombre del socio, botón CTA "Verificar mi cuenta" que apunta al link de verificación, diseño responsive apto para móvil y escritorio, footer con datos del club. Implementado via Lambda Trigger `CustomEmailSender` en Cognito.

---

## Fuera de Alcance

- Reenvío del link de verificación — cubierto en AC-004.
- Login del socio tras el registro — cubierto en AC-005.
- Edición del perfil — diferida a historia de gestión de perfil post-MVP.

---

## Reglas de Negocio

- **Grupo Cognito:** El socio debe ser asignado al grupo "Member" mediante `AdminAddUserToGroup` inmediatamente después de la confirmación.
- **Herencia de membresía:** El `membership_type` se copia desde `SeedMembersTable` al perfil en `MembersTable`.
- **Perfil atómico:** Si la creación del perfil en DynamoDB falla tras confirmar en Cognito, el sistema debe registrar el error para reintento manual. No se revierte el estado en Cognito.
- **TTL del token:** El token de verificación tiene un TTL de 24 horas (configurado en Cognito).
- **Parámetros via query string:** El frontend recibe el link con la forma `?email=...&token=...` y los envía al backend en el body de `POST /v1/auth/verify-email`.
- **Plantilla HTML obligatoria:** El email de verificación debe usar la plantilla HTML profesional definida en el Lambda Trigger `CustomEmailSender`; no se acepta el email de texto plano por defecto de Cognito.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                      |
|----------------------|-----------------------------------------------------------------------------|
| AC-002               | Paso previo: el usuario debe existir en Cognito con estado `UNCONFIRMED`.   |
| AC-004               | Si el token expira, el socio puede solicitar reenvío del link.              |
| AC-005               | El login requiere que la cuenta esté `CONFIRMED` y el perfil exista.        |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/verify-email` implementado y desplegado en dev; acepta `{ email, token }`.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] Llamada a `ConfirmSignUp` implementada correctamente con el token recibido.
- [x] Asignación al grupo "Member" via `AdminAddUserToGroup` implementada.
- [x] Creación del perfil en `MembersTable` con todos los campos requeridos implementada.
- [x] Manejo de token inválido (HTTP 400), expirado (HTTP 410) y exceso de intentos (HTTP 429).
- [x] Lambda Trigger `CustomEmailSender` implementado con la plantilla HTML profesional.
- [x] Plantilla HTML validada: responsive, botón CTA funcional, logo/nombre del club, footer.
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso completo, token inválido, token expirado y bloqueo por intentos.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-001-design.md`
- **Endpoint:** `POST /v1/auth/verify-email` — público, sin token. Recibe `{ email, token }` desde los query params del link.
- **Lambda Trigger:** `CustomEmailSender` en Cognito reemplaza el email de texto plano por la plantilla HTML.
