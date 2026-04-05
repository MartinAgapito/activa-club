# Servicio: reservations

Lambda: `activa-club-reservations-dev`
Tabla: `ReservationsTable`

## Responsabilidad

Gestiona las reservas de áreas recreativas:
- Verificación de disponibilidad de turnos (capacidad + horario)
- Creación, modificación y cancelación de reservas
- Aplicación de reglas según plan de membresía
- Control de cuota mensual por socio

## Estructura Clean Architecture

```
src/
├── application/
│   ├── commands/
│   │   ├── create-reservation.command.ts
│   │   ├── cancel-reservation.command.ts
│   │   └── update-reservation.command.ts
│   └── queries/
│       ├── get-reservation-by-id.query.ts
│       ├── list-reservations-by-member.query.ts
│       ├── list-reservations-by-area.query.ts
│       └── check-slot-availability.query.ts
├── domain/
│   ├── entities/
│   │   └── reservation.entity.ts
│   ├── value-objects/
│   │   ├── reservation-status.vo.ts
│   │   ├── time-slot.vo.ts
│   │   └── capacity.vo.ts
│   └── repositories/
│       └── reservation.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── reservation.dynamo.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── reservations.controller.ts
    └── dtos/
        ├── create-reservation.dto.ts
        └── reservation-response.dto.ts
```

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /v1/reservations | Member+ | Crear reserva |
| GET | /v1/reservations/:id | Member+ | Detalle de reserva |
| GET | /v1/reservations | Member+ | Listar propias reservas |
| DELETE | /v1/reservations/:id | Member+ | Cancelar reserva |
| GET | /v1/reservations/area/:areaId | Admin/Manager | Reservas por área |
| GET | /v1/reservations/availability | Member+ | Disponibilidad de turnos para un área |

## DynamoDB: ReservationsTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `PK` | String | `RESERVATION#<reservationId>` |
| `SK` | String | `MEMBER#<memberId>` |
| `reservationId` | String | ULID |
| `memberId` | String | Referencia a MembersTable |
| `areaId` | String | Referencia a AreasTable |
| `date` | String | Fecha ISO 8601 |
| `startTime` | String | HH:MM |
| `endTime` | String | HH:MM |
| `guestCount` | Number | Cantidad de invitados registrados |
| `status` | String | Confirmed / Cancelled / Pending |
| `createdAt` | String | ISO 8601 |

GSI: `GSI_Member` — PK: `memberId`, SK: `date` (listar por socio, filtrar por fecha)
GSI: `GSI_Area` — PK: `areaId`, SK: `date` (verificar disponibilidad por área y fecha)

## Reglas de Negocio

- Un socio no puede reservar el mismo turno dos veces en la misma área.
- La cuota mensual se verifica consultando `GSI_Member` y contando las reservas del mes actual.
- La cancelación debe realizarse al menos N horas antes del inicio del turno (configurable por área).
