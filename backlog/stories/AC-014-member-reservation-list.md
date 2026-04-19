# AC-014: Vista de Reservas del Socio

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Backlog
**Fecha:** 2026-04-18
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio activo,
Quiero ver la lista de mis reservas actuales e históricas,
Para conocer mis compromisos pendientes, gestionar mis cancelaciones y consultar mi historial de uso.

---

## Valor de Negocio

Sin una vista propia de reservas, el socio no tiene visibilidad sobre sus compromisos activos ni puede gestionar cancelaciones (AC-013). Esta historia cierra el ciclo del flujo de reservas desde la perspectiva del socio y es la base de la experiencia de autogestión que diferencia la plataforma de la coordinación telefónica.

---

## Personas Involucradas

| Persona          | Rol    | Interacción                                                                      |
|------------------|--------|----------------------------------------------------------------------------------|
| Socio Activo     | Member | Consulta sus reservas activas e históricas; accede a la opción de cancelar       |
| Manager          | Manager| No interactúa con esta vista; tiene su propia vista de calendario (AC-015)       |

---

## Precondiciones

- El socio completó el flujo de login (AC-005 + AC-006) y tiene sesión activa.

---

## Criterios de Aceptación

- [ ] El socio puede ver la lista de sus reservas activas (estado `CONFIRMED`) ordenadas por fecha y hora de inicio ascendente.
- [ ] Para cada reserva activa, se muestra: nombre del área, fecha, hora de inicio, hora de fin y opción de cancelar.
- [ ] El socio puede acceder a un historial de reservas pasadas (estado `EXPIRED` o `CANCELLED`) ordenadas por fecha descendente.
- [ ] Para cada reserva del historial, se muestra: nombre del área, fecha, hora de inicio, hora de fin y estado (finalizada o cancelada).
- [ ] Si el socio no tiene reservas activas, la sección muestra un mensaje indicando que no hay reservas próximas y un acceso directo para crear una.
- [ ] Si el socio no tiene historial, la sección muestra un mensaje informativo.
- [ ] El socio puede iniciar la cancelación de una reserva activa directamente desde esta vista (flujo definido en AC-013).
- [ ] El sistema muestra cuántas reservas le quedan disponibles en la semana actual según su tipo de membresía.
- [ ] La vista se actualiza automáticamente al volver de crear o cancelar una reserva, sin necesidad de recargar la página.
- [ ] Si el socio tiene membresía vencida pero cuenta con reservas previas, la vista muestra su historial completo; las reservas activas que puedan existir se muestran con un aviso de que su membresía está inactiva y que no puede crear nuevas reservas.

---

## Fuera de Alcance

- Modificación directa de una reserva (cambio de horario o área) — el socio debe cancelar y crear una nueva.
- Exportación del historial de reservas a PDF o CSV — diferida a una fase posterior.
- Reservas de otros socios visibles en esta pantalla — exclusiva del rol Manager/Admin.
- Filtros avanzados por área o rango de fechas en el historial — diferidos a mejoras de UX futuras.

---

## Reglas de Negocio

- **Visibilidad restringida:** Un socio solo puede ver sus propias reservas; nunca se exponen reservas de otros socios en esta vista.
- **Contador semanal visible:** El sistema informa cuántas reservas ha usado y cuántas le quedan en la semana actual, según los límites de su membresía.
- **Historial completo:** Las reservas canceladas y expiradas forman parte del historial y son visibles pero no modificables.
- **Acceso con sesión activa:** Un socio puede acceder a esta vista con sesión vigente, independientemente del estado de su membresía; si la membresía está vencida, solo puede consultar el historial y sus reservas previas, pero el sistema le informa que no puede crear nuevas reservas.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                     |
|----------------------|--------------------------------------------------------------------------------------------|
| AC-012               | Las reservas creadas deben aparecer aquí inmediatamente.                                   |
| AC-013               | El botón de cancelar en esta vista dispara el flujo de cancelación.                        |

---

## Definition of Done

- [ ] Funcionalidad implementada y desplegada en dev (backend y frontend).
- [ ] Tests unitarios escritos y pasando.
- [ ] Probado manualmente en dev con socios en distintos estados de membresía y reserva.
- [ ] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Endpoint reservas activas:** `GET /v1/reservations?status=CONFIRMED` — protegido, requiere `Authorization: Bearer <AccessToken>`. El backend filtra por `memberId` extraído del token.
- **Endpoint historial:** `GET /v1/reservations?status=PAST&limit=20&lastKey={cursor}` — paginado con cursor para evitar lecturas masivas.
- **Tabla DynamoDB:** `reservations` (PK: `memberId`, SK: `reservationId`; GSI por `status` + `startTime` para consulta eficiente).
- **Contador semanal:** Incluido en la respuesta del endpoint de reservas activas o en un campo adicional del perfil del socio; no requiere endpoint propio.
- **Frontend:** Dos pestañas: "Próximas" (reservas activas) y "Historial" (paginado). Shadcn/ui `Tabs` + `Card` por reserva. React Query con `useQuery` para fetch e invalidación tras mutaciones de AC-012 y AC-013.
- **Design Doc:** `docs/design/AC-014-design.md` (a crear por el Arquitecto).
