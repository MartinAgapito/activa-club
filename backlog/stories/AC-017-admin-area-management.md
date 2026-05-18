# AC-017: Gestión de Áreas por el Admin (CRUD)

**Epic:** EP-06 - Panel de Administración (Admin Dashboard)
**Prioridad:** Alta
**Story Points:** 5
**Estado:** Done
**Fecha:** 2026-05-17
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como administrador del club,
Quiero crear, editar y activar/desactivar las áreas del club desde el panel de administración,
Para mantener actualizado el catálogo de instalaciones disponibles para reservas sin depender de cambios manuales en la base de datos.

---

## Valor de Negocio

Las áreas son la entidad central que habilita el sistema de reservas. Sin una interfaz de gestión, cualquier cambio en el catálogo de instalaciones (nueva cancha, cierre temporal de un área, modificación de capacidad) requiere intervención técnica directa sobre la base de datos. Esta historia elimina esa dependencia, dando al administrador control operativo completo sobre las instalaciones del club.

---

## Personas Involucradas

| Persona | Rol   | Interacción                                                                              |
|---------|-------|------------------------------------------------------------------------------------------|
| Admin   | Admin | Crea, edita y activa/desactiva áreas desde el panel de administración                    |
| Manager | Manager | Visualiza las áreas activas al gestionar el calendario de reservas (AC-015)           |
| Socio   | Member  | Solo ve las áreas activas y accesibles según su membresía al consultar disponibilidad |

---

## Precondiciones

- El usuario autenticado tiene rol Admin.
- El sistema tiene al menos un área registrada (puede provenir del seed de datos AC-001).

---

## Criterios de Aceptación

- [x] El Admin puede ver la lista completa de áreas registradas en el sistema, con nombre, capacidad máxima, tipos de membresía habilitados y estado (activo/inactivo).
- [x] El Admin puede crear una nueva área ingresando nombre, capacidad máxima y tipos de membresía que tienen acceso.
- [x] El Admin puede editar los datos de un área existente (nombre, capacidad máxima, tipos de membresía habilitados).
- [x] El Admin puede activar o desactivar un área mediante un toggle de estado; un área inactiva no aparece en la consulta de disponibilidad ni puede recibir nuevas reservas.
- [x] Si el Admin intenta guardar un área con campos obligatorios vacíos, el sistema muestra los errores de validación correspondientes sin enviar la solicitud al servidor.
- [x] Si el Admin intenta crear un área con un nombre ya existente, el sistema informa el conflicto con un mensaje claro.
- [x] Tras crear o editar un área exitosamente, la tabla de áreas se actualiza automáticamente reflejando los cambios sin recargar la página.
- [x] La opción de gestión de áreas está disponible en el sidebar de navegación bajo el rol Admin.

---

## Fuera de Alcance

- Configuración de franjas horarias habilitadas por área — diferida a una historia futura de administración avanzada.
- Eliminación permanente de áreas — no forma parte del MVP; el flujo de desactivación cubre la necesidad operativa.
- Asignación de precios por área o tipo de reserva — no aplica en el modelo de negocio del MVP.
- Historial de cambios de un área (auditoría) — diferido a una fase posterior.
- Gestión de áreas por rol Manager — exclusiva del rol Admin.

---

## Reglas de Negocio

- **Acceso exclusivo del Admin:** Solo los usuarios con rol Admin pueden crear, editar o cambiar el estado de las áreas.
- **Área inactiva bloqueada:** Un área desactivada no es visible en la consulta de disponibilidad de socios ni en el calendario del Manager; tampoco puede recibir nuevas reservas.
- **Reservas existentes al desactivar:** Desactivar un área no cancela automáticamente las reservas futuras ya confirmadas; esa gestión corresponde al Manager desde AC-015.
- **Nombre único:** El nombre de un área debe ser único en el sistema; no se permiten duplicados.
- **Tipos de membresía como restricción de acceso:** Al crear o editar un área, el Admin define qué tipos de membresía (Silver, Gold, VIP) tienen habilitado el acceso; esta configuración es la base del filtrado en AC-011.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                            |
|----------------------|---------------------------------------------------------------------------------------------------|
| AC-001               | El seed de datos puede incluir áreas iniciales; esta historia permite modificarlas desde la UI.   |
| AC-011               | La consulta de disponibilidad filtra áreas activas y accesibles según la configuración definida aquí. |
| AC-012               | La creación de reservas valida que el área esté activa y habilitada para el tipo de membresía del socio. |
| AC-015               | El calendario del Manager solo muestra áreas activas; los cambios aquí se reflejan en esa vista. |
| AC-009               | El Admin debe ser redirigido al panel de administración tras el login.                            |

---

## Definition of Done

- [x] Endpoints backend implementados y desplegados en dev.
- [x] Control de acceso por rol Admin aplicado en todos los endpoints.
- [x] Frontend implementado con tabla, modales de crear/editar y toggle de estado.
- [x] Tests unitarios escritos y pasando.
- [x] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Endpoints implementados:**
  - `GET /v1/admin/areas` — lista todas las áreas (activas e inactivas); requiere rol Admin.
  - `POST /v1/admin/areas` — crea un área nueva; body: `{ name, maxCapacity, allowedMembershipTypes[] }`.
  - `PUT /v1/admin/areas/:areaId` — actualiza nombre, capacidad y tipos habilitados de un área existente.
  - `PATCH /v1/admin/areas/:areaId/status` — activa o desactiva un área; body: `{ isActive: boolean }`.
- **Componentes frontend implementados:** `AreaManagementPage` (tabla con columnas: nombre, capacidad, membresías habilitadas, estado), modales de crear y editar área, toggle de activación/desactivación por fila.
- **Navegación:** Ítem "Áreas" añadido al sidebar bajo el menú de rol Admin.
- **Tabla DynamoDB:** `areas` (PK: `areaId`; campos: `name`, `maxCapacity`, `allowedMembershipTypes`, `isActive`).
- **RBAC:** Cognito Authorizer valida el token; el Lambda verifica que el grupo del usuario sea `Admin` antes de ejecutar cualquier operación de escritura.
- **Design Doc:** `docs/design/AC-017-design.md`.
