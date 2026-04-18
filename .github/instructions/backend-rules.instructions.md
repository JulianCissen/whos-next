---
applyTo: 'apps/backend/src/**/*.ts'
---

# Backend Rules (NestJS / MikroORM)

- Controllers must be thin — business logic belongs in services.
- Split services at the 300-line boundary by concern.
- Use `import type` for DTOs and other types used only in type positions.
- Use the decorator-less MikroORM API (`defineEntity`). Do not use `@Entity()` class decorators.
- Instantiate entities with `new MyEntity(...)`, not `em.create(...)`.
- Organise by domain, not by type. Each domain folder contains its own entity, controller, service, and module. Cross-cutting concerns live in `common/`.
- All relative imports must use explicit `.js` extensions (required by NodeNext module resolution).
