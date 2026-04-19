# AC-016: Expiración Automática de Reservas y Liberación de Cupos

**Epic:** EP-02 - Reservas
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Backlog
**Fecha:** 2026-04-18
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como manager o administrador del club,
Quiero que las reservas cuya hora de fin ya pasó sean marcadas automáticamente como expiradas y sus cupos queden liberados,
Para que el sistema de disponibilidad refleje siempre el estado real de las instalaciones sin necesidad de intervención manual.

---

## Valor de Negocio

Sin expiración automática, las reservas pasadas quedan en estado `CONFIRMED` indefinidamente, haciendo que el sistema informe cupos ocupados aunque el horario ya terminó. Esto contamina la vista de disponibilidad (AC-011), bloquea la creación de nuevas reservas en esos horarios y genera desconfianza en los datos. La expiración automática garantiza la integridad operativa del sistema de reservas sin requerir intervención humana.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                                              |
|----------------------|--------|------------------------------------------------------------------------------------------|
| Sistema (automatizado)| —      | Ejecuta el proceso de expiración según un cronograma definido                            |
| Admin                | Admin  | Puede consultar en el panel las reservas expiradas; no interviene en el proceso           |
| Socio                | Member | Sus reservas pasadas pasan a historial automáticamente; no realiza ninguna acción         |

---

## Precondiciones

- Existen reservas en estado `CONFIRMED` cuya hora de fin ya pasó respecto al momento de ejecución del proceso.
- El proceso automatizado tiene permisos para actualizar registros en la tabla de reservas.

---

## Criterios de Aceptación

- [ ] El proceso automatizado se ejecuta cada hora y marca como `EXPIRED` todas las reservas en estado `CONFIRMED` cuya hora de fin sea anterior al momento de ejecución.
- [ ] Al expirar una reserva, el cupo del área en ese horario queda liberado en el registro de ocupación del sistema.
- [ ] Las reservas expiradas aparecen en el historial del socio con estado "Finalizada" (AC-014).
- [ ] El proceso no modifica el contador semanal del socio al expirar una reserva (la reserva fue utilizada o el tiempo ya pasó; no es una cancelación).
- [ ] Si el proceso encuentra un error al actualizar una reserva específica, registra el error en el log del sistema y continúa procesando las demás reservas sin detener la ejecución.
- [ ] El proceso puede ejecutarse manualmente por el Admin desde el panel de administración para forzar una expiración inmediata (fuera de ciclo).
- [ ] El número de reservas procesadas en cada ejecución queda registrado en el log del sistema.

---

## Fuera de Alcance

- Notificación al socio cuando su reserva expira — diferida a EP-07.
- Lógica de "check-in" (confirmación de asistencia por parte del socio) — diferida a una fase posterior.
- Expiración de reservas con menos de 1 hora de anticipación (reservas que están "en curso") — las reservas activas se marcan como `ACTIVE` solo si se implementa check-in; fuera del alcance MVP.
- Auditoría detallada con trazabilidad de cada expiración por usuario — diferida a EP-06.

---

## Reglas de Negocio

- **Criterio de expiración:** Una reserva se considera expirada cuando la combinación de `date` + `endTime` es anterior al instante de ejecución del proceso.
- **No afecta el contador semanal:** La expiración por tiempo no devuelve cuota semanal al socio; solo la cancelación explícita (AC-013) lo hace.
- **Procesamiento resiliente:** Un error en una reserva individual no detiene el procesamiento de las demás; el proceso es tolerante a fallos parciales.
- **Idempotencia:** Si el proceso se ejecuta dos veces en el mismo ciclo, no debe crear duplicados ni modificar reservas ya expiradas.
- **Frecuencia:** La ejecución mínima es cada hora; puede configurarse con mayor frecuencia si el volumen de reservas lo justifica.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                            |
|----------------------|---------------------------------------------------------------------------------------------------|
| AC-012               | Las reservas creadas son las que este proceso expira al vencer su hora de fin.                    |
| AC-011               | La disponibilidad mostrada depende de que las reservas expiradas liberen el cupo correctamente.   |
| AC-014               | Las reservas expiradas deben aparecer en el historial del socio con estado "Finalizada".          |

---

## Definition of Done

- [ ] Proceso automatizado implementado y desplegado en dev.
- [ ] Tests unitarios escritos y pasando.
- [ ] Probado manualmente en dev verificando que las reservas con hora vencida expiran y el cupo queda libre.
- [ ] Código revisado y PR mergeado.

---

## Notas Técnicas

- **Mecanismo de disparo:** AWS EventBridge Scheduler con regla cron `rate(1 hour)` que invoca un Lambda dedicado (`reservations-expiration-handler`).
- **Lógica del Lambda:** Escanear la tabla `reservations` con un GSI por `status = CONFIRMED` + `endTime <= now()`. Procesar en lotes usando `BatchWriteItem` para actualizar el estado a `EXPIRED`. Liberar cupo en `area-occupancy` (tabla o campo en `areas`) de forma atómica con `TransactWrite`.
- **Idempotencia:** Usar una condición `attribute_exists(status) AND status = CONFIRMED` en cada escritura para evitar modificar reservas ya expiradas.
- **Logging:** Registrar en CloudWatch Logs el timestamp de ejecución, cantidad de reservas procesadas, cantidad de errores y lista de `reservationId` fallidos.
- **Ejecución manual (Admin):** Endpoint protegido `POST /v1/admin/reservations/expire-now` con rol Admin en Cognito; invoca el mismo Lambda directamente.
- **Tablas DynamoDB:** `reservations` (actualizar `status` a `EXPIRED`), `areas` o tabla de ocupación (decrementar slot).
- **IaC:** Terraform para el recurso `aws_scheduler_schedule` (EventBridge Scheduler) y el Lambda con los permisos IAM necesarios.
- **Design Doc:** `docs/design/AC-016-design.md` (a crear por el Arquitecto).
