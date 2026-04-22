# Quickstart — Member Queue Management

**Feature**: Member Queue Management
**Date**: 2026-04-21

This guide covers how to run, test, and exercise the member queue feature locally.

---

## Prerequisites

- Docker Desktop running
- `pnpm` 10 installed
- Dev environment previously bootstrapped (see project-scaffolding quickstart)

---

## 1. Start the dev environment

```sh
pnpm run dev
```

This starts PostgreSQL 16, the NestJS backend (port 3000), the Angular frontend (port 4200), and the shared-package watcher via `docker-compose.yml`.

---

## 2. Run the migration

The member queue migration (`Migration20260421000002_members`) must be applied before the feature is usable:

```sh
pnpm --filter @whos-next/backend exec mikro-orm migration:up
```

Verify the new tables exist:

```sh
pnpm --filter @whos-next/backend exec mikro-orm debug
# Should list: rotations, members, member_queue_changes, occurrence_assignments
```

---

## 3. Seed test data

```sh
pnpm --filter @whos-next/backend exec mikro-orm seeder:run
```

This populates six rotations (from the rotation-lifecycle seeder) and their member queues (from `MemberSeeder`), including:
- A 3-member queue (Dish duty)
- A 5-member queue mid-cycle (Standup host)
- A single-member queue (Birthday cake)
- A queue with a soft-deleted member (Fika-waarde)
- An empty queue (100-char rotation)

---

## 4. Exercise the API with Bruno

Open the Bruno collection at `apps/backend/bruno/`. Select the `local` environment.

Key flows to test:
1. `GET /api/rotations/:slug` — verify `members` array is present in response.
2. `POST /api/rotations/:slug/members` — add "Dave" to the back; verify position = N+1.
3. `POST /api/rotations/:slug/members` — add "Eve" to the front; verify position = 1, Dave shifts to N+2.
4. `PUT /api/rotations/:slug/members/order` — reorder by submitting the member IDs in reverse order.
5. `DELETE /api/rotations/:slug/members/:id` — remove a member; verify subsequent GET excludes them.
6. Attempt to add a member when queue has 100 members — expect `409 QUEUE_CAPACITY_EXCEEDED`.

---

## 5. Run unit tests

```sh
pnpm --filter @whos-next/backend run test
pnpm --filter @whos-next/shared run test
pnpm --filter @whos-next/frontend run test
```

Key test files:
- `packages/shared/src/members/assignment.spec.ts` — pure `assignMembers` function; covers empty queue, single-member, multi-member, cycle wrap, arbitrary `nextIndex` offsets.
- `apps/backend/src/members/members.service.spec.ts` — unit tests for `MembersService` with mocked EntityManager; covers add/remove/reorder and `nextIndex` update rules.
- `apps/backend/src/members/members.controller.integration.spec.ts` — integration tests via Testcontainers; covers all four endpoints end-to-end.

---

## 6. Run integration tests

```sh
pnpm --filter @whos-next/backend run test:integration
```

Integration tests spin up a `postgres:16-alpine` container (via Testcontainers), run the migration, and exercise the full HTTP stack. Expect ~30–60 seconds for container startup on first run.

---

## 7. Run E2E and accessibility tests

```sh
pnpm --filter @whos-next/e2e run test
```

Key E2E specs:
- `apps/e2e/tests/member-queue.spec.ts` — add member, remove member, drag-and-drop reorder, empty state, capacity error.
- `apps/e2e/tests/accessibility.spec.ts` — axe-core scans on the rotation page with the queue rendered.

---

## 8. Verify the frontend

Open `http://localhost:4200`, navigate to any rotation (or create one), and confirm:
- The member queue section is visible below the rotation name.
- The add-member form accepts a name and front/back choice.
- Members appear in order after adding.
- Drag-and-drop reorder works and persists on reload.
- Removing a member removes them from the list immediately.
- An empty-state message appears when the queue is empty.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `relation "members" does not exist` | Migration not applied | Run `mikro-orm migration:up` |
| 404 on `DELETE /members/:id` | Using soft-deleted member's ID | Fetch the current active queue first |
| Drag-and-drop not working | CDK drag-drop module not imported | Verify `CdkDragDropModule` is in the component's `imports` |
| `409 QUEUE_CAPACITY_EXCEEDED` during seed | Seeder running on a non-empty DB | Run `mikro-orm schema:fresh --run` to reset (dev only) |
