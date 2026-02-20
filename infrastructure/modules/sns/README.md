# Terraform Module: sns

Creates Amazon SNS topics and optional subscriptions for ActivaClub notifications.

## Inputs

| Variable              | Type         | Description                                       |
|-----------------------|--------------|---------------------------------------------------|
| `topic_name`          | string       | SNS topic name                                    |
| `display_name`        | string       | Display name shown in email notifications         |
| `email_subscriptions` | list(string) | Email addresses to subscribe (dev/testing only)   |
| `tags`                | map(string)  | AWS resource tags                                 |

## Outputs

| Output      | Description         |
|-------------|---------------------|
| `topic_arn` | SNS topic ARN       |

## Topics Created

| Topic Name                       | Purpose                                       |
|----------------------------------|-----------------------------------------------|
| `activa-club-promotions-<env>`   | Promotions broadcast to all members           |
| `activa-club-notifications-<env>`| General membership / payment notifications   |

## Filter Policies

Promotion subscribers can use SNS message attribute filter policies
to receive only promotions targeting their membership tier:

```json
{
  "membershipTier": ["VIP", "Gold", "Silver", "All"]
}
```

## Cost Note

SNS is free for the first 1 million publishes per month and free for SQS/Lambda delivery.
Email delivery costs $2 per 100,000 notifications. For thesis scale this is negligible.
