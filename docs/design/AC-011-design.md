# AC-011 Design: Area Availability Query

**Epic:** EP-02 - Reservas
**Story Points:** 3
**Priority:** High
**Status:** Design — Ready for Implementation
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-18
**Depends on:** AC-005, AC-006 (authenticated session), AC-012 (downstream consumer)

---

## 1. Overview

AC-011 exposes a read-only endpoint that returns the hourly slot availability for a specific area on a given date. The response is filtered by the requesting member's membership type (area access rules) and includes real-time occupancy computed from `SlotOccupancyTable` plus active blocks from `AreaBlocksTable`. No write operations occur. The endpoint also returns the member's current weekly quota status as an informational banner.

Key design decision: occupancy is maintained in a dedicated `SlotOccupancyTable` (one item per slot), so the availability query costs a `BatchGetItem` (up to 13 items for a full 09:00–22:00 day) rather than a scan of `ReservationsTable`. This keeps the endpoint at O(1) per slot regardless of total reservations in the system.

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-dev` | New query handler | `get-area-availability.query.ts` |

**Tables read (no writes):**

| Table | Purpose |
|-------|---------|
| `AreasTable` | Fetch area config: capacity, `allowed_memberships`, opening/closing time |
| `SlotOccupancyTable` | `BatchGetItem` all slot PKs for the requested date |
| `AreaBlocksTable` | Query `GSI_AreaDateBlocks` for active blocks on that date |
| `MembersTable` | Fetch `membership_type`, `account_status`, `weekly_reservation_count`, `weekly_reset_at` |

---

## 3. API Contract

### GET /v1/areas/{areaId}/availability

**Auth:** Member, Manager, Admin — Cognito JWT Authorizer required.

**Path Parameters:**

| Parameter | Type   | Description      |
|-----------|--------|------------------|
| `areaId`  | String | ULID of the area |

**Query Parameters:**

| Parameter | Required | Format       | Description              |
|-----------|----------|--------------|--------------------------|
| `date`    | Yes      | `YYYY-MM-DD` | The date to query        |

**Success Response — HTTP 200:**

```json
{
  "areaId": "01JFAKE0000000000000000001",
  "areaName": "Cancha de Tenis",
  "date": "2026-04-20",
  "capacity": 4,
  "weeklyQuotaInfo": {
    "used": 1,
    "limit": 3,
    "exhausted": false,
    "resetsAt": "2026-04-20T00:00:00Z"
  },
  "slots": [
    {
      "startTime": "09:00",
      "endTime": "10:00",
      "available": 3,
      "total": 4,
      "status": "AVAILABLE",
      "blocked": false
    },
    {
      "startTime": "10:00",
      "endTime": "11:00",
      "available": 0,
      "total": 4,
      "status": "FULL",
      "blocked": false
    },
    {
      "startTime": "11:00",
      "endTime": "12:00",
      "available": 0,
      "total": 4,
      "status": "BLOCKED",
      "blocked": true
    }
  ]
}
```

**Slot `status` rules:**

| Condition | Status |
|-----------|--------|
| `blocked = true` (active `AreaBlocksTable` record covering the slot) | `BLOCKED` |
| `blocked = false` AND `available > 0` | `AVAILABLE` |
| `blocked = false` AND `available == 0` | `FULL` |

`weeklyQuotaInfo` is omitted from responses when the caller's Cognito group is `Manager` or `Admin`.

For slots with no `SlotOccupancyTable` record (no booking ever made), `occupancy = 0` is assumed and `available = capacity`.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400  | `INVALID_DATE_FORMAT` | `date` param is not `YYYY-MM-DD` |
| 400  | `DATE_IN_PAST` | `date` is before today (UTC) |
| 400  | `DATE_EXCEEDS_WINDOW` | Caller is `Member` and `date > today + 7 days` |
| 403  | `MEMBERSHIP_INACTIVE` | Member `account_status != active` |
| 403  | `AREA_NOT_ACCESSIBLE` | Area's `allowed_memberships` does not include member's `membership_type` |
| 404  | `AREA_NOT_FOUND` | `areaId` does not exist or area `status = Inactive` |

**Common error envelope:**

```json
{
  "status": 403,
  "error": {
    "code": "AREA_NOT_ACCESSIBLE",
    "message": "No tenés acceso a esta área con tu tipo de membresía."
  }
}
```

---

## 4. DynamoDB Design

### 4.1 AreasTable (read-only in this story)

The query reads the area item by its primary key.

| Key | Value |
|-----|-------|
| PK  | `AREA#<areaId>` |
| SK  | `METADATA` |

**Attributes consumed:**

| Attribute | Use |
|-----------|-----|
| `area_name` | Denormalized in response |
| `capacity` | Total slots per time block |
| `allowed_memberships` | List — e.g., `["Silver", "Gold", "VIP"]` |
| `opening_time` | `HH:MM` — first slot start |
| `closing_time` | `HH:MM` — last slot end |
| `status` | Must be `Active` |

### 4.2 SlotOccupancyTable

| Key | Value |
|-----|-------|
| PK  | `SLOT#<areaId>#<date>#<startTime>` — e.g., `SLOT#01J...#2026-04-20#09:00` |

**Access pattern:** `BatchGetItem` with all slot PKs for the requested date. The Lambda builds the list of PKs by iterating from `opening_time` to `closing_time - 1h` in 60-minute steps.

Missing items (no PK found) are treated as `occupancy = 0`.

### 4.3 AreaBlocksTable

| Key | Value |
|-----|-------|
| PK  | `BLOCK#<blockId>` |
| SK  | `AREA#<areaId>` |

**Access pattern for AC-011:** Query `GSI_AreaDateBlocks` where `area_id = <areaId>` AND `date = <date>`. Filter by `is_active = true`.

A block covers one or more consecutive hourly slots. The Lambda checks each slot's `startTime` against every block's `[start_time, end_time)` range to determine coverage.

#### GSI_AreaDateBlocks

| Property | Value |
|----------|-------|
| Index Name | `GSI_AreaDateBlocks` |
| PK | `area_id` (String) |
| SK | `date` (String) |
| Projection | `ALL` |

### 4.4 MembersTable (read-only)

**Access pattern:** Query `GSI_CognitoSub` where `cognito_user_id = <sub from JWT>` to get the member's profile.

**Attributes consumed:**

| Attribute | Use |
|-----------|-----|
| `membership_type` | Determine accessible areas and weekly limit |
| `account_status` | Must be `active` |
| `weekly_reservation_count` | Current week usage |
| `weekly_reset_at` | ISO-8601 of next Monday 00:00 UTC |

---

## 5. Authorization Rules

| Role | Can query availability | Date window | `weeklyQuotaInfo` in response |
|------|----------------------|-------------|-------------------------------|
| Member | Yes — only areas in their `allowed_memberships` | today to today+7 | Yes |
| Manager | Yes — all areas | Any date in current + next month | No |
| Admin | Yes — all areas | Any date | No |

Area access filtering for Members happens at the Lambda level after fetching the area config. If the area is not in the member's `allowed_memberships`, the Lambda returns `403 AREA_NOT_ACCESSIBLE` — it does not leak area details.

---

## 6. Terraform Changes

### 6.1 API Gateway Route (new)

File: `infrastructure/modules/api-gateway/main.tf`

```hcl
resource "aws_apigatewayv2_route" "get_area_availability" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /v1/areas/{areaId}/availability"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}
```

### 6.2 IAM Policy additions for `activa-club-reservations-dev`

Add to the Lambda's inline policy:

```hcl
{
  Effect = "Allow"
  Action = [
    "dynamodb:GetItem",
    "dynamodb:BatchGetItem",
    "dynamodb:Query"
  ]
  Resource = [
    "arn:aws:dynamodb:*:*:table/AreasTable",
    "arn:aws:dynamodb:*:*:table/AreasTable/index/*",
    "arn:aws:dynamodb:*:*:table/SlotOccupancyTable",
    "arn:aws:dynamodb:*:*:table/AreaBlocksTable",
    "arn:aws:dynamodb:*:*:table/AreaBlocksTable/index/*",
    "arn:aws:dynamodb:*:*:table/MembersTable",
    "arn:aws:dynamodb:*:*:table/MembersTable/index/*"
  ]
}
```

No new DynamoDB tables are created by this story. `SlotOccupancyTable` and `AreaBlocksTable` are provisioned as part of AC-012 and AC-015 respectively (see EP-02-design.md section 6.1).

### 6.3 Free Tier Note

`BatchGetItem` of up to 13 items per availability call is well within DynamoDB Free Tier (25 RCUs/month). No cost risk at MVP scale.

---

## 7. Frontend Changes

### 7.1 New Page

**Route:** `/areas/:areaId/availability`
**Component:** `AreaAvailabilityPage`
**Access:** Member, Manager, Admin

**Layout:**
1. Date picker (`Shadcn/ui Calendar`) — constrained to `[today, today+7]` for Member role.
2. `SlotGrid` component — displays 09:00–22:00 in 13 hourly rows.
3. `WeeklyQuotaBadge` — shown to Member callers only.
4. CTA button "Reservar" on each `AVAILABLE` slot — navigates to `/reservations/new?areaId=&date=&startTime=`.

### 7.2 New Components

**`SlotGrid`**

```typescript
interface SlotGridProps {
  slots: SlotAvailability[];
  onSlotSelect?: (slot: SlotAvailability) => void;
}
```

Each slot rendered as a `Shadcn/ui Badge` with color coding:
- Green: `AVAILABLE`
- Red: `FULL`
- Gray: `BLOCKED` — no tooltip with reason for Member role

**`WeeklyQuotaBadge`**

```typescript
interface WeeklyQuotaBadgeProps {
  used: number;
  limit: number;
  exhausted: boolean;
}
```

Renders a `Shadcn/ui Progress` bar with text "X de Y reservas usadas esta semana". If `exhausted = true`, shows a warning banner: "Alcanzaste tu límite semanal. Podés seguir consultando disponibilidad, pero no podés crear nuevas reservas."

### 7.3 React Query Hook

```typescript
// Query key convention
const QUERY_KEY = (areaId: string, date: string) => ['area-availability', areaId, date];

function useAreaAvailability(areaId: string, date: string) {
  return useQuery({
    queryKey: QUERY_KEY(areaId, date),
    queryFn: () => api.get(`/v1/areas/${areaId}/availability?date=${date}`),
    enabled: !!areaId && !!date,
    staleTime: 30_000, // 30 seconds — availability changes frequently
  });
}
```

Invalidated by:
- `createReservation` mutation success (AC-012)
- `cancelReservation` mutation success (AC-013)
- `createBlock` / `deleteBlock` mutations (AC-015)

---

## 8. Edge Cases and Validations

| Scenario | Backend Behavior | Frontend Behavior |
|----------|-----------------|-------------------|
| Member queries with `date = today` | Allowed; past slots within today are shown but should not be selectable for reservation | Frontend disables past slots (compare startTime < now) |
| Member queries `date = today + 8` | `400 DATE_EXCEEDS_WINDOW` | Date picker max is enforced client-side; error shown if bypassed |
| Member's weekly quota exhausted | `200 OK` — `weeklyQuotaInfo.exhausted = true`; slots still show availability | `WeeklyQuotaBadge` shows warning; slot CTA buttons are disabled |
| Area has no `SlotOccupancyTable` items (never booked) | `BatchGetItem` returns empty; Lambda treats all slots as `occupancy = 0` | Shows all slots as AVAILABLE |
| Block covers multiple hours (e.g., 11:00–13:00) | Each slot in range is marked `blocked = true` in response | All covered slots rendered as BLOCKED |
| Manager queries a past date | Allowed — no date restriction for Manager | Date picker for Manager has no max constraint |
| `areaId` not in Member's `allowed_memberships` | `403 AREA_NOT_ACCESSIBLE` | Error page with message "No tenés acceso a esta área" |
| Concurrent update between two requests | Read-only endpoint; occupancy counter in `SlotOccupancyTable` may be stale by milliseconds — acceptable for availability display | `staleTime: 30s` on React Query keeps data fresh enough |
