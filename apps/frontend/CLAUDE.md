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

# Angular Rules

- Every `@Component` must declare `changeDetection: ChangeDetectionStrategy.OnPush`.
- All routes must be lazy-loaded with `loadComponent` and dynamic imports.
- Target under 200 lines of TypeScript logic per component file.
- Split a component when any of the following apply:
  - Template exceeds ~50 lines
  - Three or more visually unrelated sections in the template
  - Mixing data management with complex rendering logic
  - Approaching the 300-line file limit
- Strategies for splitting: extract a presentational child component (`@Input`/`@Output`), extract a service for logic and state, extract a pipe for pure transformations, apply the smart/dumb pattern.
