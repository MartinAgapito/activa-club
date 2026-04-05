# Librería: dynamodb

Factory del cliente DynamoDB y clase base de repositorio para todos los servicios de ActivaClub.

## Contenido

- `dynamo-client.ts` — Factory singleton de `DynamoDBDocumentClient` (reutiliza la conexión entre invocaciones calientes de Lambda)
- `base.repository.ts` — Clase abstracta `BaseRepository<T>` con helpers tipados: `get`, `put`, `update`, `delete`, `query`, `scan`
- `dynamo.errors.ts` — Clases de error específicas de DynamoDB (`ItemNotFoundError`, `ConditionalCheckFailedError`)

## Uso

```typescript
import { BaseRepository } from '@activa-club/dynamodb';
import { MemberEntity } from '../../domain/entities/member.entity';

export class MemberDynamoRepository extends BaseRepository<MemberEntity> {
  protected readonly tableName = process.env.MEMBERS_TABLE_NAME!;
}
```

## Tablas (nombres de variables de entorno)

| Variable de Entorno | Tabla DynamoDB |
|---------------------|----------------|
| `MEMBERS_TABLE_NAME` | `MembersTable` |
| `RESERVATIONS_TABLE_NAME` | `ReservationsTable` |
| `AREAS_TABLE_NAME` | `AreasTable` |
| `GUESTS_TABLE_NAME` | `GuestsTable` |
| `PAYMENTS_TABLE_NAME` | `PaymentsTable` |
| `PROMOTIONS_TABLE_NAME` | `PromotionsTable` |
