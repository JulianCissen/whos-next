# REST API Contract — `/api/rotations`

**Feature**: Rotation Lifecycle (Create, Rename, Delete)
**Base URL**: `/api/rotations`
**Content type**: `application/json` on both request and response bodies (unless otherwise noted).
**Authentication**: None. Constitution principle II — the slug is the access credential.

All DTOs listed below live in `packages/shared/src/rotations/index.ts` and are imported by both the backend controllers (`class-validator`-decorated subclasses) and the frontend API service.

---

## Shared types

```ts
// packages/shared/src/rotations/index.ts

export const SLUG_LENGTH = 8;
export const SLUG_REGEX = /^[1-9A-HJ-NP-Za-km-z]{8}$/;
export const ROTATION_NAME_MIN_LENGTH = 1;
export const ROTATION_NAME_MAX_LENGTH = 100;

export interface CreateRotationRequestDto {
  name: string;
}

export interface RenameRotationRequestDto {
  name: string;
}

export interface RotationResponseDto {
  slug: string;          // 8 chars, base-58
  name: string;          // 1–100 chars after trim
  createdAt: string;     // ISO 8601 UTC
  updatedAt: string;     // ISO 8601 UTC
}

export interface ApiErrorResponseDto {
  statusCode: number;    // mirrors HTTP status
  error: string;         // short machine code, e.g. "ROTATION_NOT_FOUND"
  message: string;       // user-facing message (i18n key resolved server-side in default locale)
  details?: Record<string, unknown>;
}
```

The `id` column and `lastAccessedAt` column are **never** included in API responses (FR-025, data-model §Columns).

---

## Endpoints

### 1. `POST /api/rotations` — Create a rotation

Creates a new rotation with a freshly generated slug.

**Rate limit**: subject to the project-wide rate-limit guard (out of scope for this feature).

#### Request body

```ts
CreateRotationRequestDto
```

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | `length(trim(name))` in `[1, 100]`; no control chars (`/[\u0000-\u001F\u007F-\u009F]/`). |

#### Responses

| Status | Body | When |
|---|---|---|
| `201 Created` | `RotationResponseDto` | Success. Response `Location: /api/rotations/:slug` header is also set. |
| `400 Bad Request` | `ApiErrorResponseDto` with `error: "INVALID_ROTATION_NAME"` | Name fails validation. |
| `429 Too Many Requests` | `ApiErrorResponseDto` with `error: "RATE_LIMITED"` | Rate limit exceeded. (Reserved shape; guard implemented in a later unit.) |
| `500 Internal Server Error` | `ApiErrorResponseDto` with `error: "SLUG_GENERATION_FAILED"` | All 5 slug generation retries collided (effectively impossible; logged). |

#### Example

```http
POST /api/rotations HTTP/1.1
Content-Type: application/json

{"name": "Dish duty"}
```

```http
HTTP/1.1 201 Created
Location: /api/rotations/2aB9xPqR
Content-Type: application/json

{
  "slug": "2aB9xPqR",
  "name": "Dish duty",
  "createdAt": "2026-04-18T19:50:08.000Z",
  "updatedAt": "2026-04-18T19:50:08.000Z"
}
```

---

### 2. `GET /api/rotations/:slug` — Fetch a rotation

Returns the rotation identified by `slug`. Side effect: triggers a throttled last-access update (R-6).

#### Path parameters

| Param | Constraint |
|---|---|
| `slug` | Must match `SLUG_REGEX`. Case-sensitive. |

#### Responses

| Status | Body | When |
|---|---|---|
| `200 OK` | `RotationResponseDto` | Rotation found. |
| `404 Not Found` | `ApiErrorResponseDto` with `error: "ROTATION_NOT_FOUND"` | Slug does not match an existing rotation. Also returned (without hitting the DB) when the slug fails the regex — FR-014. |

**Note on FR-013 / FR-014a**: the response body and status are identical for "unknown slug", "malformed slug", and "deleted rotation". The frontend also collapses all three to the same UI state.

#### Example

```http
GET /api/rotations/2aB9xPqR HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "slug": "2aB9xPqR",
  "name": "Dish duty",
  "createdAt": "2026-04-18T19:50:08.000Z",
  "updatedAt": "2026-04-18T19:50:08.000Z"
}
```

---

### 3. `PATCH /api/rotations/:slug` — Rename a rotation

Changes the rotation's name. Slug is **not** changed (FR-017).

#### Path parameters

As for GET.

#### Request body

```ts
RenameRotationRequestDto
```

Same validation as `CreateRotationRequestDto.name`.

#### Responses

| Status | Body | When |
|---|---|---|
| `200 OK` | `RotationResponseDto` | Rename succeeded. Response body reflects the new name and the updated `updatedAt`. |
| `400 Bad Request` | `ApiErrorResponseDto` with `error: "INVALID_ROTATION_NAME"` | New name fails validation. |
| `404 Not Found` | `ApiErrorResponseDto` with `error: "ROTATION_NOT_FOUND"` | Same semantics as GET. |

PATCH is used rather than PUT because the client sends only the mutable subset of fields; unknown fields are rejected by the `ValidationPipe`'s `forbidNonWhitelisted` setting.

---

### 4. `DELETE /api/rotations/:slug` — Delete a rotation

Permanently removes a rotation (FR-021). The typed-name confirmation is a **frontend-only** safeguard (FR-020) — the backend does not validate a confirmation payload, because requiring the client to echo the name in the request body would add complexity without adding security: any client capable of making an HTTP request directly can already skip the dialog.

The frontend MUST NOT issue a DELETE request until the user has satisfied the typed-confirmation UI.

#### Path parameters

As for GET.

#### Request body

Empty.

#### Responses

| Status | Body | When |
|---|---|---|
| `204 No Content` | (empty) | Deletion succeeded. |
| `404 Not Found` | `ApiErrorResponseDto` | Slug does not match an existing rotation. Deleting an already-deleted slug returns 404 (it is not idempotent-200, to preserve the "not found = same state regardless of reason" invariant, FR-013). |

---

## Error model — full shape

All 4xx and 5xx responses use `ApiErrorResponseDto`. The `error` code enum for this feature:

| Code | HTTP status | Meaning |
|---|---|---|
| `INVALID_ROTATION_NAME` | 400 | Name failed validation. |
| `ROTATION_NOT_FOUND` | 404 | Slug unknown, malformed, or points to a deleted rotation. |
| `RATE_LIMITED` | 429 | Too many requests (reserved — guard out of scope). |
| `SLUG_GENERATION_FAILED` | 500 | 5 collisions in a row. Should never fire in practice. |

The `message` field uses the i18n key's resolved English text by default; the frontend displays its own localized copy and uses the `error` code only for dispatch.

---

## Bruno collection mapping

Each endpoint has at least one request file under `apps/backend/bruno/rotations/`. Filenames are `<verb>-<case>.bru`:

| File | Endpoint | Case |
|---|---|---|
| `create.bru` | POST | 201 happy path |
| `create-validation-error.bru` | POST | 400 — empty name |
| `get.bru` | GET | 200 |
| `get-not-found.bru` | GET | 404 — unknown slug |
| `rename.bru` | PATCH | 200 |
| `rename-validation-error.bru` | PATCH | 400 — name too long |
| `delete.bru` | DELETE | 204 |

All requests use `{{baseUrl}}` from the existing `environments/local.bru`.
