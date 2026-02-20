# Lib: dynamodb

DynamoDB client factory and base repository abstract class for all ActivaClub services.

## Contents

- `dynamo-client.ts` - Singleton `DynamoDBDocumentClient` factory (reuses connection across warm Lambda invocations)
- `base.repository.ts` - Abstract `BaseRepository<T>` with typed `get`, `put`, `update`, `delete`, `query`, `scan` helpers
- `dynamo.errors.ts` - DynamoDB-specific error classes (ItemNotFoundError, ConditionalCheckFailedError)

## Usage

```typescript
import { BaseRepository } from '@activa-club/dynamodb';
import { MemberEntity } from '../../domain/entities/member.entity';

export class MemberDynamoRepository extends BaseRepository<MemberEntity> {
  protected readonly tableName = process.env.MEMBERS_TABLE_NAME!;
}
```

## Tables (environment variable names)

| Env Variable              | DynamoDB Table           |
|---------------------------|--------------------------|
| `MEMBERS_TABLE_NAME`      | `MembersTable`           |
| `RESERVATIONS_TABLE_NAME` | `ReservationsTable`      |
| `AREAS_TABLE_NAME`        | `AreasTable`             |
| `GUESTS_TABLE_NAME`       | `GuestsTable`            |
| `PAYMENTS_TABLE_NAME`     | `PaymentsTable`          |
| `PROMOTIONS_TABLE_NAME`   | `PromotionsTable`        |
