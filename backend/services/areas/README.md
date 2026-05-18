# Servicio: areas

Lambda: `activa-club-areas-dev`
Tabla: `AreasTable`

## Responsabilidad

Catálogo de áreas recreativas para consulta pública de Miembros, Managers y Admins:
- Listar áreas activas disponibles para reserva
- Detalle de un área individual con su configuración y horario

> **CRUD de áreas (Admin):** Los endpoints de creación, actualización y toggle de estado de áreas
> (`POST/PUT/PATCH /v1/admin/areas`) están implementados en `activa-club-reservations-dev` mediante
> `AdminAreasController`. Este Lambda (`activa-club-areas-dev`) solo sirve consultas de solo lectura.
> Esta decisión fue tomada para no duplicar el acceso a `AreasTable` entre dos Lambdas.

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /v1/areas | Member+ | Listar todas las áreas activas |
| GET | /v1/areas/:id | Member+ | Detalle y horario de un área |

## DynamoDB: AreasTable

| Atributo DynamoDB | Atributo de dominio | Tipo | Notas |
|-------------------|---------------------|------|-------|
| `pk` | — | String | `AREA#<areaId>` |
| `sk` | — | String | `CONFIG` (implementación real; documentos anteriores decían `METADATA`) |
| `area_id` | `areaId` | String | ULID |
| `name` | `name` | String | |
| `status` | `status` | String | `Active` / `Inactive` |
| `capacity` | `capacity` | Number | Máximo de usuarios por slot |
| `slot_duration` | `slotDuration` | Number | Minutos por turno (ej. 60) |
| `opening_time` | `openingTime` | String | `HH:MM` |
| `closing_time` | `closingTime` | String | `HH:MM` |
| `cancel_window_hours` | `cancelWindowHours` | Number | Horas antes de la cancelación |
| `allowed_memberships` | `allowedMemberships` | List | `["Silver", "Gold", "VIP"]` |
| `max_duration_minutes` | `maxDurationMinutes` | Map | `{ Silver: N, Gold: N, VIP: N }` |
| `weekly_limit` | `weeklyLimit` | Map | `{ Silver: N, Gold: N, VIP: N }` |

> **Nota sobre SK:** La implementación usa `CONFIG` como sort key (no `METADATA`). Todos los `GetItem`
> y `Scan` en `AreasDynamoRepository` usan `sk = CONFIG`.

GSI: `GSI_Status` — PK: `status` (proyectado para futura optimización; actualmente se usa Scan con FilterExpression a MVP scale)
