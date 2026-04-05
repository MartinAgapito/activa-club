# AC-002: Registro de Socio — Validación DNI y Creación de Cuenta

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 5
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio potencial,
Quiero registrarme con mi DNI,
Para que el sistema valide que soy miembro del club antes de crear mi cuenta.

---

## Valor de Negocio

Este es el primer paso del proceso de onboarding.
La validación del DNI contra los datos del sistema legado garantiza que solo personas
pre-aprobadas por el club puedan crear una cuenta, preservando la integridad del registro
de socios y eliminando altas no autorizadas.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                             |
|----------------------|--------|---------------------------------------------------------|
| Socio Potencial      | Member | Completa el formulario de registro con DNI, email y contraseña |
| Administrador        | Admin  | Pre-cargó los datos seed que este endpoint consulta     |

---

## Precondiciones

- `SeedMembersTable` poblada (AC-001 completado).
- Cognito User Pool aprovisionado con verificación de email habilitada y MFA en modo ON.
- El endpoint es público — no requiere token de autenticación.

---

## Criterios de Aceptación

- [x] DNI no encontrado en `SeedMembersTable` → HTTP 404.
- [x] `account_status = inactive` en el registro seed → HTTP 403.
- [x] DNI ya registrado en Cognito → HTTP 409.
- [x] Email ya en uso en Cognito → HTTP 409.
- [x] Campos obligatorios ausentes o mal formados → HTTP 400 con lista de campos inválidos.
- [x] Contraseña que no cumple la política de seguridad → HTTP 422.
- [x] Flujo exitoso: datos válidos → el socio recibe un email de verificación → HTTP 202.
- [x] Todos los errores siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Verificación del código OTP — cubierta en AC-003.
- Login del socio — cubierto en AC-005.
- Pago de membresía durante el registro — cubierto en EP-04.
- Login con redes sociales — no forma parte del MVP.

---

## Reglas de Negocio

- **DNI obligatorio:** Solo se permite el registro si el DNI existe en `SeedMembersTable`.
- **Validación de deuda:** `account_status = inactive` bloquea el registro (HTTP 403).
- **DNI único:** Un DNI no puede estar registrado más de una vez en Cognito (HTTP 409).
- **Email único:** Un email no puede estar registrado más de una vez en Cognito (HTTP 409).
- **Política de contraseña:** Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.
- **Sin llamadas directas a Cognito desde el frontend:** Solo el backend Lambda llama a la API `SignUp`.

---

## Dependencias

| Historia / Artefacto | Motivo                                                              |
|----------------------|---------------------------------------------------------------------|
| AC-001               | `SeedMembersTable` debe estar poblada para validar el DNI.          |
| AC-003               | Paso 2 del registro: verificación del OTP enviado en este paso.     |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/register` implementado y desplegado en dev.
- [x] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [x] Validación de DNI contra `SeedMembersTable` implementada correctamente.
- [x] Validación de `account_status = inactive` aplicada antes de cualquier escritura.
- [x] Validación de DNI duplicado en Cognito implementada (HTTP 409).
- [x] Validación de email duplicado implementada (HTTP 409).
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Tests unitarios cubren: flujo exitoso, DNI no encontrado, cuenta inactiva, DNI duplicado, email duplicado, campos inválidos y contraseña inválida.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-001-design.md`
- **Endpoint:** `POST /v1/auth/register` — público, sin token.
