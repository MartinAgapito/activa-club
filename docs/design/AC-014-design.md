# AC-014 Design: Member Reservation List

**Epic:** EP-02 - Reservas
**Story Points:** 3
**Priority:** High
**Status:** Design — Ready for Implementation
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-18
**Depends on:** AC-012 (reservations to display), AC-013 (cancel action entry point)

---

## 1. Overview

AC-014 exposes a paginated read endpoint for a member's own reservations and provides the corresponding frontend view. The response is split into two logical views: "upcoming" (status `CONFIRMED`) and "history" (status `CANCELLED` or `EXPIRED`). The weekly quota is included inline in the response to avoid a second API call from the frontend.

No write operations occur in this story. The endpoint is read-only and scoped entirely to the authenticated member's own records via `GSI_Member`.

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-dev` | New query handler | `list-member-reservations.query.ts` |

**Tables read (no writes):**

| Table | Purpose |
|-------|---------|
| `ReservationsTable` | Query `GSI_Member` filtered by `member_id` |
| `MembersTable` | Fetch `weekly_reservation_count`, `weekly_reset_at`, `membership_type`, `account_status` |

---

## 3. API Contract

### GET /v1/reservations/me

**Auth:** Member only — Cognito JWT Authorizer.

**Query Parameters:**

| Parameter | Required | Default | Allowed values | Description |
|-----------|----------|---------|----------------|-------------|
| `view` | No | `upcoming` | `upcoming`, `history` | `upcoming` = CONFIRMED only; `history` = CANCELLED + EXPIRED |
| `limit` | No | `20` | 1–50 | Page size |
| `lastKey` | No | null | Base64 string | Pagination cursor (DynamoDB `LastEvaluatedKey`, base64-encoded) |

**Success Response — HTTP 200:**

```json
{
  "weeklyQuota": {
    "used": 1,
    "limit": 3,
    "resetsAt": "2026-04-21T00:00:00Z"
  },
  "membershipStatus": "active",
  "items": [
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
  ],
  "lastKey": null
}
```

`lastKey` is `null` when there are no more pages.

`weeklyQuota.limit` is derived from the member's `membership_type` (Silver: 2, Gold: 3, VIP: 5).

`membershipStatus` is included so the frontend can show a warning banner if the member's account is not `active`.

**Empty response (no reservations):**

```json
{
  "weeklyQuota": { "used": 0, "limit": 3, "resetsAt": "2026-04-21T00:00:00Z" },
  "membershipStatus": "active",
  "items": [],
  "lastKey": null
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400  | `INVALID_VIEW` | `view` is not `upcoming` or `history` |
| 400  | `INVALID_LIMIT` | `limit` is not a positive integer between 1 and 50 |
| 400  | `INVALID_CURSOR` | `lastKey` is not a valid base64-encoded DynamoDB cursor |

Note: A member with an inactive membership is still allowed to call this endpoint and view their reservation history. The `403 MEMBERSHIP_INACTIVE` guard does NOT apply here (unlike AC-011 and AC-012). The Lambda returns the full list with `membershipStatus: "suspended"` so the frontend can render the appropriate warning.

**Common error envelope:**

```json
{
  "status": 400,
  "error": {
    "code": "INVALID_VIEW",
    "message": "El parámetro 'view' debe ser 'upcoming' o 'history'."
  }
}
```

---

## 4. DynamoDB Design

### 4.1 ReservationsTable — GSI_Member

**Query pattern for `view=upcoming`:**

```
Query GSI_Member:
  KeyConditionExpression: member_id = :memberId
  FilterExpression: #status = :confirmed
  ScanIndexForward: true  (ascending created_at → upcoming first)
  Limit: <requested limit>
  ExclusiveStartKey: <decoded lastKey if provided>
```

`FilterExpression` does not reduce RCU cost (DynamoDB filters after reading), but at MVP scale the number of reservations per member is small (max 5/week × 52 weeks = ~260 lifetime items). Pagination keeps each read bounded.

**Query pattern for `view=history`:**

```
Query GSI_Member:
  KeyConditionExpression: member_id = :memberId
  FilterExpression: #status IN (:cancelled, :expired)
  ScanIndexForward: false  (descending created_at → most recent first)
  Limit: <requested limit>
  ExclusiveStartKey: <decoded lastKey if provided>
```

#### GSI_Member

| Property | Value |
|----------|-------|
| Index Name | `GSI_Member` |
| PK | `member_id` (String) |
| SK | `created_at` (String — ISO-8601, lexicographic sort works correctly) |
| Projection | `ALL` |

All reservation attributes are projected (`ALL`) to avoid additional GetItem calls per result item.

### 4.2 MembersTable — weekly quota

**GetItem by member pk:**

```
GetItem MembersTable:
  Key: { pk: MEMBER#<memberId>, sk: PROFILE }
  ProjectionExpression: membership_type, account_status, weekly_reservation_count, weekly_reset_at
```

The Lambda checks `weekly_reset_at`:
- If `now >= weekly_reset_at`: the counter is stale from a prior week. Report `used = 0` in the response (the Lambda does NOT reset the counter here — the reset happens on the next write in AC-012 or AC-013). The frontend will still show the correct quota state.

---

## 5. Authorization Rules

| Role | Access | Notes |
|------|--------|-------|
| Member | Own reservations only | `member_id` extracted from Cognito `sub` + `GSI_CognitoSub` lookup; never exposes other members' reservations |
| Manager | No access to this endpoint | Manager has a separate calendar endpoint (AC-015) |
| Admin | No access to this endpoint | Admin views all reservations from the admin dashboard (separate story) |

The Lambda enforces member scoping by always passing `member_id = <authenticated member's id>` as the `KeyConditionExpression` key. No user-supplied `memberId` parameter is accepted.

---

## 6. Terraform Changes

### 6.1 API Gateway Route (new)

```hcl
resource "aws_apigatewayv2_route" "get_my_reservations" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /v1/reservations/me"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}
```

No new DynamoDB tables or indexes required beyond those introduced in AC-012.

### 6.2 IAM Policy

Covered by the policy defined in AC-012-design.md section 6.5 (`dynamodb:Query` on `ReservationsTable/index/*` and `dynamodb:GetItem` on `MembersTable`).

---

## 7. Frontend Changes

### 7.1 New Page

**Route:** `/reservations`
**Component:** `ReservationsPage`
**Access:** Member only (`MemberGuard`)

**Layout:**
1. **Weekly quota badge** (`WeeklyQuotaBadge`) — top of page, always visible.
2. **Membership inactive banner** — conditional; shown when `membershipStatus != active`.
3. **Tabs** (`Shadcn/ui Tabs`):
   - "Próximas" tab — queries `?view=upcoming`
   - "Historial" tab — queries `?view=history`
4. **Empty state** for each tab:
   - "Próximas" empty: "No tenés reservas próximas. ¿Querés hacer una?" + link to `/reservations/new`.
   - "Historial" empty: "Todavía no tenés reservas pasadas."
5. **"Nueva reserva" button** — top-right shortcut to `/reservations/new`.

### 7.2 ReservationCard Component

```typescript
interface ReservationCardProps {
  reservation: ReservationItem;
  onCancelClick?: (reservation: ReservationItem) => void;
}
```

**Card content:**
- Area name (bold)
- Date — formatted as `DD/MM/YYYY`
- Time range — `09:00 - 10:00`
- Status badge (`Shadcn/ui Badge`): green for CONFIRMED, gray for EXPIRED, red for CANCELLED
- "Cancelar reserva" button — only rendered when `status = CONFIRMED` AND `canCancelUntil > now` (pre-computed from `startDatetime - 2h`)

### 7.3 React Query Hooks

```typescript
const QUERY_KEY_UPCOMING = ['my-reservations', 'upcoming'];
const QUERY_KEY_HISTORY  = ['my-reservations', 'history'];

function useMyReservations(view: 'upcoming' | 'history') {
  return useInfiniteQuery({
    queryKey: view === 'upcoming' ? QUERY_KEY_UPCOMING : QUERY_KEY_HISTORY,
    queryFn: ({ pageParam }) =>
      api.get('/v1/reservations/me', {
        params: { view, limit: 20, lastKey: pageParam ?? undefined }
      }),
    getNextPageParam: (lastPage) => lastPage.lastKey ?? undefined,
    staleTime: 60_000, // 1 minute
  });
}
```

**Invalidation triggers:**
- `createReservation` mutation success (AC-012) → invalidate `QUERY_KEY_UPCOMING`
- `cancelReservation` mutation success (AC-013) → invalidate both keys

### 7.4 Infinite Scroll / Load More

For the history tab, a "Cargar más" button at the bottom of the list calls `fetchNextPage()` from `useInfiniteQuery`. The upcoming tab typically has few items (max 5 for VIP) so pagination is rarely triggered.

---

## 8. Edge Cases and Validations

| Scenario | Backend Behavior | Frontend Behavior |
|----------|-----------------|-------------------|
| Member has no upcoming reservations | `items = []`, `lastKey = null` | Empty state with CTA to create a reservation |
| Member's membership is expired | `membershipStatus = suspended` returned; history still accessible | Banner: "Tu membresía está inactiva. Regularizá tu situación para crear nuevas reservas." Create button hidden. |
| Member has 50+ history items | Pagination via `lastKey` cursor | "Cargar más" button; first 20 loaded initially |
| Weekly counter stale (week has passed, no reset yet) | Lambda detects `now >= weekly_reset_at`, returns `used = 0` in the response — does NOT write the reset | Badge shows "0 de N reservas usadas"; correct behavior |
| Member navigates back from creating a reservation | `useInfiniteQuery` cache invalidated by `createReservation` mutation; fresh data fetched | New reservation appears at top of "Próximas" list without page reload |
| `lastKey` parameter is tampered with by the client | DynamoDB rejects invalid cursor with an error → `400 INVALID_CURSOR` | Error toast |
| Member with `view=upcoming` and all reservations are CANCELLED/EXPIRED | FilterExpression matches nothing; `items = []` | Empty state rendered correctly |
