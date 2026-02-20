# Lib: errors

Domain error classes and HTTP exception mappers for ActivaClub.

## Error Hierarchy

```
ActivaClubError (base)
├── DomainError
│   ├── MemberNotFoundError
│   ├── MemberAlreadyExistsError
│   ├── ReservationConflictError
│   ├── ReservationCapacityExceededError
│   ├── GuestLimitExceededError
│   ├── InvalidMembershipTierError
│   └── PaymentRequiredError
└── InfrastructureError
    ├── DynamoDBError
    └── ExternalServiceError (Stripe, SNS)
```

## HTTP Mapping

`error-filter.ts` is a NestJS `ExceptionFilter` that maps domain errors to standard HTTP status codes:

| Domain Error                  | HTTP Status |
|-------------------------------|-------------|
| `MemberNotFoundError`         | 404         |
| `MemberAlreadyExistsError`    | 409         |
| `ReservationConflictError`    | 409         |
| `ReservationCapacityExceeded` | 422         |
| `GuestLimitExceededError`     | 422         |
| `PaymentRequiredError`        | 402         |
| Generic `DomainError`         | 400         |
| `InfrastructureError`         | 500         |
