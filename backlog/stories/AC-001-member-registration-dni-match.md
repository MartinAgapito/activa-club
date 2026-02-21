# AC-001: Registro de Socio mediante Validación de DNI

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 8
**Estado:** Backlog
**Fecha de Creación:** 2026-02-20
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

- La base de datos seed (importada del sistema on-premise legado) está pre-cargada en DynamoDB con registros válidos de DNI.
- Un registro en la base seed debe incluir como mínimo: `dni`, `full_name`, `membership_type` y `account_status`.
- El Amazon Cognito User Pool está aprovisionado y configurado para aceptar nuevos registros solo desde el backend (auto-registro deshabilitado).
- El endpoint de registro es públicamente accesible (no requiere token de autenticación).
- El socio potencial NO tiene aún una cuenta activa en Cognito (primer registro).

---

## Criterios de Aceptación

**Flujo Exitoso:**

- [ ] El socio ingresa su DNI y el sistema lo busca en la base de datos seed.
- [ ] Si el DNI existe y no tiene deuda, se crea el usuario en Cognito y el perfil en DynamoDB.
- [ ] El socio queda asignado al grupo "Member" en Cognito.
- [ ] El perfil hereda el `membership_type` del registro seed.
- [ ] El sistema retorna HTTP 201 con mensaje de éxito.
- [ ] El socio recibe un email de confirmación vía Cognito.

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

**Validaciones de Formulario:**

- [ ] Si faltan campos obligatorios, el sistema retorna HTTP 400 con la lista de campos inválidos.
- [ ] Si la contraseña no cumple la política de seguridad, retorna HTTP 422.
- [ ] Si el email ya está en uso, retorna HTTP 409.

---

## Fuera de Alcance

- Login con redes sociales (Google, Facebook) — no forma parte del MVP.
- Recuperación de cuenta — cubierto en historia futura.
- Autenticación de dos factores (2FA) — diferido a historia de seguridad post-MVP.
- Subida de foto de perfil — diferido a historia de gestión de perfil.
- Pago de membresía durante el registro — cubierto en AC-004.

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

- [ ] Endpoint backend `POST /v1/auth/register` implementado y desplegado en dev.
- [ ] Búsqueda de DNI contra la tabla seed de DynamoDB implementada correctamente.
- [ ] Validación de `account_status = "inactive"` aplicada antes de cualquier escritura (HTTP 403).
- [ ] Validación de DNI duplicado en Cognito implementada (HTTP 409).
- [ ] Validación de email duplicado implementada (HTTP 409).
- [ ] Creación de usuario Cognito disparada solo desde el backend (auto-registro deshabilitado).
- [ ] Usuario Cognito asignado al grupo "Member" inmediatamente tras su creación.
- [ ] Perfil DynamoDB creado con todos los campos requeridos: `dni`, `full_name`, `membership_type`, `account_status`, `cognito_user_id`, `email`, `created_at`.
- [ ] Todos los errores siguen el esquema estándar de respuesta de error del API.
- [ ] Validación de campos (requeridos, política de contraseña) retorna HTTP 400 o HTTP 422.
- [ ] Tests unitarios cubren: flujo exitoso, DNI no encontrado, ya registrado, registro inactivo y email duplicado.
- [ ] Endpoint es público (sin token) y excluido del autorizador de API Gateway.
- [ ] Pantalla de registro en frontend implementada y conectada a `POST /v1/auth/register`.
- [ ] Frontend muestra errores de validación por campo y mapea códigos de error a mensajes amigables.
- [ ] Probado manualmente en ambiente dev usando el dataset seed.
- [ ] Código revisado y aprobado.
- [ ] Listo para despliegue.
