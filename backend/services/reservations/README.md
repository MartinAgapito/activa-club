# Service: reservations

Lambda: `activa-club-reservations-dev`
Table: `ReservationsTable`

## Responsibility

Manages recreational area reservations:
- Slot availability checking (capacity + schedule)
- Reservation creation, modification, cancellation
- Membership tier rule enforcement
- Monthly quota tracking per member

## Clean Architecture Layout

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

## API Endpoints

| Method | Path                          | Auth          | Description                        |
|--------|-------------------------------|---------------|------------------------------------|
| POST   | /v1/reservations              | Member+       | Create reservation                 |
| GET    | /v1/reservations/:id          | Member+       | Get reservation detail             |
| GET    | /v1/reservations              | Member+       | List own reservations              |
| DELETE | /v1/reservations/:id          | Member+       | Cancel reservation                 |
| GET    | /v1/reservations/area/:areaId | Admin/Manager | List reservations by area          |
| GET    | /v1/reservations/availability | Member+       | Check slot availability for area   |

## DynamoDB: ReservationsTable

| Attribute       | Type   | Notes                                       |
|-----------------|--------|---------------------------------------------|
| `PK`            | String | `RESERVATION#<reservationId>`               |
| `SK`            | String | `MEMBER#<memberId>`                         |
| `reservationId` | String | ULID                                        |
| `memberId`      | String | Reference to MembersTable                   |
| `areaId`        | String | Reference to AreasTable                     |
| `date`          | String | ISO 8601 date                               |
| `startTime`     | String | HH:MM                                       |
| `endTime`       | String | HH:MM                                       |
| `guestCount`    | Number | Number of guests registered                 |
| `status`        | String | Confirmed / Cancelled / Pending             |
| `createdAt`     | String | ISO 8601                                    |
| `updatedAt`     | String | ISO 8601                                    |

GSI: `GSI_Member` - PK: `memberId`, SK: `date` (list by member, filter by date)
GSI: `GSI_Area` - PK: `areaId`, SK: `date` (availability check by area+date)

## Business Rules

- A member cannot double-book the same time slot in the same area.
- Monthly quota is enforced by querying `GSI_Member` and counting current month reservations.
- Cancellation must occur at least N hours before the slot start (configurable per area).
