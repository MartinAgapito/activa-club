# AC-016 Design: Automatic Reservation Expiration

**Epic:** EP-02 - Reservas
**Story Points:** 3
**Priority:** High
**Status:** Design — Ready for Implementation
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-18
**Depends on:** AC-012 (reservations to expire), AC-011 (availability must reflect expired slots), AC-014 (expired reservations appear in member history)

---

## 1. Overview

AC-016 is a fully automated background process that transitions `CONFIRMED` reservations to `EXPIRED` once their `end_time` has passed. It runs on a fixed hourly schedule via AWS EventBridge Scheduler and also supports manual Admin-triggered invocation via an HTTP endpoint.

The process is designed to be:
- **Idempotent:** running twice in the same hour produces no duplicate updates.
- **Resilient:** a failure on one reservation does not stop processing of the rest.
- **Non-disruptive:** it does NOT modify `weekly_reservation_count` (business rule — only explicit cancellation restores quota).

A second, purpose-built Lambda (`activa-club-reservations-expirer-dev`) is introduced for this story, separate from the main reservations Lambda. This keeps the EventBridge target small and avoids loading the full NestJS routing stack for a simple batch operation.

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-expirer-dev` | New Lambda | Invoked by EventBridge Scheduler (hourly) and by the reservations Lambda (manual Admin trigger) |
| `activa-club-reservations-dev` | New endpoint | `POST /v1/admin/reservations/expire-now` — invokes expirer Lambda asynchronously |

**Tables written by the expirer Lambda:**

| Table | Operation |
|-------|-----------|
| `ReservationsTable` | UpdateItem — SET `status = EXPIRED`, `updated_at = now` |
| `SlotOccupancyTable` | UpdateItem — ADD `occupancy -1` |

**Tables read by the expirer Lambda:**

| Table | Purpose |
|-------|---------|
| `ReservationsTable` | Query `GSI_StatusExpires` — find `CONFIRMED` reservations with `expires_at <= now` |

---

## 3. API Contract

### POST /v1/admin/reservations/expire-now

**Auth:** Admin only.

This endpoint is served by `activa-club-reservations-dev`. It does not execute the expiration logic itself — it invokes `activa-club-reservations-expirer-dev` asynchronously (Lambda InvokeType: `Event`) and returns immediately.

**No request body.**

**Success Response — HTTP 202 Accepted:**

```json
{
  "message": "Proceso de expiración iniciado",
  "invokedAt": "2026-04-18T15:00:00Z"
}
```

The response does not include results of the expiration run (fire-and-forget). The Admin must check CloudWatch Logs for the execution summary.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403  | `FORBIDDEN` | Caller's Cognito group is not `Admin` |
| 500  | `INTERNAL_ERROR` | Lambda invocation call to the expirer failed |

---

## 4. DynamoDB Design

### 4.1 ReservationsTable — GSI_StatusExpires

**Access pattern — find all reservations to expire:**

```
Query GSI_StatusExpires:
  KeyConditionExpression: #status = :confirmed AND expires_at <= :nowIso
  ProjectionExpression: pk, sk, reservation_id, area_id, date, start_time, end_time, duration_minutes
  ScanIndexForward: true
  Paginate with LastEvaluatedKey until exhausted
```

`expires_at` is an ISO-8601 UTC string (e.g., `2026-04-20T10:00:00Z`). Lexicographic string comparison on ISO-8601 UTC timestamps is equivalent to chronological comparison, making this a correct range condition.

#### GSI_StatusExpires

| Property | Value |
|----------|-------|
| Index Name | `GSI_StatusExpires` |
| PK | `status` (String) — low-cardinality key |
| SK | `expires_at` (String) |
| Projection | `KEYS_ONLY` |

`KEYS_ONLY` keeps the index small. The expirer reads `pk` and `sk` from the index, then fetches the additional attributes (`area_id`, `start_time`, `duration_minutes`) via the projected attributes — since the projection is KEYS_ONLY, the expirer uses the `pk`+`sk` to do the `UpdateItem` directly without an additional GetItem (the update does not need the full record, just the keys and the attributes written).

> Scale consideration (from EP-02 Open Question #2): The PK `status = CONFIRMED` creates a single hot partition for all in-flight reservations. At MVP scale (hundreds of reservations) this is acceptable. At production scale, a time-bucketed PK (`STATUS_DATE#CONFIRMED#<YYYY-MM-DD>`) would distribute reads. This is deferred to a post-MVP iteration.

### 4.2 SlotOccupancyTable — occupancy decrement

For each expired reservation, the Lambda decrements the occupancy of every slot covered by that reservation:

```
For slot in [start_time, end_time) step 60 minutes:
  UpdateItem SlotOccupancyTable:
    Key: { pk: SLOT#<areaId>#<date>#<slot> }
    UpdateExpression: ADD occupancy :minusOne
    ConditionExpression: occupancy > :zero
```

Multi-slot reservations (2h Gold, 4h VIP) require one UpdateItem per covered slot.

---

## 5. Expirer Lambda Step-by-Step Execution

```
1. Lambda invoked (EventBridge Scheduler trigger or direct async invoke)
2. Log execution start: { startedAt: ISO-8601, trigger: "eventbridge" | "manual" }

3. Query loop — GSI_StatusExpires:
   a. KeyConditionExpression: status = CONFIRMED AND expires_at <= :nowIso
   b. Collect all results, paginating with LastEvaluatedKey
   c. Log: { totalFound: N }

4. For each reservation in batches of 10 (concurrent, Promise.allSettled):
   a. Build TransactWrite:
      i.  UpdateItem ReservationsTable:
            SET status = :expired, updated_at = :now
            ConditionExpression: #status = :confirmed
            ← idempotency guard; fails if already EXPIRED
      ii. For each slot covered by the reservation:
            UpdateItem SlotOccupancyTable:
              ADD occupancy :minusOne
              ConditionExpression: occupancy > :zero
   b. Execute TransactWrite
   c. On TransactionCanceledException (ConditionalCheckFailed on reservation):
      → Already EXPIRED by a concurrent run; skip silently (idempotent)
   d. On any other error:
      → Log { reservationId, error }; continue to next item

5. Log execution summary:
   {
     processedAt: ISO-8601,
     totalFound: N,
     totalExpired: M,
     totalSkipped: K,
     totalErrors: E,
     errorReservationIds: [...]
   }
```

**Idempotency guarantee:** The `ConditionExpression: status = CONFIRMED` on the UpdateItem ensures that a second run on the same reservation causes `TransactionCanceledException` with `ConditionalCheckFailed`, which is caught and counted as `totalSkipped`. No duplicate writes occur.

**Weekly counter NOT decremented.** This is an explicit business rule from AC-016: expiration by time passage does not restore the member's weekly quota. Only explicit cancellation (AC-013, AC-015) decrements `weekly_reservation_count`.

---

## 6. Authorization Rules

| Actor | Access |
|-------|--------|
| EventBridge Scheduler | Invokes `activa-club-reservations-expirer-dev` directly via IAM role (no Cognito) |
| Admin (HTTP) | Calls `POST /v1/admin/reservations/expire-now` through API Gateway; Lambda verifies `cognito:groups` contains `Admin` |
| Manager | No access to manual trigger |
| Member | No access |
| Expirer Lambda | Has IAM permissions only to `dynamodb:Query` (GSI_StatusExpires), `dynamodb:UpdateItem`, `dynamodb:TransactWriteItems` on `ReservationsTable` and `SlotOccupancyTable` — no read access to member data, no access to other tables |

---

## 7. Terraform Changes

### 7.1 New Lambda: activa-club-reservations-expirer

File: `infrastructure/modules/lambda/expirer.tf`

```hcl
resource "aws_lambda_function" "reservations_expirer" {
  function_name = "activa-club-reservations-expirer-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "dist/infrastructure/handlers/lambda.handler"
  role          = aws_iam_role.reservations_expirer.arn
  timeout       = 300  # 5 minutes — allows processing large backlogs safely
  memory_size   = 256

  environment {
    variables = {
      RESERVATIONS_TABLE   = "ReservationsTable"
      SLOT_OCCUPANCY_TABLE = "SlotOccupancyTable"
      ENVIRONMENT          = var.environment
    }
  }

  filename         = var.expirer_lambda_zip_path
  source_code_hash = filebase64sha256(var.expirer_lambda_zip_path)

  tags = {
    Environment = var.environment
    Service     = "reservations-expirer"
  }
}
```

### 7.2 IAM Role and Policy for the Expirer Lambda

```hcl
resource "aws_iam_role" "reservations_expirer" {
  name = "activa-club-reservations-expirer-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "reservations_expirer_dynamo" {
  name = "dynamo-access"
  role = aws_iam_role.reservations_expirer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:TransactWriteItems"
        ]
        Resource = [
          "arn:aws:dynamodb:*:*:table/ReservationsTable",
          "arn:aws:dynamodb:*:*:table/ReservationsTable/index/GSI_StatusExpires",
          "arn:aws:dynamodb:*:*:table/SlotOccupancyTable"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
```

### 7.3 EventBridge Scheduler

File: `infrastructure/modules/eventbridge/main.tf` (new module)

```hcl
resource "aws_scheduler_schedule" "reservations_expirer" {
  name       = "activa-club-reservations-expirer-${var.environment}"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(1 hour)"

  target {
    arn      = aws_lambda_function.reservations_expirer.arn
    role_arn = aws_iam_role.eventbridge_scheduler.arn

    input = jsonencode({
      trigger = "eventbridge-scheduler"
    })
  }
}

resource "aws_iam_role" "eventbridge_scheduler" {
  name = "activa-club-eventbridge-scheduler-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "eventbridge_scheduler_invoke" {
  name = "invoke-expirer"
  role = aws_iam_role.eventbridge_scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.reservations_expirer.arn
    }]
  })
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeScheduler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reservations_expirer.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.reservations_expirer.arn
}
```

### 7.4 Manual Trigger Route on `activa-club-reservations-dev`

```hcl
resource "aws_apigatewayv2_route" "admin_expire_now" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /v1/admin/reservations/expire-now"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}
```

### 7.5 IAM permission for `activa-club-reservations-dev` to invoke the expirer

Add to the reservations Lambda's inline policy:

```hcl
{
  Effect   = "Allow"
  Action   = ["lambda:InvokeFunction"]
  Resource = "arn:aws:lambda:*:*:function:activa-club-reservations-expirer-${var.environment}"
}
```

### 7.6 Free Tier Note

- **EventBridge Scheduler:** Free tier is 14,000,000 invocations/month. One invocation/hour = 744/month. Zero cost risk.
- **Lambda:** Free tier is 1,000,000 invocations/month + 400,000 GB-seconds. One invocation/hour = 744/month. Duration at 256MB × up to 5 minutes (300 seconds) = 76,800 MB-seconds = 75 GB-seconds/month. Well within the 400,000 GB-seconds free tier.
- **DynamoDB:** PAY_PER_REQUEST. At MVP scale (hundreds of reservations/day), reads/writes cost fractions of a cent. Free tier is 25 RCU + 25 WCU provisioned; with PAY_PER_REQUEST, 25 WCU of free tier equivalent is consumed. Within free tier at MVP scale.

---

## 8. Frontend Changes

### 8.1 Admin Manual Trigger Button

The manual trigger is surfaced in the Admin dashboard (future EP-06 story). For now, the endpoint is documented and accessible via curl or Admin tools.

**Minimum viable UI (if Admin dashboard exists):**

A button "Forzar expiración ahora" in the reservations management section of the Admin panel. On click, calls `POST /v1/admin/reservations/expire-now`. Response is HTTP 202; frontend shows a toast: "Proceso de expiración iniciado. Revisá los logs para ver el resultado."

No React Query hook is defined for this endpoint (it is a fire-and-forget mutation with no response data). Use a plain `useMutation` with no cache invalidation — the expiration effect will be visible on the next poll or manual refresh of the relevant reservation lists.

### 8.2 Visible Impact on Member Views

No new UI components are required for AC-016. Its effects are visible in:

- **AC-014 "Historial" tab:** Expired reservations appear as status `EXPIRED`, displayed as "Finalizada" in Spanish.
- **AC-011 availability grid:** Slots with expired reservations show correct (freed) occupancy because `SlotOccupancyTable` is decremented by the expirer.

---

## 9. Edge Cases and Validations

| Scenario | Expirer Behavior | Observable Effect |
|----------|-----------------|-------------------|
| EventBridge fires while a previous run is still in progress | Both runs query the same GSI; the second run finds the same reservations. The idempotency guard (`ConditionExpression: status = CONFIRMED`) prevents double-updates. The second run logs these as `totalSkipped`. | No data corruption |
| Reservation already cancelled by member before expiration | `ConditionExpression` fails (status = CANCELLED); counted as `totalSkipped` | No change |
| Reservation `expires_at` is in the future (clock drift) | Not matched by `expires_at <= :nowIso` condition; not processed | Correct — only past-end reservations are expired |
| DynamoDB `SlotOccupancyTable` item has `occupancy = 0` (data inconsistency) | `ConditionExpression: occupancy > 0` fails; `TransactionCanceledException` on slot decrement; entire TransactWrite rolls back; reservation remains `CONFIRMED`; error logged with `reservationId` | Reservation re-queried on next run; same failure occurs; data inconsistency must be investigated manually |
| Batch of 10 concurrent TransactWrites, one fails | `Promise.allSettled` collects all results; failed items logged individually; successful items committed; next run re-attempts failed items | Partial processing per run; convergence guaranteed by idempotency |
| Manual Admin trigger fires immediately after hourly EventBridge trigger | Two overlapping runs; both idempotent; one processes all items, the other logs all as `totalSkipped` | Correct; no harm done |
| VIP 4-hour reservation: `expires_at` is `12:00`, expirer runs at 11:30 | Not matched (`expires_at > now`); not expired yet | Correct — expirer respects `end_time` strictly |
| Timezone: club in UTC-3, reservation ends at `09:00 local = 12:00 UTC` | `expires_at` is stored in UTC at creation time. Expirer uses UTC `now`. Comparison is correct as long as `expires_at` was computed correctly in AC-012 using the `CLUB_TIMEZONE` env var | Correct if AC-012 stores `expires_at` in UTC |
| Lambda times out (> 300 seconds) during a very large backlog | Lambda exits; CloudWatch logs show last processed reservation. Next scheduled run re-queries and resumes from the unconsumed portion of `GSI_StatusExpires`. Idempotency ensures no double-processing. | Self-healing via next scheduled invocation |
