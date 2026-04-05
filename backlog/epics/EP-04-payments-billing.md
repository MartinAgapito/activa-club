# EP-04: Pagos y Facturación (Payments & Billing)

**Estado:** Backlog
**Prioridad:** Alta

## Descripción

Integración con Stripe para la gestión de pagos de membresías mensuales y anuales. Incluye alta de método de pago, cobro recurrente, historial de pagos y manejo de fallos de cobro.

## Objetivo de Negocio

Automatizar el cobro de membresías y reducir la morosidad mediante recordatorios y reintentos automáticos, eliminando la gestión manual de cobros.

## Stories

| ID | Título | Estado |
|----|--------|--------|
| — | Por definir | Backlog |

## Criterios de Completitud del Epic

- [ ] Un socio puede registrar su método de pago (tarjeta) vía Stripe.
- [ ] El sistema cobra automáticamente la membresía según el ciclo (mensual/anual).
- [ ] El socio recibe un comprobante de pago por email tras cada cobro exitoso.
- [ ] Los fallos de cobro generan notificaciones y reintentos automáticos.
- [ ] El admin puede ver el estado de pagos de todos los socios.
- [ ] Un socio puede consultar su historial de pagos.
