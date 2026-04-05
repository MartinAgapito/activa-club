# Módulo Terraform: sns

Crea tópicos Amazon SNS y suscripciones opcionales para las notificaciones de ActivaClub.

## Entradas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `topic_name` | string | Nombre del tópico SNS |
| `display_name` | string | Nombre visible en notificaciones por email |
| `email_subscriptions` | list(string) | Emails a suscribir (solo para dev/testing) |
| `tags` | map(string) | Tags de recursos AWS |

## Salidas

| Salida | Descripción |
|--------|-------------|
| `topic_arn` | ARN del tópico SNS |

## Tópicos Creados

| Nombre del Tópico | Propósito |
|-------------------|-----------|
| `activa-club-promotions-<env>` | Difusión de promociones a todos los socios |
| `activa-club-notifications-<env>` | Notificaciones generales de membresía y pagos |

## Políticas de Filtro

Los suscriptores de promociones pueden usar políticas de filtro sobre atributos del mensaje SNS para recibir solo las promociones que apuntan a su plan de membresía:

```json
{
  "membershipTier": ["VIP", "Gold", "Silver", "All"]
}
```

## Nota de Costos

SNS es gratuito para el primer millón de publicaciones por mes y gratuito para entrega a SQS/Lambda.
La entrega por email cuesta USD 2 por cada 100.000 notificaciones. Para el alcance de la tesis, es despreciable.
