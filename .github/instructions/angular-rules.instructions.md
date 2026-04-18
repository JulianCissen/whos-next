---
applyTo: 'apps/frontend/src/**/*.ts'
---

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
