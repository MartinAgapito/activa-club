# Service: admin

Lambda: `activa-club-admin-dev`

## Responsibility

Admin-only aggregated views, analytics, and cross-domain management:
- Member management (list, filter, export)
- Reservation analytics (usage by area, peak hours)
- Payment/revenue dashboard
- Notification dispatch (manual SNS sends)
- Audit log access
- FAQ content management

This service performs **read aggregations** across all other DynamoDB tables.
It does NOT own any primary table but has read access to all tables.

## Clean Architecture Layout

```
src/
├── application/
│   └── queries/
│       ├── get-members-report.query.ts
│       ├── get-reservations-analytics.query.ts
│       ├── get-revenue-report.query.ts
│       ├── get-guests-report.query.ts
│       └── get-audit-logs.query.ts
├── domain/
│   └── value-objects/
│       ├── date-range.vo.ts
│       └── report-format.vo.ts
├── infrastructure/
│   ├── repositories/
│   │   └── analytics.cross-table.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   ├── admin-members.controller.ts
    │   ├── admin-analytics.controller.ts
    │   ├── admin-payments.controller.ts
    │   └── admin-notifications.controller.ts
    └── dtos/
        ├── analytics-response.dto.ts
        └── notification-dispatch.dto.ts
```

## API Endpoints

| Method | Path                               | Auth  | Description                          |
|--------|------------------------------------|-------|--------------------------------------|
| GET    | /v1/admin/members                  | Admin | List/filter all members              |
| GET    | /v1/admin/analytics/reservations   | Admin | Reservation stats (area, date range) |
| GET    | /v1/admin/analytics/revenue        | Admin | Revenue totals by period             |
| GET    | /v1/admin/analytics/members        | Admin | Member growth and tier breakdown     |
| POST   | /v1/admin/notifications            | Admin | Manual SNS notification dispatch     |
| GET    | /v1/admin/audit-logs               | Admin | Paginated audit log entries          |

## DynamoDB Access

This Lambda has IAM read permissions on:
- `MembersTable`
- `ReservationsTable`
- `PaymentsTable`
- `GuestsTable`
- `PromotionsTable`
- `AreasTable`
- `AuditLogsTable` (if enabled)

## Analytics Strategy

For thesis scope: analytics are computed on-the-fly via DynamoDB scans + GSI queries.
Future enhancement: integrate Amazon Athena or DynamoDB Streams -> S3 for pre-aggregated reports.

Note: DynamoDB Scan operations on large tables can consume significant read capacity units.
Monitor with CloudWatch and switch to GSI-based queries as data grows.
