# Service: guests

Lambda: `activa-club-guests-dev`
Table: `GuestsTable`

## Responsibility

Guest registration for member reservations:
- Register guests against a specific reservation
- Generate unique access codes (numeric + QR-friendly string)
- Validate guest limits based on membership tier
- Guest access code verification (at club entry point)

## Clean Architecture Layout

```
src/
├── application/
│   ├── commands/
│   │   ├── register-guest.command.ts
│   │   ├── remove-guest.command.ts
│   │   └── verify-guest-code.command.ts
│   └── queries/
│       ├── get-guest-by-id.query.ts
│       ├── list-guests-by-reservation.query.ts
│       └── find-guest-by-code.query.ts
├── domain/
│   ├── entities/
│   │   └── guest.entity.ts
│   ├── value-objects/
│   │   ├── access-code.vo.ts
│   │   └── guest-status.vo.ts          # Registered | CheckedIn | Cancelled
│   └── repositories/
│       └── guest.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── guest.dynamo.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── guests.controller.ts
    └── dtos/
        ├── register-guest.dto.ts
        └── guest-response.dto.ts
```

## API Endpoints

| Method | Path                                     | Auth       | Description                         |
|--------|------------------------------------------|------------|-------------------------------------|
| POST   | /v1/reservations/:id/guests              | Member+    | Register guest for reservation      |
| GET    | /v1/reservations/:id/guests              | Member+    | List guests for reservation         |
| DELETE | /v1/reservations/:id/guests/:guestId     | Member+    | Remove guest                        |
| POST   | /v1/guests/verify                        | Admin      | Verify guest access code at entry   |

## DynamoDB: GuestsTable

| Attribute       | Type   | Notes                                     |
|-----------------|--------|-------------------------------------------|
| `PK`            | String | `GUEST#<guestId>`                         |
| `SK`            | String | `RESERVATION#<reservationId>`             |
| `guestId`       | String | ULID                                      |
| `reservationId` | String | Reference to ReservationsTable            |
| `memberId`      | String | Owning member                             |
| `firstName`     | String |                                           |
| `lastName`      | String |                                           |
| `dni`           | String | Guest national ID                         |
| `accessCode`    | String | Unique 8-char alphanumeric code           |
| `status`        | String | Registered / CheckedIn / Cancelled        |
| `createdAt`     | String | ISO 8601                                  |

GSI: `GSI_Reservation` - PK: `reservationId` (list guests by reservation)
GSI: `GSI_AccessCode` - PK: `accessCode` (O(1) lookup for entry verification)

## Access Code Generation

- 8-character uppercase alphanumeric (excludes ambiguous chars: 0, O, I, 1)
- Uniqueness enforced via conditional put on `GSI_AccessCode`
- Also encoded as QR code on the frontend for mobile scanning
