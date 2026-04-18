# Contract: Health Check Endpoint

*The only backend contract introduced in Unit 0.*

---

## `GET /health`

Returns the operational status of the backend service and its database connection.

### Request

```
GET /health HTTP/1.1
Host: localhost:3000
```

No query parameters, headers, or request body required.

### Response — Success

**Status**: `200 OK`
**Content-Type**: `application/json`

```json
{
  "status": "ok",
  "database": "connected"
}
```

**TypeScript shape** (from `@whos-next/shared`):
```typescript
interface HealthResponseDto {
  status: 'ok';
  database: 'connected';
}
```

### Response — Failure

If the database connection is not healthy, the endpoint **does not return 200**. The NestJS health check module returns:

**Status**: `503 Service Unavailable`

```json
{
  "status": "error",
  "error": "Database connection failed"
}
```

*Note: The exact error shape for failure cases may be refined in implementation. The 503 status is the invariant contract — callers should treat any non-200 as unhealthy.*

---

## Usage

This endpoint is used by:

1. **Docker Compose health check** — `docker-compose.yml` configures a `healthcheck` on the backend service using `curl -f http://localhost:3000/health || exit 1`. The frontend and database services depend on the backend reaching a healthy state.
2. **Acceptance test SC-005** — automated test sends a request to `/health` within 5 seconds of stack healthy state and asserts a 200 response with `database: "connected"`.

---

## Future Contracts

Feature endpoints (rotations, members, occurrences, etc.) are defined in the contracts for their respective units (Unit 1+). All future contracts follow the same camelCase convention mandated by the constitution (§ Data & API Conventions).
