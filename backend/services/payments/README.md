# Servicio: payments

Lambda: `activa-club-payments-dev`
Tabla: `PaymentsTable`

## Responsabilidad

Facturación de membresías mediante Stripe:
- Creación de sesiones de checkout (planes mensual y anual)
- Manejo de webhooks de Stripe para eventos de pago
- Actualización del estado de membresía al confirmar/fallar un pago
- Almacenamiento y consulta del historial de pagos

## Estructura Clean Architecture

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
│   │   ├── billing-cycle.vo.ts       # Monthly | Annual
│   │   ├── payment-status.vo.ts      # Pending | Succeeded | Failed | Refunded
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
    │   └── webhooks.controller.ts    # Body raw para verificación de firma Stripe
    └── dtos/
        ├── create-checkout.dto.ts
        └── payment-response.dto.ts
```

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /v1/payments/checkout | Member+ | Crear sesión de checkout Stripe |
| POST | /v1/payments/webhook | Público* | Webhook Stripe (firma verificada internamente) |
| GET | /v1/payments | Member+ | Historial propio de pagos |
| GET | /v1/payments/:id | Member+ | Detalle de un pago |
| GET | /v1/admin/payments | Admin | Todos los pagos (vista admin) |

*El endpoint de webhook omite el autorizador Cognito de API Gateway. La verificación de firma Stripe se realiza dentro del Lambda.

## DynamoDB: PaymentsTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `PK` | String | `PAYMENT#<paymentId>` |
| `SK` | String | `MEMBER#<memberId>` |
| `paymentId` | String | ULID |
| `memberId` | String | Referencia a MembersTable |
| `stripeSessionId` | String | ID de la Checkout Session de Stripe |
| `amount` | Number | Monto en centavos |
| `currency` | String | ej. `ars`, `usd` |
| `billingCycle` | String | Monthly / Annual |
| `status` | String | Pending / Succeeded / Failed / Refunded |
| `periodStart` | String | ISO 8601 |
| `periodEnd` | String | ISO 8601 |
| `createdAt` | String | ISO 8601 |

GSI: `GSI_Member` — PK: `memberId`, SK: `createdAt` (historial por socio)
GSI: `GSI_StripeSession` — PK: `stripeSessionId` (idempotencia en webhook)

## Eventos de Webhook Stripe Manejados

| Evento | Acción |
|--------|--------|
| `checkout.session.completed` | Marcar pago como Succeeded, activar socio |
| `invoice.payment_succeeded` | Renovación confirmada, extender membresía |
| `invoice.payment_failed` | Marcar pago como Failed, notificar al socio |
| `customer.subscription.deleted` | Desactivar membresía |
