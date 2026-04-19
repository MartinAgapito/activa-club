# AC-012 Design: Create Reservation

**Epic:** EP-02 - Reservas
**Story Points:** 8
**Priority:** High
**Status:** Design — Ready for Implementation
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-18
**Depends on:** AC-005, AC-006 (authenticated session), AC-011 (availability query, upstream)

---

## 1. Overview

AC-012 is the core write operation of EP-02. It allows an authenticated Member to create a reservation for an area, subject to membership rules (area access, duration limit, weekly quota) and real-time slot capacity. The reservation creation and slot occupancy increment must be atomic to prevent double-booking under concurrent load.

Key design decisions (from EP-02-design.md):

- **`TransactWrite` with conditional check:** A single DynamoDB transaction increments the slot occupancy counter AND creates the reservation record. A `ConditionExpression` on the `SlotOccupancyTable` item ensures the operation fails immediately if capacity is already reached, rather than relying on post-hoc validation.
- **Weekly quota on `MembersTable`:** `weekly_reservation_count` + `weekly_reset_at` fields on the member profile. The Lambda resets the count when `now >= weekly_reset_at` (idempotent reset via conditional UpdateItem).
- **`member_name` denormalized** into `ReservationsTable` at creation time to avoid cross-table joins in AC-015 manager calendar queries.
- **`expires_at` computed at creation time** as ISO-8601 UTC of `date + endTime`, stored in `ReservationsTable` for the AC-016 expirer GSI query.

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-dev` | New command handler | `create-reservation.command.ts` |

**Tables written:**

| Table | Operation |
|-------|-----------|
| `ReservationsTable` | `PutItem` — new reservation record |
| `SlotOccupancyTable` | `UpdateItem` — increment `occupancy` (inside TransactWrite) |
| `MembersTable` | `UpdateItem` — increment `weekly_reservation_count` (inside TransactWrite) |

**Tables read:**

| Table | Purpose |
|-------|---------|
| `AreasTable` | Area config: capacity, `allowed_memberships`, `max_duration_minutes`, schedule |
| `MembersTable` | Membership type, account status, weekly quota state |
| `ReservationsTable` | Overlap check via `GSI_Member` |

---

## 3. API Contract

### POST /v1/reservations

**Auth:** Member only — Cognito JWT Authorizer. Manager and Admin are excluded from this endpoint (Managers do not create reservations on behalf of members in MVP).

**Request Body:**

```json
{
  "areaId": "01JFAKE0000000000000000001",
  "date": "2026-04-20",
  "startTime": "09:00",
  "durationMinutes": 60
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `areaId` | String | Yes | Valid ULID of an existing active area |
| `date` | String | Yes | `YYYY-MM-DD` — today to today+7 |
| `startTime` | String | Yes | `HH:MM` 24h — must align to area slot boundary (hourly) |
| `durationMinutes` | Number | Yes | Multiple of 60; <= member's `max_duration_minutes` for the area |

**Success Response — HTTP 201:**

```json
{
  "reservationId": "01JFAKE0000000000000000099",
  "areaId": "01JFAKE0000000000000000001",
  "areaName": "Cancha de Tenis",
  "date": "2026-04-20",
  "startTime": "09:00",
  "endTime": "10:00",
  "durationMinutes": 60,
  "status": "CONFIRMED",
  "createdAt": "2026-04-18T14:23:00Z"
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400  | `INVALID_BODY` | Missing required field or invalid format |
| 400  | `DATE_IN_PAST` | Requested date is before today (UTC) |
| 400  | `DATE_EXCEEDS_WINDOW` | Date is more than 7 days ahead |
| 400  | `INVALID_START_TIME` | `startTime` does not align to hourly slot boundary or is outside area schedule |
| 400  | `DURATION_EXCEEDS_MAXIMUM` | `durationMinutes` exceeds the member's `max_duration_minutes` for their membership type |
| 400  | `DURATION_NOT_MULTIPLE` | `durationMinutes` is not a multiple of 60 |
| 403  | `MEMBERSHIP_INACTIVE` | Member `account_status != active` |
| 403  | `AREA_NOT_ACCESSIBLE` | Area not in member's `allowed_memberships` |
| 403  | `WEEKLY_QUOTA_EXCEEDED` | Member has reached their weekly reservation limit |
| 404  | `AREA_NOT_FOUND` | Area does not exist or `status = Inactive` |
| 409  | `SLOT_FULL` | Slot occupancy reached capacity (TransactWrite ConditionalCheckFailed) |
| 409  | `OVERLAP_CONFLICT` | Member already has a `CONFIRMED` reservation overlapping this slot/date |
| 500  | `INTERNAL_ERROR` | Unrecoverable error; no partial record created |

**Common error envelope:**

```json
{
  "status": 409,
  "error": {
    "code": "SLOT_FULL",
    "message": "El horario seleccionado ya no está disponible. Por favor, elegí otro horario."
  }
}
```

---

## 4. DynamoDB Design

### 4.1 ReservationsTable

| Key | Value |
|-----|-------|
| PK  | `RESERVATION#<ulid>` |
| SK  | `MEMBER#<memberId>` |

**Item written on reservation creation:**

| Attribute | Type | Value |
|-----------|------|-------|
| `pk` | String | `RESERVATION#<ulid>` |
| `sk` | String | `MEMBER#<memberId>` |
| `reservation_id` | String | ULID (denormalized from pk) |
| `member_id` | String | ULID (denormalized from sk) |
| `member_name` | String | Denormalized from MembersTable — used in AC-015 manager calendar |
| `area_id` | String | ULID |
| `area_name` | String | Denormalized from AreasTable |
| `date` | String | `YYYY-MM-DD` |
| `start_time` | String | `HH:MM` |
| `end_time` | String | `HH:MM` — computed: `startTime + durationMinutes` |
| `duration_minutes` | Number | Integer |
| `status` | String | `CONFIRMED` |
| `created_at` | String | ISO-8601 UTC |
| `updated_at` | String | ISO-8601 UTC (same as `created_at` on creation) |
| `expires_at` | String | ISO-8601 UTC of `date + endTime` — used by `GSI_StatusExpires` in AC-016 |

**GSIs on ReservationsTable:**

| GSI | PK | SK | Projection | Used by |
|-----|----|----|-----------|---------|
| `GSI_Member` | `member_id` | `created_at` | ALL | AC-014 list member's reservations, AC-012 overlap check |
| `GSI_AreaDate` | `area_id` | `date` | ALL | AC-015 manager calendar |
| `GSI_StatusExpires` | `status` | `expires_at` | KEYS_ONLY | AC-016 expirer |
| `GSI_ReservationId` | `reservation_id` | — | KEYS_ONLY | AC-013 cancel (resolve pk+sk from reservationId only) |

### 4.2 SlotOccupancyTable

| Key | Value |
|-----|-------|
| PK  | `SLOT#<areaId>#<date>#<startTime>` |

**UpdateItem expression used in TransactWrite:**

```
SET occupancy = if_not_exists(occupancy, :zero) + :one,
    area_id = :areaId,
    date = :date,
    start_time = :startTime,
    capacity = if_not_exists(capacity, :cap),
    updated_at = :now
```

Condition check (separate ConditionCheck item in TransactWrite):

```
attribute_not_exists(pk) OR occupancy < capacity
```

If the slot item does not exist, `attribute_not_exists(pk)` passes and the UpdateItem initializes `occupancy = 1`.

**For multi-slot reservations (e.g., durationMinutes = 120 = 2 slots):** The TransactWrite includes one UpdateItem per covered slot. For a 2-hour reservation starting at 09:00, both `SLOT#...#09:00` and `SLOT#...#10:00` are incremented. Each slot has its own ConditionCheck.

> TransactWrite limit: 100 items. A single reservation at max VIP duration (4 hours = 4 slots) requires 4 ConditionChecks + 4 UpdateItems + 1 PutItem (reservation) + 1 UpdateItem (member) = 10 items. Well within the limit.

### 4.3 MembersTable (write: weekly count)

**UpdateItem expression in TransactWrite:**

Normal case (no reset needed):

```
ADD weekly_reservation_count :one
```

Reset case (when `now >= weekly_reset_at`):

```
SET weekly_reservation_count = :one, weekly_reset_at = :nextMonday
CONDITION: weekly_reset_at <= :now
```

The ConditionExpression on the reset case makes it idempotent: if two concurrent requests both try to reset, only one succeeds; the other falls back to a plain ADD.

---

## 5. Authorization Rules

| Role | Can create reservations | Notes |
|------|------------------------|-------|
| Member | Yes | Own reservations only; area must be in their `allowed_memberships` |
| Manager | No | Manager does not create reservations in MVP |
| Admin | No | Admin does not create reservations in MVP |

**Membership rules enforced at Lambda level (not at API Gateway):**

| Membership | Max duration | Weekly limit | Accessible areas |
|------------|-------------|-------------|-----------------|
| Silver | 60 min | 2 | Cancha de Tenis, Piscina |
| Gold | 120 min | 3 | Parrillas, Cancha de Tenis, Piscina |
| VIP | 240 min | 5 | All areas (including Salón de Eventos) |

---

## 6. Terraform Changes

### 6.1 API Gateway Route (new)

```hcl
resource "aws_apigatewayv2_route" "post_reservation" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /v1/reservations"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}
```

### 6.2 New DynamoDB Table: SlotOccupancyTable

File: `infrastructure/modules/dynamodb/main.tf`

```hcl
resource "aws_dynamodb_table" "slot_occupancy" {
  name         = "SlotOccupancyTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Service     = "reservations"
  }
}
```

### 6.3 New DynamoDB GSIs on ReservationsTable

Add to existing `aws_dynamodb_table.reservations`:

```hcl
attribute { name = "member_id"      type = "S" }
attribute { name = "created_at"     type = "S" }
attribute { name = "area_id"        type = "S" }
attribute { name = "date"           type = "S" }
attribute { name = "status"         type = "S" }
attribute { name = "expires_at"     type = "S" }
attribute { name = "reservation_id" type = "S" }

global_secondary_index {
  name            = "GSI_Member"
  hash_key        = "member_id"
  range_key       = "created_at"
  projection_type = "ALL"
}

global_secondary_index {
  name            = "GSI_AreaDate"
  hash_key        = "area_id"
  range_key       = "date"
  projection_type = "ALL"
}

global_secondary_index {
  name            = "GSI_StatusExpires"
  hash_key        = "status"
  range_key       = "expires_at"
  projection_type = "KEYS_ONLY"
}

global_secondary_index {
  name            = "GSI_ReservationId"
  hash_key        = "reservation_id"
  projection_type = "KEYS_ONLY"
}
```

### 6.4 MembersTable Attribute Additions

Add to existing `aws_dynamodb_table.members` (no new table; just new attributes used at runtime — no Terraform change needed since DynamoDB is schemaless for non-key attributes).

Fields `weekly_reservation_count` and `weekly_reset_at` are added to member records at first reservation or on reset boundary crossing. Existing records default to `0` / `next Monday` via Lambda-side fallback.

### 6.5 IAM Policy additions for `activa-club-reservations-dev`

```hcl
{
  Effect = "Allow"
  Action = [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:BatchGetItem",
    "dynamodb:TransactWriteItems"
  ]
  Resource = [
    "arn:aws:dynamodb:*:*:table/ReservationsTable",
    "arn:aws:dynamodb:*:*:table/ReservationsTable/index/*",
    "arn:aws:dynamodb:*:*:table/SlotOccupancyTable",
    "arn:aws:dynamodb:*:*:table/AreasTable",
    "arn:aws:dynamodb:*:*:table/AreasTable/index/*",
    "arn:aws:dynamodb:*:*:table/MembersTable",
    "arn:aws:dynamodb:*:*:table/MembersTable/index/*"
  ]
}
```

---

## 7. Frontend Changes

### 7.1 New Page

**Route:** `/reservations/new`
**Component:** `NewReservationPage`
**Access:** Member only (`MemberGuard`)

**Wizard steps:**

1. **AreaSelector** — filterable list of areas accessible to the member's membership type. Fetched from `GET /v1/areas` (existing areas endpoint). Clicking an area navigates to step 2.
2. **DateSlotPicker** — calendar constrained to `[today, today+7]` + `SlotGrid` (reuses AC-011 `useAreaAvailability` hook). Selecting an available slot pre-fills `startTime` and navigates to step 3.
3. **DurationPicker** — radio group with valid durations (multiples of 60, max per membership type). Disabled options above member's `max_duration_minutes`. Navigates to step 4.
4. **ConfirmStep** — summary card (area, date, startTime, endTime, duration). "Confirmar Reserva" button triggers the mutation.

State across steps managed via `useReducer` local to `NewReservationPage` (no Zustand — transient wizard state).

### 7.2 React Query Mutation

```typescript
function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReservationDto) =>
      api.post('/v1/reservations', body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      queryClient.invalidateQueries({
        queryKey: ['area-availability', variables.areaId, variables.date]
      });
      navigate(`/reservations?highlight=${data.reservationId}`);
    },
    onError: (error) => {
      // Map API error codes to Spanish user messages
      toast.error(mapReservationError(error));
    }
  });
}
```

**Error code mapping (client-side):**

| Code | Spanish message |
|------|----------------|
| `SLOT_FULL` | "El horario ya no está disponible. Por favor, elegí otro." |
| `WEEKLY_QUOTA_EXCEEDED` | "Alcanzaste tu límite semanal de reservas." |
| `MEMBERSHIP_INACTIVE` | "Tu membresía está inactiva. Regularizá tu situación para reservar." |
| `OVERLAP_CONFLICT` | "Ya tenés una reserva en ese horario." |
| `DURATION_EXCEEDS_MAXIMUM` | "La duración elegida supera el máximo permitido para tu membresía." |

### 7.3 Validation (client-side)

```typescript
const createReservationSchema = z.object({
  areaId: z.string().ulid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/),
  durationMinutes: z.number().multipleOf(60).min(60).max(240),
});
```

---

## 8. Edge Cases and Validations

| Scenario | Backend Behavior | Frontend Behavior |
|----------|-----------------|-------------------|
| Race condition: two members book the last slot simultaneously | Only one TransactWrite succeeds; the other receives `TransactionCanceledException → 409 SLOT_FULL` | Toast error "El horario ya no está disponible" + redirect to availability |
| Multi-slot reservation: 2-hour booking for Gold | Lambda increments both `09:00` and `10:00` slot counters in the same TransactWrite | DurationPicker shows max 120 min for Gold members |
| Weekly reset boundary crossed during booking | Lambda detects `now >= weekly_reset_at`, resets counter to 0 and proceeds with the reservation in the same TransactWrite | No visible impact; quota badge reflects new count |
| Concurrent reset: two requests both try to reset the weekly counter | One succeeds (ConditionExpression `weekly_reset_at <= :now` passes); the other fails the condition and falls back to plain ADD — both reservations succeed | No visible impact |
| Member has debt (account_status = suspended) | `403 MEMBERSHIP_INACTIVE` before any DynamoDB writes | Error banner with link to payments page |
| `durationMinutes = 120` for Silver member | `400 DURATION_EXCEEDS_MAXIMUM` — Silver max is 60 min | DurationPicker disables options > 60 min for Silver; server guard as backstop |
| `startTime = 21:00`, `durationMinutes = 120` → endTime 23:00 beyond closing | `400 INVALID_START_TIME` — `endTime > closingTime` | DurationPicker disables durations that would exceed closing time for selected slot |
| No `SlotOccupancyTable` item for slot (first ever booking) | `if_not_exists(occupancy, 0)` initializes to 0; condition `attribute_not_exists(pk)` passes; item created with `occupancy = 1` | Transparent to user |
| Partial TransactWrite failure (DynamoDB internal error) | Entire transaction rolled back; Lambda returns `500 INTERNAL_ERROR` | Error toast; no stale UI state since no optimistic updates are used |
| Member submits form twice (double-click) | Second request receives `409 OVERLAP_CONFLICT` (member already has CONFIRMED reservation in that slot after first succeeds) | "Confirmar Reserva" button disabled on first click; re-enabled on error |
