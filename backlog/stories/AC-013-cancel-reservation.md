# AC-013: Cancelación de Reserva por el Socio

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Backlog
**Fecha:** 2026-04-18
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio activo,
Quiero poder cancelar una reserva que creé,
Para liberar el cupo si no puedo asistir y descontar esa reserva de mi límite semanal.

---

## Valor de Negocio

Sin cancelación, los cupos quedan bloqueados aunque el socio no vaya a asistir, reduciendo la disponibilidad real para otros socios y generando conflictos en la gestión del club. Permitir cancelar hasta un tiempo mínimo antes del inicio evita el uso abusivo del sistema y garantiza que los cupos liberados puedan ser aprovechados.

---

## Personas Involucradas

| Persona          | Rol    | Interacción                                                                      |
|------------------|--------|----------------------------------------------------------------------------------|
| Socio Activo     | Member | Cancela una reserva propia desde la vista de sus reservas                        |
| Manager          | Manager| Visualiza el cupo liberado en el calendario del día (AC-015)                     |
| Admin            | Admin  | Puede cancelar reservas de cualquier socio desde el panel de administración      |

---

## Precondiciones

- El socio completó el flujo de login (AC-005 + AC-006) y tiene sesión activa.
- El socio tiene al menos una reserva en estado `CONFIRMED` o `ACTIVE`.
- La reserva pertenece al socio autenticado.

---

## Criterios de Aceptación

- [ ] El socio puede cancelar una reserva propia que esté en estado `CONFIRMED` siempre que falten más de 2 horas para el inicio.
- [ ] Al cancelar una reserva, el cupo del área en ese horario queda disponible inmediatamente para otros socios.
- [ ] Al cancelar una reserva, el contador de reservas semanales del socio se decrementa en uno.
- [ ] Si la reserva ya comenzó (estado `ACTIVE`) o falta 2 horas o menos para el inicio, el sistema rechaza la cancelación con un mensaje indicando que el plazo venció.
- [ ] Si la reserva ya fue cancelada o expiró, el sistema informa que no es posible cancelarla nuevamente.
- [ ] Si el socio intenta cancelar una reserva que no le pertenece, el sistema devuelve un error sin exponer información de la reserva ajena.
- [ ] El socio recibe confirmación en pantalla de que la cancelación fue exitosa, y la reserva desaparece de su lista de reservas activas.
- [ ] Si el sistema no puede completar la cancelación por error interno, muestra un mensaje de error en español y la reserva mantiene su estado original.

---

## Fuera de Alcance

- Cancelación de reservas de otros socios por el propio socio — exclusiva del rol Manager/Admin.
- Política de penalización por cancelaciones frecuentes — diferida a una fase posterior.
- Reembolso o crédito por cancelación — no aplica en el modelo de negocio del MVP.
- Notificación al socio por cancelación exitosa (push/email) — diferida a EP-07.

---

## Reglas de Negocio

- **Plazo de cancelación:** Una reserva solo puede cancelarse si faltan más de 2 horas para su hora de inicio. Una vez iniciada o dentro de las 2 horas previas, no se puede cancelar.
- **Devolución del cupo:** La cancelación libera el cupo del área en ese horario de forma inmediata y atómica.
- **Devolución del contador semanal:** Al cancelar, la reserva deja de contar en el límite semanal del socio, permitiéndole crear una nueva reserva en la misma semana si tiene cupos disponibles.
- **Propiedad de la reserva:** Un socio solo puede cancelar sus propias reservas; un Manager o Admin puede cancelar cualquier reserva.
- **Estados cancelables:** Solo las reservas en estado `CONFIRMED` son cancelables por el socio; las reservas en estado `ACTIVE`, `EXPIRED` o `CANCELLED` no se pueden cancelar.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                           |
|----------------------|--------------------------------------------------------------------------------------------------|
| AC-012               | La cancelación opera sobre reservas creadas en esta historia.                                    |
| AC-014               | La vista de reservas del socio es el punto de entrada natural para la cancelación.               |
| AC-015               | El Manager debe ver el cupo liberado reflejado en el calendario del día.                         |

---

## Definition of Done

- [ ] Funcionalidad implementada y desplegada en dev (backend y frontend).
- [ ] Tests unitarios escritos y pasando.
- [ ] Probado manualmente en dev con escenarios dentro y fuera del plazo de cancelación.
- [ ] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Endpoint:** `DELETE /v1/reservations/{reservationId}` — protegido, requiere `Authorization: Bearer <AccessToken>`.
- **Lógica de autorización:** El backend verifica que `memberId` de la reserva coincida con el `sub` del token; si no coincide y el rol no es Manager/Admin, retorna HTTP 403.
- **Respuesta exitosa:** HTTP 200 con `{ message: "Reserva cancelada correctamente", reservationId }`.
- **Tablas DynamoDB:** `reservations` (actualizar `status` a `CANCELLED`), `areas` (decrementar ocupación del slot), `member-profiles` (decrementar `weeklyReservationCount`). Usar `TransactWrite` para atomicidad.
- **Validación de plazo:** Comparar `startTime` de la reserva con `Date.now()` en el Lambda; rechazar si la diferencia es menor o igual a 2 horas.
- **Frontend:** Botón "Cancelar reserva" en la tarjeta de cada reserva activa en AC-014. Mostrar modal de confirmación antes de ejecutar la cancelación. Usar React Query `useMutation` con `onSuccess` para invalidar la caché de reservas.
- **Design Doc:** `docs/design/AC-013-design.md` (a crear por el Arquitecto).
