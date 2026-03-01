# AC-001: Registro de Socio mediante Validación de DNI

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 13
**Estado:** Backlog
**Fecha de Creación:** 2026-02-20
**Última Actualización:** 2026-02-27
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
- El Amazon Cognito User Pool está aprovisionado con verificación de email habilitada y auto-registro deshabilitado (la creación de usuario es exclusiva del backend).
- Cognito está configurado para enviar el código OTP de verificación al email del socio al momento de `signUp`.
- El endpoint de registro es públicamente accesible (no requiere token de autenticación).
- El socio potencial NO tiene aún una cuenta activa en Cognito (primer registro).

---

## Criterios de Aceptación

**Flujo Exitoso — Paso 1: Envío de solicitud de registro:**

- [ ] El socio ingresa DNI, email y contraseña en el formulario de registro.
- [ ] El sistema busca el DNI en `SeedMembersTable` y verifica que exista y tenga `account_status = "active"`.
- [ ] Si es válido, el backend crea el usuario en Cognito (estado: `UNCONFIRMED`) sin asignarlo aún al grupo "Member".
- [ ] Cognito envía automáticamente un código OTP de 6 dígitos al email registrado.
- [ ] El sistema retorna HTTP 202 indicando que se envió el código de verificación y que el registro está pendiente de confirmación.

**Flujo Exitoso — Paso 2: Verificación del código OTP:**

- [ ] El socio ingresa el código OTP de 6 dígitos recibido por email.
- [ ] El backend llama a `confirmSignUp` de Cognito con el código OTP.
- [ ] Cognito marca el usuario como `CONFIRMED`.
- [ ] El backend asigna al usuario al grupo "Member" en Cognito.
- [ ] El backend crea el perfil en `MembersTable` de DynamoDB heredando `membership_type` del registro seed.
- [ ] El sistema retorna HTTP 201 con mensaje de éxito y la cuenta queda activa.

**DNI No Encontrado:**

- [ ] Si el DNI no existe en la base seed, el sistema retorna HTTP 404.
- [ ] El mensaje de error indica que debe contactar a la administración del club.
- [ ] No se crea ningún usuario en Cognito ni perfil en DynamoDB.

**DNI Ya Registrado:**

- [ ] Si el DNI ya tiene una cuenta activa en Cognito, el sistema retorna HTTP 409.
- [ ] El mensaje indica que ya existe una cuenta y debe iniciar sesión.
- [ ] No se crea ningún usuario duplicado.

**Socio con Deuda:**

- [ ] Si el registro seed tiene `account_status = "inactive"`, el sistema retorna HTTP 403.
- [ ] El mensaje indica que la membresía está inactiva por deuda pendiente.
- [ ] No se crea ningún usuario en Cognito ni perfil en DynamoDB.

**Código OTP Inválido o Expirado:**

- [ ] Si el código OTP ingresado es incorrecto, el sistema retorna HTTP 400 con mensaje claro.
- [ ] Si el código OTP ha expirado (TTL Cognito: 24 hs), el sistema retorna HTTP 410.
- [ ] El socio puede solicitar el reenvío del código OTP mediante `POST /v1/auth/resend-code`; el endpoint es público.
- [ ] Después de 3 intentos fallidos consecutivos, Cognito bloquea al usuario `UNCONFIRMED` y el sistema retorna HTTP 429.

**Validaciones de Formulario:**

- [ ] Si faltan campos obligatorios, el sistema retorna HTTP 400 con la lista de campos inválidos.
- [ ] Si la contraseña no cumple la política de seguridad, retorna HTTP 422.
- [ ] Si el email ya está en uso, retorna HTTP 409.

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
- **Sin auto-registro en Cognito:** La creación del usuario en Cognito es disparada exclusivamente por el backend Lambda.

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
- [ ] `POST /v1/auth/register` implementado y desplegado en dev (retorna HTTP 202 con mensaje de código enviado).
- [ ] `POST /v1/auth/verify-email` implementado y desplegado en dev (llama a `confirmSignUp` de Cognito; retorna HTTP 201 al confirmar).
- [ ] `POST /v1/auth/resend-code` implementado y desplegado en dev (retorna HTTP 200).
- [ ] Los tres endpoints son públicos (sin token) y excluidos del autorizador de API Gateway.

**Lógica de Negocio:**
- [ ] Búsqueda de DNI contra `SeedMembersTable` implementada correctamente.
- [ ] Validación de `account_status = "inactive"` aplicada antes de cualquier escritura (HTTP 403).
- [ ] Validación de DNI duplicado en Cognito implementada (HTTP 409).
- [ ] Validación de email duplicado implementada (HTTP 409).
- [ ] Creación de usuario Cognito disparada solo desde el backend (auto-registro deshabilitado); estado inicial `UNCONFIRMED`.
- [ ] Tras `confirmSignUp` exitoso: usuario asignado al grupo "Member" y perfil DynamoDB creado.
- [ ] Perfil DynamoDB incluye todos los campos requeridos: `dni`, `full_name`, `membership_type`, `account_status = "active"`, `cognito_user_id`, `email`, `created_at`.
- [ ] Manejo de OTP inválido (HTTP 400), expirado (HTTP 410) y exceso de intentos (HTTP 429).
- [ ] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [ ] Validación de campos (requeridos, política de contraseña) retorna HTTP 400 o HTTP 422.

**Tests:**
- [ ] Tests unitarios cubren: flujo exitoso paso 1, flujo exitoso paso 2, DNI no encontrado, ya registrado, registro inactivo, email duplicado, OTP inválido, OTP expirado y reenvío de código.

**Frontend:**
- [ ] Pantalla de registro conectada a `POST /v1/auth/register`.
- [ ] Pantalla de verificación de código OTP conectada a `POST /v1/auth/verify-email`.
- [ ] Opción "Reenviar código" conectada a `POST /v1/auth/resend-code`.
- [ ] Frontend muestra errores de validación por campo y mapea códigos de error a mensajes amigables.

**General:**
- [ ] Probado manualmente en ambiente dev usando el dataset seed.
- [ ] Código revisado y aprobado.
- [ ] Listo para despliegue.
