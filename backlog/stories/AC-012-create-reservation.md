# AC-012: Creación de Reserva por el Socio

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 8
**Estado:** Backlog
**Fecha:** 2026-04-18
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio activo,
Quiero reservar un área del club para una fecha, hora y duración específicas,
Para garantizar mi lugar en la instalación antes de llegar al club.

---

## Valor de Negocio

La creación de reservas es el núcleo del epic EP-02 y el flujo de mayor valor para el socio. Sin esta capacidad, todo el proceso de disponibilidad y gestión de cupos carece de sentido. Digitalizar la reserva elimina el proceso manual por teléfono, reduce conflictos de doble asignación y permite al club operar con información en tiempo real sobre la ocupación de sus instalaciones.

---

## Personas Involucradas

| Persona          | Rol    | Interacción                                                                            |
|------------------|--------|----------------------------------------------------------------------------------------|
| Socio Activo     | Member | Selecciona área, fecha, hora y duración; confirma la reserva                           |
| Manager          | Manager| Visualiza las nuevas reservas en el calendario del día (AC-015)                        |
| Admin            | Admin  | Puede ver todas las reservas activas desde el panel de administración                  |

---

## Precondiciones

- El socio completó el flujo de login (AC-005 + AC-006) y tiene sesión activa.
- El socio tiene membresía activa y sin deuda pendiente.
- El socio consultó disponibilidad (AC-011) y existe al menos un cupo disponible en el horario deseado.

---

## Criterios de Aceptación

- [ ] El socio puede seleccionar un área accesible según su membresía, una fecha (hasta 7 días en adelante), una hora de inicio y una duración, y el sistema crea la reserva si hay cupo.
- [ ] El sistema valida que la duración solicitada no supere el máximo permitido por el tipo de membresía del socio (Silver: 1 hora, Gold: 2 horas, VIP: 4 horas).
- [ ] El sistema valida que el socio no haya alcanzado su límite semanal de reservas antes de confirmar (Silver: 2/semana, Gold: 3/semana, VIP: 5/semana).
- [ ] Si el cupo se agotó entre la consulta y la confirmación (condición de carrera), el sistema informa al socio que el horario ya no está disponible y le sugiere elegir otro.
- [ ] Si el socio intenta reservar un área no habilitada para su tipo de membresía, el sistema rechaza la solicitud con un mensaje explicativo.
- [ ] Si el socio tiene deuda pendiente o su membresía está inactiva, el sistema rechaza la reserva con un mensaje indicando que debe regularizar su situación.
- [ ] Una vez confirmada la reserva, el socio recibe en pantalla el detalle: área, fecha, hora de inicio, hora de fin y código de reserva.
- [ ] La reserva creada aparece inmediatamente en la vista de reservas del socio (AC-014).
- [ ] Si el sistema no puede confirmar la reserva por error interno, muestra un mensaje de error en español y no crea registros parciales.
- [ ] Todos los errores de validación se muestran en español con mensajes claros, sin exponer detalles técnicos.

---

## Fuera de Alcance

- Modificación de una reserva ya creada — diferida a AC-013 (cancelar y crear nueva es el flujo MVP).
- Reservas recurrentes o en bloque (ej. todos los lunes) — diferidas a una fase posterior.
- Pago adicional por reserva de áreas premium — no forma parte del modelo de negocio del MVP.
- Notificación por email o push al crear la reserva — diferida a AC relacionada de notificaciones (EP-07).
- Reservas con más de 7 días de anticipación — diferidas a una fase posterior.

---

## Reglas de Negocio

- **Acceso por membresía:** El área solicitada debe estar habilitada para el tipo de membresía del socio; de lo contrario la solicitud es rechazada.
- **Límite de duración:** La duración de la reserva no puede exceder el máximo del tipo de membresía (Silver: 1 hora, Gold: 2 horas, VIP: 4 horas).
- **Límite semanal:** No se puede crear una reserva si el socio ya alcanzó su cuota semanal (Silver: 2, Gold: 3, VIP: 5). La semana se cuenta de lunes a domingo.
- **Membresía activa y sin deuda:** Un socio con deuda o membresía vencida no puede crear reservas.
- **Control de cupo:** El cupo de un área en un horario es compartido entre todos los socios; si la capacidad está llena, la reserva es rechazada independientemente del tipo de membresía.
- **Ventana de anticipación:** Las reservas solo pueden crearse para los próximos 7 días; no se admiten reservas pasadas ni con más de 7 días de antelación.
- **Atomicidad:** La creación de la reserva y el descuento del cupo deben ocurrir en una sola operación para evitar doble asignación.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                        |
|----------------------|-----------------------------------------------------------------------------------------------|
| AC-005, AC-006       | El socio debe estar autenticado para crear reservas.                                          |
| AC-011               | La consulta de disponibilidad es el flujo previo natural; comparte la lógica de validación de cupo. |
| AC-014               | La reserva creada debe aparecer en la vista de reservas del socio inmediatamente.             |

---

## Definition of Done

- [ ] Funcionalidad implementada y desplegada en dev (backend y frontend).
- [ ] Tests unitarios escritos y pasando.
- [ ] Probado manualmente en dev con distintos tipos de membresía y escenarios de rechazo.
- [ ] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Endpoint:** `POST /v1/reservations` — protegido, requiere `Authorization: Bearer <AccessToken>`.
- **Body:** `{ areaId, date, startTime, durationMinutes }`.
- **Respuesta exitosa:** HTTP 201 con `{ reservationId, areaId, areaName, date, startTime, endTime, status: "CONFIRMED" }`.
- **Tablas DynamoDB:** `reservations` (PK: `memberId`, SK: `reservationId`; GSI por área+fecha para control de cupo), `areas` (capacidad y reglas por membresía), `member-profiles` (membresía activa, deuda, contador semanal de reservas).
- **Control de concurrencia:** Usar una transacción condicional (DynamoDB `TransactWrite`) que incrementa el contador de cupo y crea la reserva solo si el cupo disponible es mayor que cero.
- **Contador semanal:** Campo `weeklyReservationCount` con TTL hasta fin de semana (domingo 23:59) en la tabla `member-profiles`, o cálculo dinámico contando reservas de la semana actual en `reservations`.
- **Frontend:** Formulario paso a paso: 1) selección de área (filtrada por membresía), 2) selección de fecha y hora (deshabilitando slots llenos de AC-011), 3) selección de duración (máximo según membresía), 4) confirmación. React Hook Form + Zod para validación en cliente.
- **Design Doc:** `docs/design/AC-012-design.md` (a crear por el Arquitecto).
