# Servicio: guests

Lambda: `activa-club-guests-dev`
Tabla: `GuestsTable`

## Responsabilidad

Registro de invitados para reservas de socios:
- Registrar invitados asociados a una reserva específica
- Generar códigos de acceso únicos (numérico + string compatible con QR)
- Validar límites de invitados según plan de membresía
- Verificación del código de acceso del invitado en la entrada del club

## Estructura Clean Architecture

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
│   │   └── guest-status.vo.ts        # Registered | CheckedIn | Cancelled
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

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /v1/reservations/:id/guests | Member+ | Registrar invitado para una reserva |
| GET | /v1/reservations/:id/guests | Member+ | Listar invitados de una reserva |
| DELETE | /v1/reservations/:id/guests/:guestId | Member+ | Eliminar invitado |
| POST | /v1/guests/verify | Admin | Verificar código de acceso en la entrada |

## DynamoDB: GuestsTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `PK` | String | `GUEST#<guestId>` |
| `SK` | String | `RESERVATION#<reservationId>` |
| `guestId` | String | ULID |
| `reservationId` | String | Referencia a ReservationsTable |
| `memberId` | String | Socio propietario |
| `firstName` | String | |
| `lastName` | String | |
| `dni` | String | DNI del invitado |
| `accessCode` | String | Código alfanumérico único de 8 caracteres |
| `status` | String | Registered / CheckedIn / Cancelled |
| `createdAt` | String | ISO 8601 |

GSI: `GSI_Reservation` — PK: `reservationId` (listar invitados por reserva)
GSI: `GSI_AccessCode` — PK: `accessCode` (búsqueda O(1) para verificación en entrada)

## Generación del Código de Acceso

- 8 caracteres alfanuméricos en mayúsculas (excluye caracteres ambiguos: 0, O, I, 1)
- Unicidad garantizada vía `PutItem` condicional en `GSI_AccessCode`
- Codificado también como QR en el frontend para escaneo móvil
