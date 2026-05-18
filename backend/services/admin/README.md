# Servicio: admin

Lambda: `activa-club-admin-dev`

## Responsabilidad

Vistas agregadas, analíticas y gestión transversal exclusivas del Admin:
- Gestión de socios (listar, filtrar, exportar)
- Analíticas de reservas (uso por área, horas pico)
- Dashboard de pagos e ingresos
- Envío manual de notificaciones SNS
- Acceso a logs de auditoría
- Gestión de contenido FAQ

Este servicio realiza **agregaciones de lectura** sobre todas las tablas DynamoDB.
No posee ninguna tabla primaria propia, pero tiene permisos de lectura sobre todas las tablas.

> **CRUD de áreas (AC-017):** Los endpoints `GET/POST/PUT/PATCH /v1/admin/areas` están implementados
> en `activa-club-reservations-dev` (en `AdminAreasController`), no en este Lambda. Esta decisión evita
> duplicar el acceso a `AreasTable` y las políticas IAM. Este Lambda sigue siendo el responsable de
> las analíticas y vistas agregadas.

## Estructura Clean Architecture

```
src/
├── application/
│   └── queries/
│       ├── get-members-report.query.ts
│       ├── get-reservations-analytics.query.ts
│       ├── get-revenue-report.query.ts
│       ├── get-guests-report.query.ts
│       └── get-audit-logs.query.ts
├── domain/
│   └── value-objects/
│       ├── date-range.vo.ts
│       └── report-format.vo.ts
├── infrastructure/
│   ├── repositories/
│   │   └── analytics.cross-table.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   ├── admin-members.controller.ts
    │   ├── admin-analytics.controller.ts
    │   ├── admin-payments.controller.ts
    │   └── admin-notifications.controller.ts
    └── dtos/
        ├── analytics-response.dto.ts
        └── notification-dispatch.dto.ts
```

## Endpoints de la API

| Método | Ruta | Lambda | Auth | Descripción |
|--------|------|--------|------|-------------|
| GET | /v1/admin/members | admin | Admin | Listar/filtrar todos los socios |
| GET | /v1/admin/analytics/reservations | admin | Admin | Estadísticas de reservas por área y período |
| GET | /v1/admin/analytics/revenue | admin | Admin | Totales de ingresos por período |
| GET | /v1/admin/analytics/members | admin | Admin | Crecimiento de socios y distribución por plan |
| POST | /v1/admin/notifications | admin | Admin | Envío manual de notificación SNS |
| GET | /v1/admin/audit-logs | admin | Admin | Entradas de log de auditoría paginadas |
| GET | /v1/admin/areas | **reservations** | Admin | Listar todas las áreas (incluyendo inactivas) |
| POST | /v1/admin/areas | **reservations** | Admin | Crear nueva área |
| PUT | /v1/admin/areas/{areaId} | **reservations** | Admin | Actualizar configuración de área |
| PATCH | /v1/admin/areas/{areaId}/status | **reservations** | Admin | Activar/desactivar área |
| POST | /v1/admin/reservations/expire-now | **reservations** | Admin | Invocar expirer Lambda |

## Acceso DynamoDB

Este Lambda tiene permisos IAM de lectura sobre:
- `MembersTable`
- `ReservationsTable`
- `SlotOccupancyTable`
- `AreaBlocksTable`
- `PaymentsTable`
- `GuestsTable`
- `PromotionsTable`
- `AreasTable`

## Estrategia de Analíticas

Para el alcance de la tesis: las analíticas se computan en tiempo real vía scans de DynamoDB + queries en GSIs.
Mejora futura: integrar Amazon Athena o DynamoDB Streams → S3 para reportes pre-agregados.

Nota: Los `Scan` sobre tablas grandes consumen unidades de lectura significativas. Monitorear con CloudWatch y migrar a queries por GSI a medida que crecen los datos.
