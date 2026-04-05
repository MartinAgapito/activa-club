# Módulo Terraform: dynamodb

Crea una tabla DynamoDB con GSIs opcionales, TTL y recuperación Point-in-Time (PITR).

## Entradas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `table_name` | string | Nombre de la tabla DynamoDB |
| `billing_mode` | string | PAY_PER_REQUEST o PROVISIONED (default: PAY_PER_REQUEST) |
| `hash_key` | string | Nombre del atributo de partition key |
| `range_key` | string | Nombre del atributo de sort key (opcional) |
| `attributes` | list(object) | Definiciones de atributos para keys y GSIs |
| `global_secondary_indexes` | list(object) | Definiciones de GSIs |
| `ttl_attribute` | string | Nombre del atributo TTL (opcional) |
| `point_in_time_recovery` | bool | Habilitar PITR (default: true en prod, false en dev) |
| `tags` | map(string) | Tags de recursos AWS |

## Salidas

| Salida | Descripción |
|--------|-------------|
| `table_arn` | ARN de la tabla DynamoDB |
| `table_name` | Nombre de la tabla DynamoDB |

## Tablas Instanciadas por Este Módulo

| Tabla | PK | SK |
|-------|----|----|
| `MembersTable` | `PK` (MEMBER#id) | `SK` (PROFILE) |
| `SeedMembersTable` | `DNI` | — |
| `ReservationsTable` | `PK` (RESERVATION#id) | `SK` (MEMBER#id) |
| `AreasTable` | `PK` (AREA#id) | `SK` (METADATA) |
| `GuestsTable` | `PK` (GUEST#id) | `SK` (RESERVATION#id) |
| `PaymentsTable` | `PK` (PAYMENT#id) | `SK` (MEMBER#id) |
| `PromotionsTable` | `PK` (PROMOTION#id) | `SK` (METADATA) |
