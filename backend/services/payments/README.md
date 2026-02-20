# Service: payments

Lambda: `activa-club-payments-dev`
Table: `PaymentsTable`

## Responsibility

Stripe-based membership billing:
- Checkout session creation (monthly and annual plans)
- Stripe webhook handling for payment events
- Membership status updates on payment confirmation / failure
- Payment history storage and retrieval

## Clean Architecture Layout

```
src/
├── application/
│   ├── commands/
│   │   ├── create-checkout-session.command.ts
│   │   ├── handle-payment-succeeded.command.ts
│   │   ├── handle-payment-failed.command.ts
│   │   └── cancel-subscription.command.ts
│   └── queries/
│       ├── get-payment-by-id.query.ts
│       └── list-payments-by-member.query.ts
├── domain/
│   ├── entities/
│   │   └── payment.entity.ts
│   ├── value-objects/
│   │   ├── billing-cycle.vo.ts         # Monthly | Annual
│   │   ├── payment-status.vo.ts        # Pending | Succeeded | Failed | Refunded
│   │   └── stripe-metadata.vo.ts
│   └── repositories/
│       └── payment.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── payment.dynamo.repository.ts
│   ├── stripe/
│   │   └── stripe.client.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   ├── payments.controller.ts
    │   └── webhooks.controller.ts      # Raw body passthrough for Stripe signature
    └── dtos/
        ├── create-checkout.dto.ts
        └── payment-response.dto.ts
```

## API Endpoints

| Method | Path                       | Auth       | Description                          |
|--------|----------------------------|------------|--------------------------------------|
| POST   | /v1/payments/checkout      | Member+    | Create Stripe checkout session       |
| POST   | /v1/payments/webhook       | Public*    | Stripe webhook (signature verified)  |
| GET    | /v1/payments               | Member+    | List own payment history             |
| GET    | /v1/payments/:id           | Member+    | Get payment detail                   |
| GET    | /v1/admin/payments         | Admin      | List all payments (admin view)       |

*Webhook endpoint bypasses Cognito authorizer; Stripe signature is verified inside the handler.

## DynamoDB: PaymentsTable

| Attribute        | Type   | Notes                                      |
|------------------|--------|--------------------------------------------|
| `PK`             | String | `PAYMENT#<paymentId>`                      |
| `SK`             | String | `MEMBER#<memberId>`                        |
| `paymentId`      | String | ULID                                       |
| `memberId`       | String | Reference to MembersTable                  |
| `stripeSessionId`| String | Stripe Checkout Session ID                 |
| `stripePaymentIntentId` | String | Stripe PaymentIntent ID            |
| `amount`         | Number | Amount in cents                            |
| `currency`       | String | e.g., `ars`, `usd`                        |
| `billingCycle`   | String | Monthly / Annual                           |
| `status`         | String | Pending / Succeeded / Failed / Refunded    |
| `periodStart`    | String | ISO 8601                                   |
| `periodEnd`      | String | ISO 8601                                   |
| `createdAt`      | String | ISO 8601                                   |

GSI: `GSI_Member` - PK: `memberId`, SK: `createdAt` (list payments by member)
GSI: `GSI_StripeSession` - PK: `stripeSessionId` (webhook idempotency lookup)

## Stripe Webhook Events Handled

| Event                               | Action                                    |
|-------------------------------------|-------------------------------------------|
| `checkout.session.completed`        | Mark payment Succeeded, activate member   |
| `invoice.payment_succeeded`         | Renewal confirmed, extend membership      |
| `invoice.payment_failed`            | Mark payment Failed, notify member        |
| `customer.subscription.deleted`     | Deactivate membership                     |
