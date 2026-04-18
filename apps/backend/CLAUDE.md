# TypeScript Rules

Rules most frequently missed on first-pass implementations:

- Use `import type` for type-only imports (`consistent-type-imports`).
- Import groups must be ordered: `builtin → external → internal → parent → sibling → index`, with a blank line between each group. The workspace alias (`@whos-next/*`) counts as `internal`.
- Never import from packages absent in the local `package.json` (`import-x/no-extraneous-dependencies`).
- All `Promise`s must be awaited, returned, or explicitly discarded with `void` (`no-floating-promises`).
- Never pass async functions as synchronous callbacks (`no-misused-promises`).
- Prefer `??` over `||` for nullish fallbacks; prefer `?.` over explicit null guards.
- Use `const` only; use `===` always.
- Hard file size limit: 300 lines.

# Backend Rules (NestJS / MikroORM)

- Controllers must be thin — business logic belongs in services.
- Split services at the 300-line boundary by concern.
- Use `import type` for DTOs and other types used only in type positions.
- Use the decorator-less MikroORM API (`defineEntity`). Do not use `@Entity()` class decorators.
- Instantiate entities with `new MyEntity(...)`, not `em.create(...)`.
- Organise by domain, not by type. Each domain folder contains its own entity, controller, service, and module. Cross-cutting concerns live in `common/`.
- All relative imports must use explicit `.js` extensions (required by NodeNext module resolution).
