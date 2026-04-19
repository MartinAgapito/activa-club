# AC-013 Design: Member Reservation Cancellation

**Epic:** EP-02 - Reservas
**Story Points:** 3
**Priority:** High
**Status:** Design — Ready for Implementation
**Author:** Senior Software & Cloud Architect
**Date:** 2026-04-18
**Depends on:** AC-012 (reservations to cancel), AC-014 (entry point UI)

---

## 1. Overview

AC-013 allows an authenticated Member to cancel one of their own `CONFIRMED` reservations, subject to a 2-hour pre-start window. A successful cancellation: (1) sets the reservation `status` to `CANCELLED`, (2) decrements the slot occupancy counter in `SlotOccupancyTable`, and (3) decrements the member's `weekly_reservation_count` in `MembersTable`. All three writes are atomic via `TransactWrite`.

The same Lambda handler is reused by AC-015 Manager cancellation with different authorization logic and without the 2-hour window restriction. This design documents only the Member path.

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-dev` | New command handler | `cancel-reservation.command.ts` (Member path) |

**Tables written:**

| Table | Operation |
|-------|-----------|
| `ReservationsTable` | `UpdateItem` — set `status = CANCELLED`, `cancelled_by_role = MEMBER`, `updated_at` |
| `SlotOccupancyTable` | `UpdateItem` — decrement `occupancy` |
| `MembersTable` | `UpdateItem` — decrement `weekly_reservation_count` |

**Tables read:**

| Table | Purpose |
|-------|---------|
| `ReservationsTable` | Resolve pk+sk via `GSI_ReservationId`; fetch full record to verify ownership and status |

---

## 3. API Contract

### DELETE /v1/reservations/{reservationId}

**Auth:** Member (own reservation only), Manager, Admin.

This endpoint handles both Member self-cancellation (this story) and Manager cancellation (AC-015). The Lambda distinguishes the caller's Cognito group to apply different business rules.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reservationId` | String | ULID of the reservation to cancel |

**No request body** for the Member path.

For the Manager path (AC-015), a `reason` field is required in the request body — see AC-015-design.md.

**Success Response — HTTP 200:**

```json
{
  "reservationId": "01JFAKE0000000000000000099",
  "message": "Reserva cancelada correctamente"
}
```

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403  | `FORBIDDEN` | Caller is `Member` and `reservation.member_id != cognito_sub` |
| 404  | `RESERVATION_NOT_FOUND` | `reservationId` does not exist in `ReservationsTable` |
| 409  | `CANCELLATION_WINDOW_CLOSED` | `now >= startDatetime - 2 hours` (Member path only; Managers bypass this check) |
| 409  | `INVALID_STATUS` | Reservation `status` is already `CANCELLED` or `EXPIRED` |
| 500  | `INTERNAL_ERROR` | `TransactWrite` failed; reservation state unchanged |

**Common error envelope:**

```json
{
  "status": 409,
  "error": {
    "code": "CANCELLATION_WINDOW_CLOSED",
    "message": "No podés cancelar una reserva con menos de 2 horas de anticipación."
  }
}
```

---

## 4. DynamoDB Design

### 4.1 ReservationsTable — read then write

**Step 1 — Resolve pk + sk from reservationId:**

The path parameter only contains `reservationId`. The table PK is `RESERVATION#<id>` but SK is `MEMBER#<memberId>`, which the caller does not provide. The Lambda queries `GSI_ReservationId` (PK: `reservation_id`, KEYS_ONLY projection) to retrieve `pk` and `sk`.

```
Query GSI_ReservationId:
  KeyConditionExpression: reservation_id = :id
  ProjectionExpression: pk, sk
```

**Step 2 — GetItem full record:**

```
GetItem: { pk, sk }
```

This returns all attributes needed for authorization and validation: `member_id`, `status`, `date`, `start_time`, `area_id`.

**Step 3 — TransactWrite (3 operations):**

```
a. UpdateItem ReservationsTable
   Key: { pk, sk }
   UpdateExpression: SET status = :cancelled,
                         cancelled_by_role = :member,
                         updated_at = :now
   ConditionExpression: status = :confirmed
   ← idempotency guard: fails if already cancelled/expired

b. UpdateItem SlotOccupancyTable
   Key: { pk: SLOT#<areaId>#<date>#<startTime> }
   UpdateExpression: ADD occupancy :minusOne
   ConditionExpression: occupancy > :zero
   ← prevents underflow

c. UpdateItem MembersTable
   Key: { pk: MEMBER#<memberId>, sk: PROFILE }
   UpdateExpression: ADD weekly_reservation_count :minusOne
   ConditionExpression: weekly_reservation_count > :zero
```

**For multi-slot reservations (duration > 60 min):** The TransactWrite includes one UpdateItem per covered slot in `SlotOccupancyTable`. For a 2-hour Gold reservation covering `09:00` and `10:00`, both slot items are decremented.

### 4.2 GSI_ReservationId (on ReservationsTable)

| Property | Value |
|----------|-------|
| Index Name | `GSI_ReservationId` |
| PK | `reservation_id` (String) |
| SK | None |
| Projection | `KEYS_ONLY` |

This index is shared by AC-013 Member cancel, AC-015 Manager cancel, and any other endpoint that receives only a `reservationId` path parameter.

---

## 5. Authorization Rules

| Role | Can cancel | Restrictions |
|------|------------|-------------|
| Member | Own reservations only | `reservation.member_id` must equal member's ULID derived from Cognito `sub`; 2-hour window enforced |
| Manager | Any `CONFIRMED` reservation | No 2-hour window restriction; `reason` field required (AC-015 endpoint) |
| Admin | Any `CONFIRMED` reservation | Same as Manager; uses AC-015 endpoint |

**Ownership check:** The Lambda extracts `cognito_sub` from the JWT authorizer context, resolves it to `member_id` via `GSI_CognitoSub` on `MembersTable` (already done in EP-01), and compares it to `reservation.member_id`. If they differ and the caller's group is `Member`, return `403 FORBIDDEN` without revealing any reservation details.

**2-hour window check:**

```typescript
const startDatetime = DateTime.fromISO(`${reservation.date}T${reservation.start_time}:00`, { zone: 'UTC' });
const now = DateTime.utc();
if (now >= startDatetime.minus({ hours: 2 })) {
  throw new CancellationWindowClosedError();
}
```

---

## 6. Terraform Changes

### 6.1 API Gateway Route (new)

```hcl
resource "aws_apigatewayv2_route" "delete_reservation" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /v1/reservations/{reservationId}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.reservations.id}"
}
```

### 6.2 IAM Policy additions for `activa-club-reservations-dev`

No new tables or indexes beyond what AC-012 already introduced. The cancel command accesses:

- `ReservationsTable` (UpdateItem + Query GSI_ReservationId)
- `SlotOccupancyTable` (UpdateItem)
- `MembersTable` (UpdateItem)

All already covered by the IAM policy defined in AC-012-design.md section 6.5.

---

## 7. Frontend Changes

### 7.1 Cancel Button in ReservationCard

The `ReservationCard` component (introduced in AC-014) renders a "Cancelar reserva" button for each reservation with `status = CONFIRMED`. The button is only shown if the reservation's `startDatetime > now + 2 hours` (pre-computed client-side to avoid unnecessary API calls).

### 7.2 CancelReservationModal Component

```typescript
interface CancelReservationModalProps {
  reservation: ReservationSummary;
  onClose: () => void;
}
```

Content:
- Summary: area name, date, start time, end time.
- Warning text: "Al cancelar, se liberará el cupo y se restará una reserva de tu cuota semanal."
- Two buttons: "Volver" (dismiss) and "Confirmar cancelación" (trigger mutation).

Modal is built with `Shadcn/ui Dialog`.

### 7.3 React Query Mutation

```typescript
function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      api.delete(`/v1/reservations/${reservationId}`),
    onSuccess: (_, reservationId) => {
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      // Invalidate availability for the cancelled reservation's area+date
      // The area+date is available from the reservation data cached in ['my-reservations']
      queryClient.invalidateQueries({ queryKey: ['area-availability'] });
      toast.success('Reserva cancelada correctamente.');
    },
    onError: (error) => {
      toast.error(mapCancellationError(error));
    }
  });
}
```

**Error code mapping (client-side):**

| Code | Spanish message |
|------|----------------|
| `CANCELLATION_WINDOW_CLOSED` | "No podés cancelar con menos de 2 horas de anticipación." |
| `INVALID_STATUS` | "Esta reserva ya fue cancelada o finalizada." |
| `FORBIDDEN` | "No tenés permiso para cancelar esta reserva." |
| `RESERVATION_NOT_FOUND` | "No se encontró la reserva. Es posible que ya haya sido cancelada." |

---

## 8. Edge Cases and Validations

| Scenario | Backend Behavior | Frontend Behavior |
|----------|-----------------|-------------------|
| Member cancels exactly at the 2-hour mark (boundary) | `CANCELLATION_WINDOW_CLOSED` — the check is `>=`, so cancelling at exactly `startTime - 2h` is rejected | Cancel button hidden when within 2h window (client-side pre-check) |
| Member clicks cancel twice (double submit) | Second DELETE receives `409 INVALID_STATUS` (reservation already `CANCELLED`); idempotent from user perspective | Modal closes on first success; button disabled during mutation |
| Reservation already expired (AC-016 ran between view load and cancel click) | `409 INVALID_STATUS` — status is `EXPIRED` | Error toast: "Esta reserva ya finalizó." |
| TransactWrite fails for the slot decrement (occupancy already 0) | `TransactionCanceledException` on slot condition → `500 INTERNAL_ERROR` (should not normally occur; occupancy > 0 is expected for a CONFIRMED reservation) | Error toast; reservation state unchanged |
| Multi-slot cancellation (2-hour Gold reservation) | Two slot decrements in TransactWrite; if either fails, entire transaction rolls back | Same as single-slot; transparent to user |
| Member's `weekly_reservation_count` is 0 (edge case after data corruption) | Condition `weekly_reservation_count > 0` fails for member UpdateItem → transaction cancels → log error → `500 INTERNAL_ERROR`. The Lambda should treat this as a non-critical data inconsistency and log a warning, then retry without the count decrement condition if count is already 0 (graceful degradation) | Error toast |
| Timezone edge case: club operates in UTC-3, reservation `date=2026-04-20, startTime=09:00` | The 2-hour window check uses `startTime` interpreted as club-local time. Recommend `CLUB_TIMEZONE` env var (see EP-02 Open Question #4) to compute correct UTC comparison | No frontend impact |
