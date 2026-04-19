# AC-011: Consulta de Disponibilidad de Áreas

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Backlog
**Fecha:** 2026-04-18
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio activo,
Quiero consultar la disponibilidad de las áreas del club por fecha y franja horaria,
Para saber qué espacios puedo reservar antes de hacer una reserva.

---

## Valor de Negocio

Sin visibilidad de disponibilidad, el socio no puede planificar su visita y termina llamando al club o llegando sin reserva. Esta historia elimina esa fricción al exponer en tiempo real los cupos disponibles de cada área, reduciendo la carga operativa del staff y mejorando la experiencia del socio.

---

## Personas Involucradas

| Persona      | Rol     | Interacción                                                          |
|--------------|---------|----------------------------------------------------------------------|
| Socio Activo | Member  | Consulta disponibilidad antes de crear una reserva                   |
| Manager      | Manager | Puede consultar la misma vista para planificar el día                |
| Admin        | Admin   | Tiene acceso a la misma información desde el panel de administración |

---

## Precondiciones

- El socio completó el flujo de login (AC-005 + AC-006) y tiene sesión activa.
- El socio tiene membresía activa y sin deuda pendiente.
- Existen áreas configuradas en el sistema con capacidad máxima y horarios habilitados.

---

## Criterios de Aceptación

- [ ] El socio puede seleccionar un área, una fecha y una franja horaria, y el sistema le muestra si hay cupo disponible.
- [ ] El sistema muestra únicamente las áreas accesibles según el tipo de membresía del socio (Silver, Gold o VIP).
- [ ] Para cada franja horaria, el sistema indica el número de cupos restantes sobre el total.
- [ ] Si una franja horaria está completamente ocupada, se muestra como "Sin disponibilidad" y no puede seleccionarse.
- [ ] Si una franja horaria está bloqueada administrativamente, se muestra como no disponible sin exponer el motivo del bloqueo al socio.
- [ ] El socio solo puede consultar disponibilidad para fechas desde hoy hasta 7 días en el futuro.
- [ ] Si el socio selecciona una fecha anterior a hoy, el sistema muestra un mensaje indicando que no se pueden consultar fechas pasadas.
- [ ] Si el socio ya alcanzó su límite de reservas semanales, el sistema muestra un aviso indicando que no puede realizar más reservas esta semana, pero puede seguir consultando disponibilidad.
- [ ] Si el socio intenta acceder a la consulta de disponibilidad con membresía inactiva o deuda pendiente, el sistema le deniega el acceso y le muestra un mensaje explicando el motivo.
- [ ] Si no hay áreas configuradas para el tipo de membresía del socio, el sistema muestra un mensaje informativo.
- [ ] La disponibilidad mostrada refleja el estado actual, incluyendo reservas activas y bloqueos vigentes.

---

## Fuera de Alcance

- Reserva directa desde la vista de disponibilidad — se realiza en AC-012.
- Consulta de disponibilidad para fechas con más de 7 días de anticipación — diferida para una fase posterior.
- Vista de disponibilidad para usuarios no autenticados — no forma parte del MVP.
- Filtros por múltiples áreas simultáneas — diferido a mejoras de UX futuras.
- Visualización del motivo de bloqueo manual al socio — visible solo para Admin y Manager.

---

## Reglas de Negocio

- **Acceso por tipo de membresía:** Un socio Silver solo ve Cancha de Tenis y Piscina; un socio Gold ve Parrillas, Cancha de Tenis y Piscina; un socio VIP ve todas las áreas incluido el Salón de Eventos.
- **Ventana de consulta:** Solo se puede consultar disponibilidad desde el día actual hasta 7 días hacia adelante. Las fechas anteriores a hoy no son consultables.
- **Estado activo requerido:** Solo los socios con membresía activa y sin deuda pendiente pueden acceder a la consulta de disponibilidad.
- **Límite semanal informativo:** Si el socio agotó sus reservas semanales permitidas, se le informa en la vista pero no se le bloquea la consulta.
- **Cupo en tiempo real:** La disponibilidad mostrada debe reflejar las reservas activas y los bloqueos manuales vigentes en ese horario.
- **Bloqueos administrativos opacos:** Un área bloqueada manualmente por un Admin o Manager se muestra como no disponible al socio, sin revelar el motivo del bloqueo.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                                                        |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------|
| AC-005, AC-006       | El socio debe estar autenticado para consultar disponibilidad.                                                                |
| AC-012               | Esta historia es precondición de la creación de reserva; la vista de disponibilidad es el punto de entrada al flujo de reserva. |

---

## Definition of Done

- [ ] Endpoint backend implementado y desplegado en ambiente dev.
- [ ] Tests unitarios escritos y pasando.
- [ ] Probado manualmente en dev con socios de distintos tipos de membresía.
- [ ] Errores del API mapeados a mensajes amigables en el frontend.
- [ ] Código revisado y PR mergeado a main.

---

## Notas Técnicas

- **Endpoint:** `GET /v1/areas/availability?areaId={id}&date={YYYY-MM-DD}` — protegido, requiere `Authorization: Bearer <AccessToken>`.
- **Tablas DynamoDB:** `areas` (configuración de áreas, capacidad máxima, horarios habilitados, tipo de membresía requerida), `reservations` (reservas activas para calcular ocupación), `area-blocks` (bloqueos manuales).
- **Lógica de disponibilidad:** Para cada franja horaria del día solicitado, contar reservas con `status = ACTIVE` o `CONFIRMED` y restar de la capacidad máxima del área. Los registros en `area-blocks` con cobertura sobre la franja también la marcan como no disponible.
- **Control RBAC:** Cognito Authorizer valida el JWT. El campo `membershipType` del perfil del socio determina qué áreas se exponen en la respuesta.
- **Frontend:** Grilla de franjas horarias (09:00–22:00, bloques de 1 hora) con selector de fecha. Shadcn/ui `Calendar` + grilla de slots. React Query para fetch con invalidación automática al cambiar la fecha seleccionada.
- **Design Doc:** `docs/design/AC-011-design.md` (a crear por el Arquitecto).
