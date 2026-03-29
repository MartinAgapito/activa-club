# AC-001: Registro de Socio mediante Validación de DNI

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 13
**Estado:** Done
**Fecha de Creación:** 2026-02-20
**Última Actualización:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio potencial,
Quiero registrarme en la plataforma ActivaClub usando mi DNI,
Para que el sistema pueda verificar mi identidad contra el registro del club y otorgarme acceso a todas las funcionalidades de socio.

---

## Valor de Negocio

Esta historia es el punto de entrada de todo el ciclo de vida de un socio en la plataforma.
Sin un registro exitoso, ningún socio puede hacer reservas, invitar invitados ni pagar su membresía.
El mecanismo de validación por DNI garantiza que solo personas pre-aprobadas por el club puedan crear una cuenta,
preservando la integridad de la base de datos migrada del sistema legado y eliminando registros no autorizados.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                               |
| -------------------- | ------ | ------------------------------------------------------------------------- |
| Nuevo Socio del Club | Member | Inicia el registro usando su DNI                                          |
| Administrador        | Admin  | Pre-carga la base de datos seed; revisa cuentas de socios si es necesario |

---

## Precondiciones

- El script `seed-legacy-members.ts` ha sido ejecutado y la tabla `SeedMembersTable` en DynamoDB contiene los registros importados del sistema on-premise del club.
- Un registro en la base seed debe incluir como mínimo: `dni`, `full_name`, `membership_type` y `account_status`.
- El script valida el CSV de origen (requeridos: `dni`, `firstName`, `lastName`) y omite duplicados mediante `GSI_DNI`; los registros se insertan con `status = Pending`.
- El Amazon Cognito User Pool está aprovisionado con verificación de email habilitada. La creación de usuarios se realiza exclusivamente desde el backend Lambda mediante la API pública `SignUp` (el frontend nunca llama a Cognito directamente). `AllowAdminCreateUserOnly = false` es requerido para usar `SignUp`.
- Cognito está configurado para enviar el código OTP de verificación al email del socio al momento de `SignUp`.
- El endpoint de registro es públicamente accesible (no requiere token de autenticación).
- El socio potencial NO tiene aún una cuenta activa en Cognito (primer registro).

---

## Criterios de Aceptación

**Flujo Exitoso — Paso 1: Envío de solicitud de registro:**

- [x] El socio ingresa DNI, email y contraseña en el formulario de registro.
- [x] El sistema busca el DNI en `SeedMembersTable` y verifica que exista y tenga `account_status = "active"`.
- [x] Si es válido, el backend llama a `SignUp` de Cognito y crea el usuario en estado `UNCONFIRMED`, sin asignarlo aún al grupo "Member".
- [x] Cognito envía automáticamente un código OTP de 6 dígitos al email registrado.
- [x] El sistema retorna HTTP 202 indicando que se envió el código de verificación y que el registro está pendiente de confirmación.

**Flujo Exitoso — Paso 2: Verificación del código OTP:**

- [x] El socio ingresa el código OTP de 6 dígitos recibido por email.
- [x] El backend llama a `ConfirmSignUp` de Cognito con el código OTP.
- [x] Cognito marca el usuario como `CONFIRMED`.
- [x] El backend asigna al usuario al grupo "Member" en Cognito (`AdminAddUserToGroup`).
- [x] El backend crea el perfil en `MembersTable` de DynamoDB heredando `membership_type` del registro seed.
- [x] El sistema retorna HTTP 201 con mensaje de éxito y la cuenta queda activa.

**DNI No Encontrado:**

- [x] Si el DNI no existe en la base seed, el sistema retorna HTTP 404.
- [x] El mensaje de error indica que debe contactar a la administración del club.
- [x] No se crea ningún usuario en Cognito ni perfil en DynamoDB.

**DNI Ya Registrado:**

- [x] Si el DNI ya tiene una cuenta activa en Cognito, el sistema retorna HTTP 409.
- [x] El mensaje indica que ya existe una cuenta y debe iniciar sesión.
- [x] No se crea ningún usuario duplicado.

**Socio con Deuda:**

- [x] Si el registro seed tiene `account_status = "inactive"`, el sistema retorna HTTP 403.
- [x] El mensaje indica que la membresía está inactiva por deuda pendiente.
- [x] No se crea ningún usuario en Cognito ni perfil en DynamoDB.

**Código OTP Inválido o Expirado:**

- [x] Si el código OTP ingresado es incorrecto, el sistema retorna HTTP 400 con mensaje claro.
- [x] Si el código OTP ha expirado (TTL Cognito: 24 hs), el sistema retorna HTTP 410.
- [x] El socio puede solicitar el reenvío del código OTP mediante `POST /v1/auth/resend-code`; el endpoint es público.
- [x] Después de 3 intentos fallidos consecutivos, Cognito bloquea al usuario `UNCONFIRMED` y el sistema retorna HTTP 429.

**Validaciones de Formulario:**

- [x] Si faltan campos obligatorios, el sistema retorna HTTP 400 con la lista de campos inválidos.
- [x] Si la contraseña no cumple la política de seguridad, retorna HTTP 422.
- [x] Si el email ya está en uso, retorna HTTP 409.

---

## Fuera de Alcance

- Login con redes sociales (Google, Facebook) — no forma parte del MVP.
- Recuperación de cuenta (contraseña olvidada) — cubierto en historia futura.
- TOTP con aplicación de autenticación (Google Authenticator, Authy) — diferido a historia de seguridad post-MVP.
- Subida de foto de perfil — diferido a historia de gestión de perfil.
- Pago de membresía durante el registro — cubierto en AC-004.
- OTP en el login (MFA post-autenticación) — cubierto en AC-002.

---

## Reglas de Negocio

- **DNI obligatorio:** El registro solo es posible si el DNI existe en la base seed precargada.
- **Validación de deuda:** Si `account_status = "inactive"` en el seed, el registro es bloqueado (HTTP 403).
- **DNI único:** Un solo Cognito por DNI. Duplicados rechazados con HTTP 409.
- **Email único:** Un solo Cognito por email. Duplicados rechazados con HTTP 409.
- **Herencia de membresía:** El `membership_type` (VIP, Gold, Silver) se copia del seed al perfil DynamoDB.
- **Grupo Cognito:** Todo socio registrado debe ser asignado al grupo "Member" inmediatamente.
- **Política de contraseña:** Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.
- **Sin llamadas directas desde el frontend a Cognito:** El backend Lambda es el único que llama a la API `SignUp` de Cognito. El frontend solo consume los endpoints REST del backend.

---

## Dependencias

| Historia / Artefacto     | Motivo                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| Importación de Seed DB   | Los datos deben estar pre-cargados antes de cualquier registro.      |
| AC-002 Login de Socio    | El login depende de la cuenta Cognito creada en esta historia.       |
| AC-003 Perfil de Socio   | La vista de perfil depende del registro DynamoDB creado aquí.        |
| AC-004 Pago de Membresía | El flujo de pago requiere una cuenta activa creada en esta historia. |

---

## Definition of Done

**Script de Seed:**
- [ ] Script `seed-legacy-members.ts` ejecutado exitosamente en el ambiente dev.
- [ ] Tabla `SeedMembersTable` poblada con al menos un dataset de prueba; resumen de ejecución (insertados / omitidos / errores) documentado.

**Endpoints:**
- [x] `POST /v1/auth/register` implementado y desplegado en dev (retorna HTTP 202 con mensaje de código enviado).
- [x] `POST /v1/auth/verify-email` implementado y desplegado en dev (llama a `confirmSignUp` de Cognito; retorna HTTP 201 al confirmar).
- [x] `POST /v1/auth/resend-code` implementado y desplegado en dev (retorna HTTP 200).
- [x] Los tres endpoints son públicos (sin token) y excluidos del autorizador de API Gateway.

**Lógica de Negocio:**
- [x] Búsqueda de DNI contra `SeedMembersTable` implementada correctamente.
- [x] Validación de `account_status = "inactive"` aplicada antes de cualquier escritura (HTTP 403).
- [x] Validación de DNI duplicado en Cognito implementada (HTTP 409).
- [x] Validación de email duplicado implementada (HTTP 409).
- [x] Creación de usuario Cognito disparada solo desde el backend (via `SignUp` API); estado inicial `UNCONFIRMED`.
- [x] Tras `confirmSignUp` exitoso: usuario asignado al grupo "Member" y perfil DynamoDB creado.
- [x] Perfil DynamoDB incluye todos los campos requeridos: `dni`, `full_name`, `membership_type`, `account_status = "active"`, `cognito_user_id`, `email`, `created_at`.
- [x] Manejo de OTP inválido (HTTP 400), expirado (HTTP 410) y exceso de intentos (HTTP 429).
- [x] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [x] Validación de campos (requeridos, política de contraseña) retorna HTTP 400 o HTTP 422.

**Tests:**
- [x] Tests unitarios cubren: flujo exitoso paso 1, flujo exitoso paso 2, DNI no encontrado, ya registrado, registro inactivo, email duplicado, OTP inválido, OTP expirado y reenvío de código.

**Frontend:**
- [x] Pantalla de registro conectada a `POST /v1/auth/register`.
- [x] Pantalla de verificación de código OTP conectada a `POST /v1/auth/verify-email`.
- [x] Opción "Reenviar código" conectada a `POST /v1/auth/resend-code`.
- [x] Frontend muestra errores de validación por campo y mapea códigos de error a mensajes amigables.

**General:**
- [x] Probado manualmente en ambiente dev usando el dataset seed.
- [x] Código revisado y aprobado (PR mergeado a main).
- [x] Listo para despliegue.
