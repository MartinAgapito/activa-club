# AC-017 Design: Admin CRUD for Recreational Areas

**Epic:** EP-06 - Admin Dashboard
**Story Points:** 5
**Priority:** High
**Status:** Implemented
**Author:** Senior Software & Cloud Architect
**Date:** 2026-05-17
**Depends on:** AC-011 (AreasTable schema finalized), AC-012 (capacity/membership rules in use)

---

## 1. Overview

AC-017 delivers full lifecycle management of recreational areas through the Admin panel. An Admin can list all areas (including inactive ones), create new areas, update their configuration, and toggle their active/inactive status — all through `activa-club-reservations-dev` (the reservations Lambda, which already owns `AreasTable` for EP-02).

The decision to route Admin area management through the reservations Lambda (rather than a dedicated admin Lambda) is intentional: the reservations Lambda already has `AreasTable` access and the `AreasDynamoRepository` implementation. Adding Admin CRUD here avoids duplicating table access and IAM policies. The Admin Lambda (`activa-club-admin-dev`) remains focused on cross-table aggregations and analytics.

Key implementation details confirmed in code:

- `AdminAreasController` with `@UseGuards(RolesGuard)` and `@Roles('Admin')` on every endpoint.
- `AreasDynamoRepository` extended with `findAll()`, `save()`, `updateStatus()`.
- DynamoDB SK is `CONFIG` (not `METADATA` as originally specced — actual implementation uses `CONFIG`).
- `capacity` field is stored as `capacity` in DynamoDB. The reserved keyword issue with `capacity` only affects `ReservationsTable` queries (see AC-012 fix below).

---

## 2. Services Impacted

| Lambda | Action | Notes |
|--------|--------|-------|
| `activa-club-reservations-dev` | New controller + handlers | `AdminAreasController`, `CreateAreaHandler`, `UpdateAreaHandler`, `ToggleAreaStatusHandler` |

**Tables written:**

| Table | Operations |
|-------|-----------|
| `AreasTable` | PutItem (create/update), UpdateItem (toggle status), Scan (list all) |

---

## 3. API Contract

All four endpoints require `Authorization: Bearer <AccessToken>` with Cognito group `Admin`. Any other group receives `403 Forbidden` from `RolesGuard`.

### 3.1 GET /v1/admin/areas

List all areas, including inactive ones. Members only see active areas via `GET /v1/areas` (served by a different route).

**Auth:** Admin only

**No query parameters.**

**Success Response — HTTP 200:**

```json
[
  {
    "areaId": "01JFAKE0000000000000000001",
    "name": "Cancha de Tenis",
    "status": "Active",
    "capacity": 4,
    "slotDuration": 60,
    "openingTime": "09:00",
    "closingTime": "22:00",
    "cancelWindowHours": 2,
    "allowedMemberships": ["Silver", "Gold", "VIP"],
    "maxDurationMinutes": { "Silver": 60, "Gold": 120, "VIP": 240 },
    "weeklyLimit": { "Silver": 2, "Gold": 3, "VIP": 5 }
  },
  {
    "areaId": "01JFAKE0000000000000000002",
    "name": "Pileta Olímpica",
    "status": "Inactive",
    ...
  }
]
```

Internally this is a DynamoDB `Scan` with `FilterExpression: sk = :sk` (`:sk = CONFIG`), paginated with `LastEvaluatedKey`.

**Error Responses:**

| HTTP | Condition |
|------|-----------|
| 403 | Caller is not Admin |

---

### 3.2 POST /v1/admin/areas

Create a new recreational area.

**Auth:** Admin only

**Request Body:**

```json
{
  "name": "Cancha de Tenis",
  "capacity": 4,
  "slotDuration": 60,
  "openingTime": "09:00",
  "closingTime": "22:00",
  "cancelWindowHours": 2,
  "allowedMemberships": ["Silver", "Gold", "VIP"],
  "maxDurationMinutes": { "Silver": 60, "Gold": 120, "VIP": 240 },
  "weeklyLimit": { "Silver": 2, "Gold": 3, "VIP": 5 }
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | String | Yes | 1–100 characters |
| `capacity` | Number | Yes | Integer >= 1 |
| `slotDuration` | Number | Yes | Minutes: 30, 60, or 90 |
| `openingTime` | String | Yes | `HH:MM` (24h) |
| `closingTime` | String | Yes | `HH:MM` (24h), must be after `openingTime` |
| `cancelWindowHours` | Number | Yes | Integer >= 0 |
| `allowedMemberships` | String[] | Yes | Subset of `["Silver", "Gold", "VIP"]`, min 1 |
| `maxDurationMinutes` | Object | Yes | Keys matching `allowedMemberships`, values > 0 |
| `weeklyLimit` | Object | Yes | Keys matching `allowedMemberships`, values > 0 |

**Success Response — HTTP 201:**

```json
{
  "areaId": "01JFAKE0000000000000000001",
  "name": "Cancha de Tenis",
  "status": "Active",
  "capacity": 4,
  ...
}
```

New areas are always created with `status = Active`.

`areaId` is generated as a ULID inside `CreateAreaHandler`.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing required field or invalid format |
| 403 | `FORBIDDEN` | Caller is not Admin |

---

### 3.3 PUT /v1/admin/areas/:areaId

Update an existing area's full configuration. All fields are optional; omitted fields retain their current values.

**Auth:** Admin only

**Path Parameters:** `areaId` (ULID)

**Request Body:** Same shape as POST, all fields optional.

**Success Response — HTTP 200:**

```json
{
  "areaId": "01JFAKE0000000000000000001",
  "name": "Cancha de Tenis (Renovada)",
  "status": "Active",
  ...
}
```

Implementation detail: `UpdateAreaHandler` performs a `GetItem` to load the existing record, merges the provided fields, then overwrites the item with `PutItem`. The `status` field is preserved from the existing record (not overridable via this endpoint — use PATCH /status for that).

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid field value |
| 403 | `FORBIDDEN` | Caller is not Admin |
| 404 | `AREA_NOT_FOUND` | `areaId` does not exist |

---

### 3.4 PATCH /v1/admin/areas/:areaId/status

Activate or deactivate an area. Deactivated areas are hidden from Member availability queries (AC-011 filters `status != Active`).

**Auth:** Admin only

**Path Parameters:** `areaId` (ULID)

**Request Body:**

```json
{
  "status": "Active"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `status` | String | Yes | `"Active"` or `"Inactive"` |

**Success Response — HTTP 200:**

```json
{
  "areaId": "01JFAKE0000000000000000001",
  "status": "Inactive"
}
```

Implementation: `ToggleAreaStatusHandler` calls `areasRepo.updateStatus(areaId, status)`, which executes:

```
UpdateItem AreasTable:
  Key: { pk: AREA#<areaId>, sk: CONFIG }
  UpdateExpression: SET #s = :status
  ExpressionAttributeNames: { #s: status }
  ExpressionAttributeValues: { :status: <Active|Inactive> }
  ConditionExpression: attribute_exists(pk)
```

The `ConditionExpression: attribute_exists(pk)` ensures the handler returns 404 if the area does not exist.

**Error Responses:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | `status` is not `Active` or `Inactive` |
| 403 | `FORBIDDEN` | Caller is not Admin |
| 404 | `AREA_NOT_FOUND` | `areaId` does not exist (ConditionExpression failed) |

---

## 4. DynamoDB Design

### 4.1 AreasTable — item structure (confirmed implementation)

| Key | Value |
|-----|-------|
| PK | `AREA#<areaId>` |
| SK | `CONFIG` |

> Note: The SK is `CONFIG` in the actual implementation. Earlier design documents used `METADATA`. This document reflects the implemented value.

**Full attribute map (DynamoDB field → domain field):**

| DynamoDB Attribute | Domain Field | Type |
|-------------------|-------------|------|
| `pk` | (key) | String |
| `sk` | (key, always `CONFIG`) | String |
| `area_id` | `areaId` | String (ULID) |
| `name` | `name` | String |
| `status` | `status` | String: `Active` / `Inactive` |
| `capacity` | `capacity` | Number |
| `slot_duration` | `slotDuration` | Number (minutes) |
| `opening_time` | `openingTime` | String `HH:MM` |
| `closing_time` | `closingTime` | String `HH:MM` |
| `cancel_window_hours` | `cancelWindowHours` | Number |
| `allowed_memberships` | `allowedMemberships` | List of Strings |
| `max_duration_minutes` | `maxDurationMinutes` | Map: `{ Silver: N, Gold: N, VIP: N }` |
| `weekly_limit` | `weeklyLimit` | Map: `{ Silver: N, Gold: N, VIP: N }` |

**Access Patterns:**

| Pattern | Operation | Notes |
|---------|-----------|-------|
| Get area by ID | `GetItem` PK+SK | Used by availability query, reservation create |
| List all areas (Admin) | `Scan` with `FilterExpression: sk = CONFIG` | Paginated |
| List active areas only | `Scan` with `FilterExpression: #s = Active AND sk = CONFIG` | Used by member-facing list |
| Update status | `UpdateItem` with `ConditionExpression: attribute_exists(pk)` | 404 if missing |

> There is no GSI on `AreasTable` for listing by status because the table will have at most tens of items at MVP scale. A `Scan` with a `FilterExpression` is acceptable. At production scale, a `GSI_Status` (PK: `status`) would be appropriate, as noted in the areas service README.

---

## 5. Authorization Rules

| Role | GET /admin/areas | POST /admin/areas | PUT /admin/areas/:id | PATCH /admin/areas/:id/status |
|------|:---:|:---:|:---:|:---:|
| Admin | Yes | Yes | Yes | Yes |
| Manager | No (403) | No (403) | No (403) | No (403) |
| Member | No (403) | No (403) | No (403) | No (403) |

The `RolesGuard` reads `cognito:groups` from the Cognito JWT claims (forwarded by API Gateway HTTP API authorizer) and enforces `@Roles('Admin')` on every handler in `AdminAreasController`.

---

## 6. Terraform Changes

### 6.1 API Gateway Routes (implemented in `infrastructure/envs/dev/main.tf`)

```hcl
# GET /v1/admin/areas — list all areas
{
  method               = "GET"
  path                 = "/v1/admin/areas"
  lambda_invoke_arn    = module.reservations_lambda.invoke_arn
  lambda_function_name = module.reservations_lambda.function_name
  auth_required        = true
}

# POST /v1/admin/areas — create area
{
  method               = "POST"
  path                 = "/v1/admin/areas"
  lambda_invoke_arn    = module.reservations_lambda.invoke_arn
  lambda_function_name = module.reservations_lambda.function_name
  auth_required        = true
}

# PUT /v1/admin/areas/{areaId} — update area
{
  method               = "PUT"
  path                 = "/v1/admin/areas/{areaId}"
  lambda_invoke_arn    = module.reservations_lambda.invoke_arn
  lambda_function_name = module.reservations_lambda.function_name
  auth_required        = true
}

# PATCH /v1/admin/areas/{areaId}/status — toggle status
{
  method               = "PATCH"
  path                 = "/v1/admin/areas/{areaId}/status"
  lambda_invoke_arn    = module.reservations_lambda.invoke_arn
  lambda_function_name = module.reservations_lambda.function_name
  auth_required        = true
}
```

### 6.2 IAM Policy

No new IAM permissions are required. The `activa-club-reservations-dev` Lambda already has `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:Scan` on `AreasTable` from EP-02.

### 6.3 Free Tier Note

All operations (`GetItem`, `PutItem`, `UpdateItem`, `Scan`) are well within DynamoDB Free Tier at MVP scale. The `Scan` on `AreasTable` for `GET /v1/admin/areas` reads at most ~50 items (all areas the club ever creates), negligible cost.

---

## 7. Frontend Changes

### 7.1 New Page

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/admin/areas` | `AreaManagementPage` | Admin | Table of all areas with create/edit/toggle actions |

`AreaManagementPage` is linked from `DashboardPage` under the "Áreas" section of the Admin sidebar.

### 7.2 New Components

**`AreaFormModal`** (`src/components/admin/AreaFormModal.tsx`)

Modal dialog backed by React Hook Form. Used for both create and edit flows. Fields match the POST/PUT request body. Membership fields (allowed tiers, max duration, weekly limit) are rendered as a grouped input section per tier.

**`StatusBadge`** (inline in `AreaManagementPage`)

Green badge for `Active`, gray secondary badge for `Inactive`.

**`MembershipBadge`** (inline in `AreaManagementPage`)

Color-coded chip: Silver = slate, Gold = yellow, VIP = purple.

### 7.3 New Hook: `useAdminAreas`

File: `src/features/admin/hooks/useAdminAreas.ts`

Exports four hooks:

| Hook | Operation | React Query cache key |
|------|-----------|----------------------|
| `useAdminAreas()` | `GET /v1/admin/areas` | `['admin-areas']` |
| `useCreateArea()` | `POST /v1/admin/areas` | Invalidates `['admin-areas']` |
| `useUpdateArea()` | `PUT /v1/admin/areas/:id` | Invalidates `['admin-areas', 'areas']` |
| `useToggleAreaStatus()` | `PATCH /v1/admin/areas/:id/status` | Invalidates `['admin-areas', 'areas']` |

`useUpdateArea` and `useToggleAreaStatus` also invalidate the `['areas']` query key so that any open Member view of the areas list is refreshed.

### 7.4 API Client

File: `src/api/areas.api.ts` — adds:

```typescript
export function adminListAllAreas(): AxiosPromise<ApiResponse<AreaRecord[]>>
export function adminCreateArea(payload: CreateAreaPayload): AxiosPromise<ApiResponse<AreaRecord>>
export function adminUpdateArea(areaId: string, payload: UpdateAreaPayload): AxiosPromise<ApiResponse<AreaRecord>>
export function adminToggleAreaStatus(areaId: string, status: 'Active' | 'Inactive'): AxiosPromise<ApiResponse<{ areaId: string; status: string }>>
```

---

## 8. Edge Cases and Validations

| Scenario | Backend Behavior | Frontend Behavior |
|----------|-----------------|-------------------|
| Admin deactivates an area that has future CONFIRMED reservations | `PATCH /status` succeeds — status toggle does not check for active reservations. Existing reservations remain CONFIRMED; the expirer will transition them to EXPIRED when their `end_time` passes. | Admin should use the Manager Calendar (AC-015) to cancel pending reservations before deactivating. No automatic cancellation. |
| Admin creates two areas with the same name | Allowed — `name` is not a unique key. The system uses `areaId` (ULID) as the identifier. | Frontend shows both; Admin should avoid duplicates manually. |
| Admin updates `capacity` of an area that has open `SlotOccupancyTable` records | `PUT /v1/admin/areas/:id` updates `AreasTable` only. Existing `SlotOccupancyTable` items retain their old `capacity` denormalized value. The availability query reads capacity from `AreasTable` (authoritative), not `SlotOccupancyTable`. No inconsistency in availability display. | No special frontend handling required. |
| Admin updates `allowedMemberships` removing a tier with existing future reservations | Same as capacity change — existing reservations are not affected. Future reservations for the removed tier will be rejected by AC-012 validation. | No automatic notification to affected members in MVP scope. |
| `ConditionExpression` fails on PATCH /status (area not found) | `UpdateItem` throws `ConditionalCheckFailedException`; handler maps this to `404 AREA_NOT_FOUND`. | Toast "Área no encontrada". |
| Non-Admin caller hits any /admin/areas endpoint | `RolesGuard` rejects with `403 Forbidden` before any DynamoDB operation. | Axios interceptor maps 403 to redirect to login or error page. |
