# Librería: errors

Clases de error de dominio y mapeadores de excepciones HTTP para ActivaClub.

## Jerarquía de Errores

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

## Mapeo HTTP

`error-filter.ts` es un `ExceptionFilter` de NestJS que mapea los errores de dominio a códigos HTTP estándar:

| Error de Dominio | HTTP |
|------------------|------|
| `MemberNotFoundError` | 404 |
| `MemberAlreadyExistsError` | 409 |
| `ReservationConflictError` | 409 |
| `ReservationCapacityExceeded` | 422 |
| `GuestLimitExceededError` | 422 |
| `PaymentRequiredError` | 402 |
| `DomainError` genérico | 400 |
| `InfrastructureError` | 500 |
