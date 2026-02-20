# Service: promotions

Lambda: `activa-club-promotions-dev`
Table: `PromotionsTable`

## Responsibility

Manager-driven promotions and broadcast notifications:
- Promotion CRUD (create, read, update, delete)
- SNS publish to broadcast promotions to all subscribed members
- Promotion scheduling and expiration
- Member promotion feed (active promotions visible to members)

## Clean Architecture Layout

```
src/
├── application/
│   ├── commands/
│   │   ├── create-promotion.command.ts
│   │   ├── update-promotion.command.ts
│   │   ├── delete-promotion.command.ts
│   │   └── broadcast-promotion.command.ts
│   └── queries/
│       ├── get-promotion-by-id.query.ts
│       └── list-active-promotions.query.ts
├── domain/
│   ├── entities/
│   │   └── promotion.entity.ts
│   ├── value-objects/
│   │   ├── promotion-status.vo.ts      # Draft | Active | Expired | Cancelled
│   │   └── promotion-target.vo.ts      # All | VIP | Gold | Silver
│   └── repositories/
│       └── promotion.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── promotion.dynamo.repository.ts
│   ├── sns/
│   │   └── sns.client.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── promotions.controller.ts
    └── dtos/
        ├── create-promotion.dto.ts
        └── promotion-response.dto.ts
```

## API Endpoints

| Method | Path                          | Auth          | Description                       |
|--------|-------------------------------|---------------|-----------------------------------|
| POST   | /v1/promotions                | Manager+      | Create promotion                  |
| GET    | /v1/promotions                | Member+       | List active promotions            |
| GET    | /v1/promotions/:id            | Member+       | Get promotion detail              |
| PATCH  | /v1/promotions/:id            | Manager+      | Update promotion                  |
| DELETE | /v1/promotions/:id            | Admin         | Delete promotion                  |
| POST   | /v1/promotions/:id/broadcast  | Manager+      | Publish to SNS topic              |

## DynamoDB: PromotionsTable

| Attribute     | Type   | Notes                                      |
|---------------|--------|--------------------------------------------|
| `PK`          | String | `PROMOTION#<promotionId>`                  |
| `SK`          | String | `METADATA`                                 |
| `promotionId` | String | ULID                                       |
| `title`       | String |                                            |
| `description` | String |                                            |
| `imageUrl`    | String | S3 presigned URL or CloudFront URL         |
| `target`      | String | All / VIP / Gold / Silver                  |
| `status`      | String | Draft / Active / Expired / Cancelled       |
| `startsAt`    | String | ISO 8601                                   |
| `expiresAt`   | String | ISO 8601                                   |
| `createdBy`   | String | Manager memberId                           |
| `broadcastAt` | String | ISO 8601 timestamp of last SNS publish     |
| `createdAt`   | String | ISO 8601                                   |

GSI: `GSI_Status` - PK: `status`, SK: `startsAt` (list active promotions sorted by date)

## SNS Integration

- Topic: `activa-club-promotions-<env>`
- Message attributes include `membershipTier` for subscriber filter policies.
- Members subscribe to the topic on registration (email or push endpoint).
