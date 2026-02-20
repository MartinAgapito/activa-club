# Terraform Module: dynamodb

Creates a DynamoDB table with optional GSIs, TTL, and Point-in-Time Recovery.

## Inputs

| Variable           | Type         | Description                                    |
|--------------------|--------------|------------------------------------------------|
| `table_name`       | string       | DynamoDB table name                            |
| `billing_mode`     | string       | PAY_PER_REQUEST or PROVISIONED (default: PAY_PER_REQUEST) |
| `hash_key`         | string       | Partition key attribute name                   |
| `range_key`        | string       | Sort key attribute name (optional)             |
| `attributes`       | list(object) | Attribute definitions for keys and GSI keys    |
| `global_secondary_indexes` | list(object) | GSI definitions                    |
| `ttl_attribute`    | string       | TTL attribute name (optional)                  |
| `point_in_time_recovery` | bool  | Enable PITR (default: true in prod, false in dev) |
| `tags`             | map(string)  | AWS resource tags                              |

## Outputs

| Output     | Description              |
|------------|--------------------------|
| `table_arn`| DynamoDB table ARN       |
| `table_name`| DynamoDB table name     |

## Tables Instantiated by This Module

| Table Name          | PK                        | SK                       |
|---------------------|---------------------------|--------------------------|
| `MembersTable`      | `PK` (MEMBER#id)          | `SK` (PROFILE)           |
| `ReservationsTable` | `PK` (RESERVATION#id)     | `SK` (MEMBER#id)         |
| `AreasTable`        | `PK` (AREA#id)            | `SK` (METADATA)          |
| `GuestsTable`       | `PK` (GUEST#id)           | `SK` (RESERVATION#id)    |
| `PaymentsTable`     | `PK` (PAYMENT#id)         | `SK` (MEMBER#id)         |
| `PromotionsTable`   | `PK` (PROMOTION#id)       | `SK` (METADATA)          |
