# AC-015 Design: Manager Reservation Dashboard

**Epic:** EP-02 - Reservas
**Story Points:** 5
**Priority:** High
**Status:** Design — Ready for Implementation
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-18
**Depends on:** AC-012 (reservations to view/cancel), AC-013 (cancel logic reused), AC-009 (Manager redirect after login)

---

## 1. Overview

AC-015 exposes four Manager/Admin-only operations: (1) query the daily reservation calendar per area, (2) cancel any CONFIRMED reservation with a mandatory reason, (3) create an area block (with optional force-cancel of conflicting reservations), and (4) delete an existing block. All write operations that affect reservations apply the same slot occupancy and weekly counter adjustments as AC-013, with the additional requirement that Managers are not subject to the 2-hour cancellation window.

The calendar response is assembled by combining `ReservationsTable` (via `GSI_AreaDate`) and `AreaBlocksTable` (via `GSI_AreaDateBlocks`) in a single Lambda handler, producing a structured grid suitable for the frontend calendar component.

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-dev` | New command + query handlers | `cancel-reservation-manager.command.ts`, `create-area-block.command.ts`, `delete-area-block.command.ts`, `get-manager-calendar.query.ts` |

**Tables written:**

| Table | Operations |
|-------|-----------|
| `ReservationsTable` | UpdateItem — set `status = CANCELLED` (manager cancel + force-cancel on block creation) |
| `SlotOccupancyTable` | UpdateItem — decrement `occupancy` (on each cancellation) |
| `MembersTable` | UpdateItem — decrement `weekly_reservation_count` (on each cancellation) |
| `AreaBlocksTable` | PutItem — create block; UpdateItem — set `is_active = false` on delete |

**Tables read:**

| Table | Purpose |
|-------|---------|
| `ReservationsTable` | GSI_AreaDate — list all reservations for an area on a date |
| `AreaBlocksTable` | GSI_AreaDateBlocks — list active blocks for an area on a date |
| `AreasTable` | Validate area existence; fetch capacity and schedule |

---

## 3. API Contract

All endpoints require `Authorization: Bearer <AccessToken>` with Cognito group `Manager` or `Admin`. API Gateway passes the token to the Lambda; the Lambda verifies the `cognito:groups` claim.

### 3.1 GET /v1/manager/reservations

**Auth:** Manager, Admin

**Query Parameters:**

| Parameter | Required | Format | Description |
|-----------|----------|--------|-------------|
| `date` | Yes | `YYYY-MM-DD` | Day to display in the calendar |
| `areaId` | No | ULID | Filter to a specific area (omit for all areas) |

**Date window:** Manager can query any date in the current month + next month. No restriction to 7-day window.

**Success Response — HTTP 200:**

```json
{
  "date": "2026-04-20",
  "areas": [
    {
      "areaId": "01JFAKE0000000000000000001",
      "areaName": "Cancha de Tenis",
      "capacity": 4,
      "occupancyPercentage": 62,
      "slots": [
        {
          "startTime": "09:00",
          "endTime": "10:00",
          "occupancy": 2,
          "capacity": 4,
          "blocked": false,
          "reservations": [
            {
              "reservationId": "01JFAKE0000000000000000099",
              "memberId": "01JFAKE000000000000000MBR1",
              "memberName": "Juan Pérez",
              "startTime": "09:00",
              "endTime": "10:00",
              "status": "CONFIRMED"
            }
          ]
        },
        {
          "startTime": "11:00",
          "endTime": "12:00",
          "occupancy": 0,
          "capacity": 4,
          "blocked": true,
          "blockId": "01JFAKE000000000000000BLK1",
          "blockReason": "Mantenimiento programado",
          "reservations": []
        }
      ]
    }
  ]
}
```

`occupancyPercentage` per area is computed as `sum(occupancy across slots) / (capacity × total_slots) × 100`, rounded to integer.

`memberName` is denormalized in `ReservationsTable` at creation time (AC-012). No cross-table lookup required here.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400  | `INVALID_DATE` | `date` is not a valid `YYYY-MM-DD` date |
| 403  | `FORBIDDEN` | Caller's Cognito group is not `Manager` or `Admin` |

---

### 3.2 DELETE /v1/manager/reservations/{reservationId}

**Auth:** Manager, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reservationId` | String | ULID of the reservation |

**Request Body:**

```json
{
  "reason": "Mantenimiento de emergencia en el área"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `reason` | String | Yes | 10–500 characters |

**Success Response — HTTP 200:**

```json
{
  "reservationId": "01JFAKE0000000000000000099",
  "message": "Reserva cancelada correctamente"
}
```

**Differences from Member cancel (AC-013):**
- No 2-hour window restriction.
- `reason` is stored in `cancel_reason` field of the reservation record.
- `cancelled_by_role = MANAGER` written to the reservation.
- Weekly counter still decremented (business rule: Manager cancel restores the member's quota).

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400  | `REASON_REQUIRED` | `reason` field is absent or shorter than 10 characters |
| 403  | `FORBIDDEN` | Caller is not Manager or Admin |
| 404  | `RESERVATION_NOT_FOUND` | `reservationId` does not exist |
| 409  | `INVALID_STATUS` | Reservation is already `CANCELLED` or `EXPIRED` |
| 500  | `INTERNAL_ERROR` | TransactWrite failed; state unchanged |

---

### 3.3 POST /v1/areas/{areaId}/blocks

**Auth:** Manager, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `areaId` | String | ULID of the area to block |

**Request Body:**

```json
{
  "date": "2026-04-20",
  "startTime": "11:00",
  "endTime": "13:00",
  "reason": "Mantenimiento programado",
  "confirmForce": false
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `date` | String | Yes | `YYYY-MM-DD` |
| `startTime` | String | Yes | `HH:MM` — must align to slot boundary |
| `endTime` | String | Yes | `HH:MM` — must be after `startTime`; must align to slot boundary |
| `reason` | String | Yes | 5–500 characters |
| `confirmForce` | Boolean | No | Default `false`; set `true` to auto-cancel conflicting reservations |

**Success Response (no conflicts or `confirmForce = true`) — HTTP 201:**

```json
{
  "blockId": "01JFAKE000000000000000BLK1",
  "areaId": "01JFAKE0000000000000000001",
  "date": "2026-04-20",
  "startTime": "11:00",
  "endTime": "13:00",
  "reason": "Mantenimiento programado",
  "createdAt": "2026-04-18T14:30:00Z"
}
```

**Conflict warning response (conflicts found, `confirmForce = false`) — HTTP 200:**

```json
{
  "conflict": true,
  "affectedReservations": [
    {
      "reservationId": "01JFAKE0000000000000000099",
      "memberId": "01JFAKE000000000000000MBR1",
      "memberName": "Juan Pérez",
      "startTime": "11:00",
      "endTime": "12:00"
    }
  ],
  "message": "Existen 1 reserva(s) activas en este horario. Envíe confirmForce: true para cancelarlas y crear el bloqueo."
}
```

Block is NOT created on this response. The frontend prompts the Manager for confirmation and re-submits with `confirmForce: true`.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400  | `INVALID_BLOCK_RANGE` | `endTime <= startTime` or times outside area schedule |
| 403  | `FORBIDDEN` | Caller is not Manager or Admin |
| 404  | `AREA_NOT_FOUND` | Area does not exist or is inactive |
| 409  | `BLOCK_OVERLAP` | An active block already overlaps (part of) the requested range |

---

### 3.4 DELETE /v1/areas/{areaId}/blocks/{blockId}

**Auth:** Manager, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `areaId` | String | ULID of the area |
| `blockId` | String | ULID of the block to delete |

**No request body.**

**Success Response — HTTP 200:**

```json
{
  "blockId": "01JFAKE000000000000000BLK1",
  "message": "Bloqueo eliminado correctamente"
}
```

The block is soft-deleted: `is_active` is set to `false` rather than a physical delete. This preserves the audit history.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403  | `FORBIDDEN` | Caller is not Manager or Admin |
| 404  | `BLOCK_NOT_FOUND` | `blockId` does not exist or `is_active = false` already |

---

## 4. DynamoDB Design

### 4.1 AreaBlocksTable (new table)

| Property | Value |
|----------|-------|
| Table Name | `AreaBlocksTable` |
| PK | `pk` — `BLOCK#<blockId>` |
| SK | `sk` — `AREA#<areaId>` |
| Billing Mode | PAY_PER_REQUEST |

**Attributes:**

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `pk` | String | Yes | `BLOCK#<ulid>` |
| `sk` | String | Yes | `AREA#<areaId>` |
| `block_id` | String | Yes | ULID (denormalized) |
| `area_id` | String | Yes | ULID |
| `date` | String | Yes | `YYYY-MM-DD` |
| `start_time` | String | Yes | `HH:MM` |
| `end_time` | String | Yes | `HH:MM` |
| `reason` | String | Yes | Manager-provided text |
| `created_by` | String | Yes | Cognito `sub` of the creating Manager |
| `created_at` | String | Yes | ISO-8601 UTC |
| `is_active` | Boolean | Yes | `true` while block is in effect; `false` after soft delete |

**GSI_AreaDateBlocks:**

| Property | Value |
|----------|-------|
| Index Name | `GSI_AreaDateBlocks` |
| PK | `area_id` (String) |
| SK | `date` (String) |
| Projection | `ALL` |

**Purpose:** Query all blocks for a given area on a given date. Used by AC-011 (availability) and AC-015 (calendar). Filter by `is_active = true` in `FilterExpression`.

**GSI_BlockId:**

| Property | Value |
|----------|-------|
| Index Name | `GSI_BlockId` |
| PK | `block_id` (String) |
| SK | None |
| Projection | `KEYS_ONLY` |

**Purpose:** Resolve `blockId → (pk, sk)` when the delete endpoint receives only `blockId` in the path (SK `areaId` is also in the path for this endpoint, so the table key can be assembled directly without the GSI — `pk = BLOCK#<blockId>`, `sk = AREA#<areaId>`).

> The `blockId` GSI is retained for future endpoints that may receive only `blockId`.

### 4.2 ReservationsTable — GSI_AreaDate

Used by the manager calendar query:

```
Query GSI_AreaDate:
  KeyConditionExpression: area_id = :areaId AND #date = :date
  FilterExpression: #status = :confirmed
```

Returns all CONFIRMED reservations for an area on a date. The Lambda assembles these into slot buckets based on `start_time`.

### 4.3 Block-with-force-cancel TransactWrite

When `confirmForce = true` and conflicting reservations exist, a single `TransactWrite` is issued:

```
For each conflicting reservation (up to ~33; each needs 3 ops):
  a. UpdateItem ReservationsTable: SET status=CANCELLED, cancel_reason=<reason>, cancelled_by_role=MANAGER
     ConditionExpression: status = :confirmed
  b. UpdateItem SlotOccupancyTable: ADD occupancy -1
     ConditionExpression: occupancy > :zero
  c. UpdateItem MembersTable: ADD weekly_reservation_count -1
     ConditionExpression: weekly_reservation_count > :zero

PutItem AreaBlocksTable: new block record
```

DynamoDB `TransactWrite` limit is 100 items. With 3 ops per reservation + 1 for block = max 33 reservations per TransactWrite. For MVP slot capacity (typically 4–10 members per slot), this limit is not a concern.

---

## 5. Authorization Rules

| Role | GET calendar | DELETE reservation (Manager path) | POST block | DELETE block |
|------|-------------|----------------------------------|-----------|-------------|
| Member | No | No | No | No |
| Manager | Yes | Yes (any CONFIRMED reservation; no 2h window; reason required) | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes |

**Enforcement:** API Gateway Cognito JWT Authorizer validates the token. The Lambda extracts `cognito:groups` from the authorizer context and returns `403 FORBIDDEN` if the group is `Member` or if the claim is absent.

Note: The `DELETE /v1/reservations/{reservationId}` route (AC-013, Member path) and `DELETE /v1/manager/reservations/{reservationId}` (Manager path) are **different routes** with different Lambda handler paths. This avoids complex branching on a single route; each route maps to its own controller method.

---

## 6. Terraform Changes

### 6.1 New API Gateway Routes

```hcl
# Manager calendar
resource "aws_apigatewayv2_route" "manager_get_reservations" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /v1/manager/reservations"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}

# Manager cancel reservation
resource "aws_apigatewayv2_route" "manager_delete_reservation" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /v1/manager/reservations/{reservationId}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}

# Create area block
resource "aws_apigatewayv2_route" "post_area_block" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /v1/areas/{areaId}/blocks"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}

# Delete area block
resource "aws_apigatewayv2_route" "delete_area_block" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /v1/areas/{areaId}/blocks/{blockId}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}
```

### 6.2 New DynamoDB Table: AreaBlocksTable

File: `infrastructure/modules/dynamodb/main.tf`

```hcl
resource "aws_dynamodb_table" "area_blocks" {
  name         = "AreaBlocksTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute { name = "pk"       type = "S" }
  attribute { name = "sk"       type = "S" }
  attribute { name = "area_id"  type = "S" }
  attribute { name = "date"     type = "S" }
  attribute { name = "block_id" type = "S" }

  global_secondary_index {
    name            = "GSI_AreaDateBlocks"
    hash_key        = "area_id"
    range_key       = "date"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI_BlockId"
    hash_key        = "block_id"
    projection_type = "KEYS_ONLY"
  }

  tags = {
    Environment = var.environment
    Service     = "reservations"
  }
}
```

### 6.3 IAM Policy additions for `activa-club-reservations-dev`

Add `AreaBlocksTable` access to the Lambda's inline policy:

```hcl
{
  Effect = "Allow"
  Action = [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:TransactWriteItems"
  ]
  Resource = [
    "arn:aws:dynamodb:*:*:table/AreaBlocksTable",
    "arn:aws:dynamodb:*:*:table/AreaBlocksTable/index/*"
  ]
}
```

---

## 7. Frontend Changes

### 7.1 New Page

**Route:** `/manager/calendar`
**Component:** `ManagerCalendarPage`
**Access:** Manager, Admin only (`ManagerGuard`)

**Layout:**
1. **Date navigation bar** — "Anterior" / "Siguiente" day buttons + date picker. Manager date range: current month + next month.
2. **Area occupancy summary** — row of cards, one per area, showing `areaName` + `occupancyPercentage%` badge.
3. **`ManagerCalendarGrid`** — main grid: areas as columns, hourly slots (09:00–22:00) as rows. Each cell shows occupancy state and allows actions.

### 7.2 ManagerCalendarGrid Component

```typescript
interface ManagerCalendarGridProps {
  date: string;
  data: ManagerCalendarResponse;
  onCancelReservation: (reservationId: string) => void;
  onBlockSlot: (areaId: string, startTime: string, endTime: string) => void;
  onUnblockSlot: (areaId: string, blockId: string) => void;
}
```

Each cell renders:
- Available slot (occupancy < capacity, not blocked): green background, occupancy count, "Bloquear" action.
- Full slot: red background, list of member names.
- Blocked slot: gray background, "BLOQUEADO" label, block reason, "Desbloquear" action.
- Each reservation in a slot has a "Cancelar" action.

### 7.3 BlockSlotModal Component

Triggered by "Bloquear" action on a slot cell.

```typescript
interface BlockSlotModalProps {
  areaId: string;
  date: string;
  defaultStartTime: string;
  onClose: () => void;
}
```

Fields:
- Start time (pre-filled from clicked cell, editable)
- End time (dropdown: 1h/2h/3h increments)
- Reason (textarea, min 5 chars)
- "Crear bloqueo" button

**Conflict flow:**
1. API returns `HTTP 200 { conflict: true, affectedReservations: [...] }`.
2. Modal shows: "Este horario tiene N reserva(s) activa(s): [list]. ¿Querés cancelarlas y crear el bloqueo?"
3. "Confirmar y bloquear" button re-submits with `confirmForce: true`.

### 7.4 ManagerCancelModal Component

```typescript
interface ManagerCancelModalProps {
  reservation: ReservationSummary;
  onClose: () => void;
}
```

Fields:
- Read-only summary: member name, area, date, time.
- "Motivo" textarea (required, min 10 chars).
- "Cancelar reserva" button.

### 7.5 React Query Hooks

```typescript
// Calendar query
const QUERY_KEY = (date: string, areaId?: string) =>
  ['manager-calendar', date, areaId ?? 'all'];

function useManagerCalendar(date: string, areaId?: string) {
  return useQuery({
    queryKey: QUERY_KEY(date, areaId),
    queryFn: () =>
      api.get('/v1/manager/reservations', { params: { date, areaId } }),
    refetchInterval: 60_000, // poll every 60 seconds for real-time updates
    staleTime: 30_000,
  });
}

// Block creation mutation
function useCreateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ areaId, ...body }: CreateBlockDto & { areaId: string }) =>
      api.post(`/v1/areas/${areaId}/blocks`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['area-availability'] });
    }
  });
}

// Manager cancel mutation
function useManagerCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, reason }: { reservationId: string; reason: string }) =>
      api.delete(`/v1/manager/reservations/${reservationId}`, { data: { reason } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-calendar'] });
    }
  });
}
```

---

## 8. Edge Cases and Validations

| Scenario | Backend Behavior | Frontend Behavior |
|----------|-----------------|-------------------|
| Manager blocks a slot with 0 active reservations | `confirmForce` ignored; block created immediately with HTTP 201 | No conflict modal shown; success toast |
| Manager blocks a slot with 1 active reservation, `confirmForce = false` | HTTP 200 with `conflict: true` and affected reservations | Conflict modal shown with member names |
| Manager blocks a slot with 1 active reservation, `confirmForce = true` | TransactWrite: cancel reservation + create block atomically | Success toast; calendar grid refreshes |
| Manager tries to block an already-blocked slot | `409 BLOCK_OVERLAP` | Error toast: "Este horario ya tiene un bloqueo activo." |
| Manager cancels a reservation that expired between calendar load and action | `409 INVALID_STATUS` (status = EXPIRED) | Error toast: "Esta reserva ya finalizó." Calendar refetched. |
| Block creation fails mid-TransactWrite (e.g., DynamoDB error during force-cancel) | Entire transaction rolled back; no reservation cancelled, no block created | Error toast: "No se pudo crear el bloqueo. Intentá nuevamente." |
| Manager queries a date 2 months ahead | `400 INVALID_DATE` — beyond current month + next month | Date picker constrained to allowed range client-side |
| Calendar polled at 60-second interval while block is being created | Between API call and next poll, the grid may briefly show stale data | Immediate invalidation via React Query after mutation ensures fresh data |
| `reason` field missing on Manager cancel | `400 REASON_REQUIRED` | Form validation prevents submission without reason |
| Force-cancel affects more than 33 reservations in a single slot | TransactWrite would exceed 100-item limit. Lambda must detect this and batch cancellations across multiple sequential TransactWrites (non-atomic across batches). Log a warning. At MVP scale (typical capacity 4–10/slot) this is not expected. | Error toast if batching fails; partial state possible |
