# AC-015: Gestión de Reservas por el Manager

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 5
**Estado:** Backlog
**Fecha:** 2026-04-18
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como manager del club,
Quiero ver todas las reservas del día organizado por área y horario, y poder cancelar o bloquear franjas cuando sea necesario,
Para garantizar la correcta operación de las instalaciones y resolver conflictos o situaciones imprevistas.

---

## Valor de Negocio

El manager necesita visibilidad operativa sobre el uso de las instalaciones para anticipar problemas (mantenimiento, eventos especiales, sobreocupación) y actuar sin depender de llamadas o consultas individuales. Esta historia permite al manager controlar la capacidad en tiempo real, bloqueando horarios por mantenimiento o cancelando reservas problemáticas, lo que protege la calidad de servicio del club.

---

## Personas Involucradas

| Persona  | Rol     | Interacción                                                                               |
|----------|---------|-------------------------------------------------------------------------------------------|
| Manager  | Manager | Consulta el calendario de reservas del día; cancela reservas o bloquea franjas horarias   |
| Admin    | Admin   | Tiene acceso a la misma vista con permisos adicionales de configuración de áreas          |
| Socio    | Member  | Es afectado cuando su reserva es cancelada por el Manager (notificación fuera de alcance aquí) |

---

## Precondiciones

- El usuario autenticado tiene rol Manager o Admin.
- Existen áreas configuradas con reservas activas o franjas disponibles.

---

## Criterios de Aceptación

- [ ] El manager puede ver un calendario diario que muestra, para cada área, las franjas horarias del día con las reservas activas (nombre del socio, hora de inicio y fin).
- [ ] El manager puede navegar entre días (anterior/siguiente) para consultar reservas de otros días dentro del mismo mes.
- [ ] El manager puede cancelar cualquier reserva activa desde la vista de calendario, ingresando un motivo obligatorio de cancelación.
- [ ] Al cancelar una reserva como Manager, el cupo del área queda liberado inmediatamente y el contador semanal del socio se decrementa.
- [ ] El manager puede bloquear una franja horaria de un área (por mantenimiento u otro motivo), impidiendo que los socios reserven ese horario.
- [ ] El manager puede desbloquear una franja horaria previamente bloqueada siempre que no haya reservas activas en ese horario.
- [ ] Si el manager intenta bloquear una franja que ya tiene reservas activas, el sistema alerta que existen reservas en ese horario y solicita confirmación; al confirmar, las reservas activas son canceladas automáticamente antes del bloqueo.
- [ ] Las franjas bloqueadas se muestran visualmente diferenciadas en el calendario (ej. color distinto o etiqueta "Bloqueado").
- [ ] El sistema muestra el porcentaje de ocupación diario por área como resumen en el encabezado del calendario.

---

## Fuera de Alcance

- Creación de reservas a nombre de un socio por parte del Manager — diferida a una historia futura de gestión de socios.
- Bloqueos recurrentes o programados (ej. todos los lunes de 8 a 10) — diferidos a una fase posterior.
- Notificación automática al socio cuando su reserva es cancelada por el Manager — diferida a EP-07.
- Configuración de horarios habilitados o capacidad de las áreas — diferida a la historia de administración de áreas (EP-06).
- Reportes o exportación del calendario — diferidos a EP-06.

---

## Reglas de Negocio

- **Acceso por rol:** Solo los roles Manager y Admin pueden cancelar reservas de otros socios o bloquear franjas horarias.
- **Motivo obligatorio:** Al cancelar una reserva como Manager, el sistema exige un motivo que queda registrado en el historial de la reserva.
- **Cancelación con devolución:** Cuando el Manager cancela una reserva, se aplican las mismas devoluciones que en la cancelación por el socio: el cupo se libera y el contador semanal del socio se decrementa, independientemente del tiempo restante para el inicio.
- **Bloqueo con conflicto:** No se puede bloquear una franja con reservas activas sin cancelarlas primero; el sistema solicita confirmación explícita antes de proceder.
- **Bloqueo sin reservas activas:** Un bloqueo sobre una franja sin reservas activas se aplica de inmediato sin confirmación adicional.
- **Ventana de visibilidad:** El Manager puede consultar el calendario del mes actual y el siguiente; no se limita a 7 días como el socio.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                             |
|----------------------|----------------------------------------------------------------------------------------------------|
| AC-012               | Las reservas creadas por socios son las que el Manager visualiza y gestiona.                       |
| AC-013               | La lógica de cancelación con liberación de cupo y contador se reutiliza con permisos ampliados.   |
| AC-009               | El Manager debe ser redirigido al dashboard de gestión tras el login.                              |

---

## Definition of Done

- [ ] Funcionalidad implementada y desplegada en dev (backend y frontend).
- [ ] Tests unitarios escritos y pasando.
- [ ] Probado manualmente en dev con usuario Manager en escenarios de bloqueo con y sin reservas activas.
- [ ] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Mensajes de error:** Todos los errores retornados por el API deben mapearse en el frontend a mensajes en español sin exponer detalles técnicos internos. Esto aplica a toda la plataforma y no es específico de esta historia.
- **Endpoint calendario:** `GET /v1/manager/reservations?date={YYYY-MM-DD}` — requiere rol Manager o Admin en el token Cognito.
- **Endpoint cancelar reserva:** `DELETE /v1/manager/reservations/{reservationId}` con body `{ reason: string }` — requiere rol Manager o Admin.
- **Endpoint bloquear franja:** `POST /v1/area-blocks` con body `{ areaId, date, startTime, endTime, reason }` — requiere rol Manager o Admin.
- **Endpoint desbloquear franja:** `DELETE /v1/area-blocks/{blockId}` — requiere rol Manager o Admin.
- **Tablas DynamoDB:** `reservations` (lectura por área+fecha via GSI), `area-blocks` (PK: `areaId`, SK: `date#startTime`), `member-profiles` (decremento de `weeklyReservationCount` al cancelar).
- **RBAC:** API Gateway Authorizer valida el token Cognito; el Lambda verifica que el grupo del usuario sea `Manager` o `Admin` antes de ejecutar operaciones privilegiadas.
- **Frontend:** Vista de calendario tipo grilla (columnas = áreas, filas = franjas horarias). Shadcn/ui componentes de tabla o grid. Acciones de cancelar y bloquear como menú contextual en cada celda. React Query para fetch del calendario con polling cada 60 segundos o invalidación manual.
- **Design Doc:** `docs/design/AC-015-design.md` (a crear por el Arquitecto).
