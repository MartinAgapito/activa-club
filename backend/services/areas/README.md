# Service: areas

Lambda: `activa-club-areas-dev`
Table: `AreasTable`

## Responsibility

Recreational area catalog and schedule configuration:
- Area definitions (name, description, capacity, amenities)
- Schedule configuration (opening hours, blocked dates)
- Capacity rules per membership tier
- Area images management (S3 references)

## Clean Architecture Layout

```
src/
├── application/
│   ├── commands/
│   │   ├── create-area.command.ts
│   │   ├── update-area.command.ts
│   │   ├── deactivate-area.command.ts
│   │   └── set-area-schedule.command.ts
│   └── queries/
│       ├── get-area-by-id.query.ts
│       └── list-active-areas.query.ts
├── domain/
│   ├── entities/
│   │   └── area.entity.ts
│   ├── value-objects/
│   │   ├── area-status.vo.ts           # Active | Inactive | Maintenance
│   │   ├── schedule.vo.ts              # Opening hours, slot duration
│   │   └── capacity-rule.vo.ts
│   └── repositories/
│       └── area.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── area.dynamo.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── areas.controller.ts
    └── dtos/
        ├── create-area.dto.ts
        └── area-response.dto.ts
```

## API Endpoints

| Method | Path                   | Auth       | Description                   |
|--------|------------------------|------------|-------------------------------|
| GET    | /v1/areas              | Member+    | List all active areas         |
| GET    | /v1/areas/:id          | Member+    | Get area detail and schedule  |
| POST   | /v1/areas              | Admin      | Create new area               |
| PATCH  | /v1/areas/:id          | Admin      | Update area details           |
| DELETE | /v1/areas/:id          | Admin      | Deactivate area               |
| PUT    | /v1/areas/:id/schedule | Admin      | Set area schedule/hours       |

## DynamoDB: AreasTable

| Attribute       | Type     | Notes                                      |
|-----------------|----------|--------------------------------------------|
| `PK`            | String   | `AREA#<areaId>`                            |
| `SK`            | String   | `METADATA`                                 |
| `areaId`        | String   | ULID                                       |
| `name`          | String   |                                            |
| `description`   | String   |                                            |
| `capacity`      | Number   | Max concurrent users                       |
| `slotDuration`  | Number   | Minutes per slot (e.g., 60)               |
| `openingTime`   | String   | HH:MM                                      |
| `closingTime`   | String   | HH:MM                                      |
| `amenities`     | List     | String list of amenity tags                |
| `imageUrls`     | List     | S3/CloudFront image URLs                   |
| `status`        | String   | Active / Inactive / Maintenance            |
| `cancelWindow`  | Number   | Hours before slot that cancellation closes |
| `createdAt`     | String   | ISO 8601                                   |
| `updatedAt`     | String   | ISO 8601                                   |

GSI: `GSI_Status` - PK: `status` (filter active areas efficiently)
