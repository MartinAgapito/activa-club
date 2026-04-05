# AC-011: Consulta de Disponibilidad de Áreas

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Backlog
**Fecha:** 2026-04-05
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

| Persona          | Rol     | Interacción                                                                    |
|------------------|---------|--------------------------------------------------------------------------------|
| Socio Activo     | Member  | Consulta disponibilidad antes de crear una reserva                             |
| Manager          | Manager | Puede consultar la misma vista para planificar el día                          |
| Admin            | Admin   | Tiene acceso a la misma información desde el panel de administración           |

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
- [ ] El socio solo puede consultar disponibilidad para fechas desde hoy hasta 7 días en el futuro.
- [ ] Si el socio ya alcanzó su límite de reservas semanales permitidas, el sistema muestra un aviso indicando que no puede realizar más reservas esta semana, pero puede seguir consultando disponibilidad.
- [ ] Si el socio selecciona una fecha anterior a hoy, el sistema muestra un mensaje indicando que no se pueden consultar fechas pasadas.
- [ ] Si no hay áreas configuradas para la membresía del socio, el sistema muestra un mensaje informativo.
- [ ] La información de disponibilidad refleja el estado actual incluyendo reservas activas y bloqueos vigentes.

---

## Fuera de Alcance

- Reserva directa desde la vista de disponibilidad — se realiza en AC-012.
- Consulta de disponibilidad para fechas con más de 7 días de anticipación — diferida para una fase posterior.
- Vista de disponibilidad para usuarios no autenticados — no forma parte del MVP.
- Filtros por múltiples áreas simultáneas — diferido a mejoras de UX futuras.

---

## Reglas de Negocio

- **Acceso por tipo de membresía:** Un socio Silver solo ve Cancha de Tenis y Piscina; un socio Gold ve Parrillas, Cancha de Tenis y Piscina; un socio VIP ve todas las áreas incluido el Salón de Eventos.
- **Ventana de consulta:** Solo se puede consultar disponibilidad desde el día actual hasta 7 días hacia adelante; no se muestran fechas pasadas.
- **Límite semanal informativo:** Si el socio agotó sus reservas semanales, se le informa en la vista de disponibilidad pero no se le bloquea la consulta.
- **Estado activo requerido:** Solo los socios con membresía activa y sin deuda pueden acceder a la consulta de disponibilidad.
- **Cupo en tiempo real:** La disponibilidad mostrada debe considerar todas las reservas activas y bloqueos manuales vigentes en ese horario.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                     |
|----------------------|--------------------------------------------------------------------------------------------|
| AC-005, AC-006       | El socio debe estar autenticado para consultar disponibilidad.                             |
| AC-012               | Esta historia es precondición de la creación de reserva; la UI de disponibilidad es el punto de entrada al flujo de reserva. |

---

## Definition of Done

- [ ] Endpoint backend implementado y desplegado en dev.
- [ ] Las áreas visibles se filtran correctamente por tipo de membresía del socio.
- [ ] Tests unitarios escritos y pasando (membresía Silver/Gold/VIP, cupo lleno, límite semanal alcanzado).
- [ ] Probado manualmente en dev con socios de distintos tipos de membresía.
- [ ] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Endpoint:** `GET /v1/areas/availability?areaId={id}&date={YYYY-MM-DD}` — protegido, requiere `Authorization: Bearer <AccessToken>`.
- **Tablas DynamoDB:** `areas` (configuración de áreas, capacidad máxima, horarios habilitados, tipo de membresía requerida), `reservations` (reservas activas para calcular ocupación), `area-blocks` (bloqueos manuales).
- **Lógica de disponibilidad:** Para cada franja horaria del día solicitado, contar reservas con `status = ACTIVE` o `CONFIRMED` y restar de la capacidad máxima del área.
- **Control RBAC:** Cognito Authorizer valida el rol del token. El campo `membershipType` del perfil del socio determina qué áreas se exponen.
- **Frontend:** Vista de calendario o grilla de franjas horarias (09:00–22:00, bloques de 1 hora). Shadcn/ui `Calendar` + grilla de slots. React Query para fetch con invalidación por fecha seleccionada.
- **Design Doc:** `docs/design/AC-011-design.md` (a crear por el Arquitecto).
