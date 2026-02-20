# Service: members

Lambda: `activa-club-members-dev`
Table: `MembersTable`

## Responsibility

Handles the full member lifecycle:
- DNI lookup against pre-seeded legacy data (onboarding gate)
- Member profile creation and update
- Membership tier management (VIP, Gold, Silver)
- Member status transitions (Active, Inactive, Suspended, Pending)

## Clean Architecture Layout

```
src/
├── application/
│   ├── commands/
│   │   ├── create-member.command.ts
│   │   ├── update-member.command.ts
│   │   └── update-membership-tier.command.ts
│   └── queries/
│       ├── get-member-by-id.query.ts
│       ├── get-member-by-dni.query.ts
│       └── list-members.query.ts
├── domain/
│   ├── entities/
│   │   └── member.entity.ts
│   ├── value-objects/
│   │   ├── dni.vo.ts
│   │   ├── membership-tier.vo.ts
│   │   └── member-status.vo.ts
│   └── repositories/
│       └── member.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── member.dynamo.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── members.controller.ts
    └── dtos/
        ├── create-member.dto.ts
        └── update-member.dto.ts
```

## API Endpoints

| Method | Path                   | Auth             | Description               |
|--------|------------------------|------------------|---------------------------|
| POST   | /v1/members/onboard    | Public           | DNI lookup + registration |
| GET    | /v1/members/:id        | Member+          | Get own profile           |
| PATCH  | /v1/members/:id        | Member (own)     | Update profile            |
| GET    | /v1/members            | Admin/Manager    | List all members          |
| PATCH  | /v1/members/:id/tier   | Admin            | Change membership tier    |
| PATCH  | /v1/members/:id/status | Admin            | Activate/suspend member   |

## DynamoDB: MembersTable

| Attribute      | Type   | Notes                                     |
|----------------|--------|-------------------------------------------|
| `PK`           | String | `MEMBER#<memberId>`                       |
| `SK`           | String | `PROFILE`                                 |
| `memberId`     | String | ULID                                      |
| `dni`          | String | National ID (indexed)                     |
| `email`        | String | Cognito identity email                    |
| `firstName`    | String |                                           |
| `lastName`     | String |                                           |
| `membershipTier` | String | VIP / Gold / Silver                     |
| `status`       | String | Active / Inactive / Suspended / Pending   |
| `cognitoSub`   | String | Cognito user sub                          |
| `createdAt`    | String | ISO 8601                                  |
| `updatedAt`    | String | ISO 8601                                  |

GSI: `GSI_DNI` - PK: `dni` (for onboarding lookup)
GSI: `GSI_Email` - PK: `email` (for Cognito post-confirmation trigger)

## Membership Tier Rules

| Tier   | Max Reservations/Month | Guest Limit/Reservation |
|--------|------------------------|-------------------------|
| VIP    | Unlimited              | 5                        |
| Gold   | 10                     | 3                        |
| Silver | 5                      | 1                        |
