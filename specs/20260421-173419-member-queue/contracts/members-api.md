# API Contract — Member Queue

**Feature**: Member Queue Management
**Date**: 2026-04-21
**Base URL**: `/api/rotations/:slug/members`

All endpoints inherit the existing rotation-lifecycle authentication model: any bearer of the rotation's slug has full access. No session or token is required.

---

## Modified: `GET /api/rotations/:slug`

The existing rotation GET endpoint is extended to include the active member queue.

**Change**: `RotationResponseDto` gains a `members` field.

### Response `200 OK`

```json
{
  "slug": "aBcD1234",
  "name": "Dish duty",
  "createdAt": "2026-04-18T10:00:00.000Z",
  "updatedAt": "2026-04-21T09:00:00.000Z",
  "members": [
    { "id": "uuid-1", "name": "Alice", "position": 1 },
    { "id": "uuid-2", "name": "Bob",   "position": 2 },
    { "id": "uuid-3", "name": "Carol", "position": 3 }
  ]
}
```

- `members` is always present. Empty array `[]` when no active members.
- Removed (soft-deleted) members are NOT included.
- Members are ordered by `position` ascending.

### Unchanged error responses

| Status | `error` code | When |
|---|---|---|
| `404` | `ROTATION_NOT_FOUND` | Unknown slug, malformed slug, deleted rotation |

---

## `POST /api/rotations/:slug/members`

Add a new member to the rotation queue.

### Request body

```json
{
  "name": "Dave",
  "placement": "back"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | `string` | yes | 1–100 chars after trim; no control chars; printable Unicode |
| `placement` | `"front" \| "back"` | yes | Exactly one of these two values |

### Response `201 Created`

Returns the newly created member:

```json
{
  "id": "uuid-4",
  "name": "Dave",
  "position": 4
}
```

### Error responses

| Status | `error` code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `name` fails validation; `placement` is not `"front"` or `"back"` |
| `400` | `MEMBER_NAME_REQUIRED` | `name` is empty or whitespace-only after trim |
| `400` | `MEMBER_NAME_TOO_LONG` | `name` exceeds 100 characters after trim |
| `409` | `QUEUE_CAPACITY_EXCEEDED` | Active member count is already 100 |
| `404` | `ROTATION_NOT_FOUND` | Unknown or malformed slug |

---

## `DELETE /api/rotations/:slug/members/:memberId`

Soft-delete a member from the rotation queue. The member's row is retained for historical assignment records.

### Path parameters

| Parameter | Type | Notes |
|---|---|---|
| `slug` | `string` | 8-character base-58 rotation slug |
| `memberId` | `uuid` | The `id` of the member to remove |

### Response `204 No Content`

Empty body on success.

### Error responses

| Status | `error` code | When |
|---|---|---|
| `404` | `ROTATION_NOT_FOUND` | Unknown or malformed rotation slug |
| `404` | `MEMBER_NOT_FOUND` | `memberId` does not exist in this rotation, or is already removed |

---

## `PUT /api/rotations/:slug/members/order`

Reorder the active queue by providing the desired new order as a complete array of member IDs.

**Note**: The path segment `order` is registered before `:memberId` in the NestJS controller to prevent routing ambiguity. NestJS matches static segments before parameterised ones when registered in that order.

### Request body

```json
{
  "memberIds": ["uuid-2", "uuid-3", "uuid-1"]
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `memberIds` | `string[]` | yes | Must contain exactly the IDs of all current active members (no extras, no omissions, no duplicates). Order defines the new queue positions 1..N. |

### Response `200 OK`

Returns the updated queue:

```json
{
  "members": [
    { "id": "uuid-2", "name": "Bob",   "position": 1 },
    { "id": "uuid-3", "name": "Carol", "position": 2 },
    { "id": "uuid-1", "name": "Alice", "position": 3 }
  ]
}
```

### Error responses

| Status | `error` code | When |
|---|---|---|
| `400` | `REORDER_INVALID` | `memberIds` does not exactly match the current active member IDs (missing members, extra IDs, or duplicates) |
| `400` | `REORDER_EMPTY` | `memberIds` is an empty array but active members exist |
| `404` | `ROTATION_NOT_FOUND` | Unknown or malformed rotation slug |

---

## Shared DTO definitions (`@whos-next/shared`)

```typescript
// packages/shared/src/members/index.ts

export interface MemberDto {
  id: string;
  name: string;
  position: number; // 1-indexed, active members only
}

export interface AddMemberRequestDto {
  name: string;
  placement: 'front' | 'back';
}

export interface AddMemberResponseDto extends MemberDto {}

export interface ReorderMembersRequestDto {
  memberIds: string[];
}

export interface ReorderMembersResponseDto {
  members: MemberDto[];
}
```

---

## Bruno collection

`apps/backend/bruno/members/` — one request file per endpoint:

| File | Covers |
|---|---|
| `add-member-back.bru` | `POST` — success, placement: back |
| `add-member-front.bru` | `POST` — success, placement: front |
| `add-member-validation.bru` | `POST` — 400 name too long |
| `add-member-capacity.bru` | `POST` — 409 queue full |
| `remove-member.bru` | `DELETE` — success |
| `remove-member-not-found.bru` | `DELETE` — 404 member not found |
| `reorder-members.bru` | `PUT /order` — success |
| `reorder-members-invalid.bru` | `PUT /order` — 400 mismatched IDs |

All requests use the `{{baseUrl}}` environment variable from `apps/backend/bruno/environments/`.
