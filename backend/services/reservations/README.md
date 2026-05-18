# Servicio: reservations

Lambda: `activa-club-reservations-dev`
Tablas principales: `ReservationsTable`, `SlotOccupancyTable`, `AreaBlocksTable`, `AreasTable`

## Responsabilidad

Gestiona el ciclo de vida completo de reservas de áreas recreativas y el CRUD de áreas para Admin:

- Consulta de disponibilidad de turnos con ocupación en tiempo real (`SlotOccupancyTable`)
- Indicador `bookedByMe` para identificar si el miembro ya reservó un slot
- Creación de reservas con control atómico de capacidad (`TransactWrite`)
- Cancelación de reservas por Member y por Manager
- Bloqueo/desbloqueo de franjas horarias por Manager
- Listado de reservas propias del Member con cuota semanal
- Vista de calendario para Manager
- CRUD completo de áreas para Admin (`AdminAreasController`)
- Expiración automática de reservas pasadas (invoca expirer Lambda)

## Estructura Clean Architecture

```
src/
├── application/
│   ├── commands/
│   │   ├── cancel-reservation/
│   │   ├── create-area/                   ← Admin CRUD (AC-017)
│   │   ├── create-area-block/
│   │   ├── create-reservation/
│   │   ├── delete-area-block/
│   │   ├── manager-cancel-reservation/
│   │   ├── toggle-area-status/            ← Admin CRUD (AC-017)
│   │   └── update-area/                   ← Admin CRUD (AC-017)
│   ├── ports/
│   │   ├── areas.repository.interface.ts
│   │   └── members.repository.interface.ts
│   └── queries/
│       ├── get-area-availability.query.ts  ← incluye bookedByMe (Step 7)
│       ├── get-manager-calendar.query.ts
│       └── list-my-reservations.query.ts
├── domain/
│   ├── entities/
│   │   ├── area.entity.ts
│   │   ├── area-block.entity.ts
│   │   ├── member-profile.entity.ts
│   │   ├── reservation.entity.ts
│   │   └── slot.entity.ts
│   ├── exceptions/
│   │   └── reservation.exceptions.ts
│   ├── repositories/
│   │   ├── area-block.repository.interface.ts
│   │   ├── reservation.repository.interface.ts
│   │   └── slot-occupancy.repository.interface.ts
│   └── value-objects/
│       ├── membership-rules.vo.ts
│       ├── reservation-status.vo.ts
│       ├── slot-occupancy.vo.ts
│       ├── time-slot.vo.ts
│       └── weekly-quota.vo.ts
├── infrastructure/
│   ├── repositories/
│   │   ├── area-block.dynamo.repository.ts
│   │   ├── areas.dynamo.repository.ts
│   │   ├── members.dynamo.repository.ts
│   │   ├── reservation.dynamo.repository.ts
│   │   └── slot-occupancy.dynamo.repository.ts
│   ├── shared/
│   │   ├── filters/global-exception.filter.ts
│   │   └── interceptors/transform.interceptor.ts
│   ├── dynamo-client.factory.ts
│   └── handlers/lambda.ts
└── presentation/
    ├── controllers/
    │   ├── admin-areas.controller.ts      ← rutas /v1/admin/areas
    │   ├── manager.controller.ts
    │   └── reservations.controller.ts
    ├── dtos/
    │   ├── availability-query.dto.ts
    │   ├── cancel-reservation.dto.ts
    │   ├── create-area.dto.ts
    │   ├── create-area-block.dto.ts
    │   ├── create-reservation.dto.ts
    │   ├── list-reservations-query.dto.ts
    │   ├── manager-calendar-query.dto.ts
    │   ├── toggle-area-status.dto.ts
    │   └── update-area.dto.ts
    └── guards/
        └── roles.guard.ts
```

## Endpoints de la API

### Member

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /v1/areas/{areaId}/availability?date=YYYY-MM-DD | Member+ | Disponibilidad de slots con `bookedByMe` |
| POST | /v1/reservations | Member | Crear reserva |
| GET | /v1/reservations/me | Member | Listar reservas propias (upcoming / history) |
| DELETE | /v1/reservations/{reservationId} | Member | Cancelar propia reserva |

### Manager

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /v1/manager/reservations | Manager+ | Calendario de reservas por fecha/área |
| DELETE | /v1/manager/reservations/{reservationId} | Manager+ | Cancelar cualquier reserva con motivo |
| POST | /v1/areas/{areaId}/blocks | Manager+ | Crear bloqueo de franja horaria |
| DELETE | /v1/areas/{areaId}/blocks/{blockId} | Manager+ | Eliminar bloqueo |

### Admin

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /v1/admin/areas | Admin | Listar todas las áreas (incluyendo inactivas) |
| POST | /v1/admin/areas | Admin | Crear nueva área |
| PUT | /v1/admin/areas/{areaId} | Admin | Actualizar configuración de área |
| PATCH | /v1/admin/areas/{areaId}/status | Admin | Activar o desactivar un área |
| POST | /v1/admin/reservations/expire-now | Admin | Invocar expirer Lambda manualmente |

## DynamoDB: tablas utilizadas

### ReservationsTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `pk` | String | `RESERVATION#<reservationId>` |
| `sk` | String | `MEMBER#<memberId>` |
| `reservation_id` | String | ULID (denormalizado) |
| `member_id` | String | ULID |
| `area_id` | String | ULID — FK a AreasTable |
| `area_name` | String | Denormalizado para listados |
| `date` | String | `YYYY-MM-DD` |
| `start_time` | String | `HH:MM` |
| `end_time` | String | `HH:MM` |
| `duration_minutes` | Number | |
| `status` | String | `CONFIRMED` / `CANCELLED` / `EXPIRED` |
| `cancel_reason` | String | Opcional |
| `cancelled_by_role` | String | `MEMBER` o `MANAGER` |
| `created_at` | String | ISO-8601 UTC |
| `updated_at` | String | ISO-8601 UTC |
| `expires_at` | String | ISO-8601 UTC — usado por GSI_StatusExpires |

GSIs:
- `GSI_Member` — PK: `member_id`, SK: `created_at` (AC-014)
- `GSI_AreaDate` — PK: `area_id`, SK: `date` (AC-015, AC-011 bookedByMe)
- `GSI_StatusExpires` — PK: `status`, SK: `expires_at` (AC-016 expirer)
- `GSI_ReservationId` — PK: `reservation_id` KEYS_ONLY (AC-013, AC-015 cancel by ID)

**Nota:** `capacity` es keyword reservada en DynamoDB. Se usa alias `#cap` en `ExpressionAttributeNames`.

### SlotOccupancyTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `pk` | String | `SLOT#<areaId>#<date>#<HH:MM>` |
| `area_id` | String | Denormalizado |
| `date` | String | `YYYY-MM-DD` |
| `start_time` | String | `HH:MM` |
| `occupancy` | Number | Contador de reservas CONFIRMED |
| `capacity` | Number | Copiado de AreasTable al primer write |
| `updated_at` | String | ISO-8601 UTC |

### AreaBlocksTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `pk` | String | `BLOCK#<blockId>` |
| `sk` | String | `AREA#<areaId>` |
| `block_id` | String | ULID |
| `area_id` | String | ULID |
| `date` | String | `YYYY-MM-DD` |
| `start_time` | String | `HH:MM` |
| `end_time` | String | `HH:MM` |
| `reason` | String | Texto libre |
| `created_by` | String | Cognito sub del Manager |
| `created_at` | String | ISO-8601 UTC |
| `is_active` | Bool | `true` mientras el bloqueo está vigente |

GSIs:
- `GSI_AreaDateBlocks` — PK: `area_id`, SK: `date` (AC-011, AC-015)
- `GSI_BlockId` — PK: `block_id` KEYS_ONLY (AC-015 delete block)

### AreasTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `pk` | String | `AREA#<areaId>` |
| `sk` | String | `CONFIG` |
| `area_id` | String | ULID |
| `name` | String | |
| `status` | String | `Active` / `Inactive` |
| `capacity` | Number | |
| `slot_duration` | Number | Minutos por turno |
| `opening_time` | String | `HH:MM` |
| `closing_time` | String | `HH:MM` |
| `cancel_window_hours` | Number | |
| `allowed_memberships` | List | `["Silver", "Gold", "VIP"]` |
| `max_duration_minutes` | Map | `{ Silver: N, Gold: N, VIP: N }` |
| `weekly_limit` | Map | `{ Silver: N, Gold: N, VIP: N }` |

## Reglas de Negocio Principales

- Slot de ocupación se controla via `TransactWrite` con `ConditionExpression: occupancy < capacity`.
- Cuota semanal del Member se trackea en `MembersTable` con `weekly_reservation_count` y `weekly_reset_at`.
- La cancelación de Member tiene ventana de 2 horas antes del inicio (configurable por área).
- La cancelación de Manager no tiene restricción de tiempo.
- `EXPIRED`: solo el expirer Lambda lo transiciona; no restaura cuota semanal.
- `CANCELLED`: sí restaura cuota semanal (decrementar `weekly_reservation_count`).
