---
name: chrome-mcp-testing
description: Playbook for end-to-end testing with Chrome MCP tools, including login flow, reliable selectors, and known behavior quirks for Angular Material applications.
---

# Chrome MCP Testing

Use this skill when running browser tests with Chrome MCP tools.

## When to Apply

- End-to-end verification of frontend flows
- Fast repro of UI bugs in local dev
- Regression checks around authentication and core user journeys

## Preferred Tooling

Use Chrome MCP browser tools with the `mcp_io_github_chr` prefix for navigation, script evaluation, and interaction.

### Interaction Priority Order

1. **`mcp_io_github_chr_fill` (uid)** — most reliable for Angular inputs. Always triggers Angular's change detection correctly and enables bound send/submit buttons.
2. **`mcp_io_github_chr_click` (uid)** — most reliable for buttons and interactive elements. Use `take_snapshot` first to discover stable uids.
3. **`mcp_io_github_chr_evaluate_script`** — use for reading state, waiting, combining multiple steps, or actions where uid tools are insufficient. Do NOT use for setting Angular input values — `new Event('input', { bubbles: true })` does not reliably trigger Angular change detection and leaves send/submit buttons disabled.

**Get uids via `take_snapshot` before any click or fill:**

```javascript
// 1. Snapshot to discover uids
await mcp_io_github_chr_take_snapshot();
// 2. Fill input by uid
await mcp_io_github_chr_fill({ uid: '3_8', value: 'my answer' });
// 3. Click button by uid
await mcp_io_github_chr_click({ uid: '3_9' });
```

## Test Setup

1. Navigate to the app root (e.g. `http://localhost:4200`).
2. Navigate to the login route and select the desired dev user.
3. Wait explicitly after navigation or login for the app shell to settle before assertions.
4. Use `take_snapshot` after each navigation to get fresh uids before interacting.

Login example:

```javascript
await mcp_io_github_chr_navigate_page({ type: 'url', url: 'http://localhost:4200/login' });
await mcp_io_github_chr_take_snapshot();
// Find the dev user button uid in the snapshot, then click it
await mcp_io_github_chr_click({ uid: '<dev-user-button-uid>' });
await mcp_io_github_chr_evaluate_script({
  function: () => new Promise(resolve => setTimeout(() => resolve(window.location.href), 2000))
});
```

## Reliable Selectors and DOM Patterns

- Dev-auth user buttons are rendered as buttons in the snapshot — use uid-based click after snapshot.
- Material input controls: uid-stable in snapshot, including current value state. Inspect snapshot to verify current value after interactions.
- Elements with stable `aria-label` attributes can be targeted via `evaluate_script` as a fallback for reading state.

**After every navigation or significant DOM change, call `take_snapshot` to refresh uids before further interactions.**

Useful fallbacks (evaluate_script only — for reading state, not for input):

```javascript
const pageText = document.body.innerText;
const section = document.querySelector('[aria-label*="your label"]');
const text = section ? section.innerText.slice(-400) : '';
```

## Optimization Guidelines

- Prefer uid-based `click`/`fill` over all other interaction methods.
- Call `take_snapshot` before every significant interaction to ensure uids are fresh.
- Use `evaluate_script` only for read operations (page text, current URL), waits, or actions that genuinely require scripting.
- When debugging odd behavior, stop at the first unexpected outcome and record the exact action plus observed state before continuing.

## Fast Failure Reporting Template

When you detect unexpected behavior, report:

- Step number in journey
- Action performed (navigation, fill value, click target)
- Response or state change observed
- Expected vs. actual result
- Whether the issue appears interaction-related, state-sync-related, or rendering-only

## End-to-End Smoke Script Pattern

```javascript
// 1. Login
await mcp_io_github_chr_navigate_page({ type: 'url', url: 'http://localhost:4200/login' });
await mcp_io_github_chr_take_snapshot();
// Find dev user button uid from snapshot, then:
await mcp_io_github_chr_click({ uid: '<dev-user-button-uid>' });
await mcp_io_github_chr_evaluate_script({
  function: () => new Promise(r => setTimeout(() => r(window.location.href), 2000))
});

// 2. Navigate to target page
await mcp_io_github_chr_navigate_page({ type: 'url', url: 'http://localhost:4200/<your-route>' });
await mcp_io_github_chr_take_snapshot();

// 3. Interact (fill inputs, click buttons)
await mcp_io_github_chr_fill({ uid: '<input-uid>', value: 'my value' });
await mcp_io_github_chr_click({ uid: '<button-uid>' });
await mcp_io_github_chr_evaluate_script({
  function: () => new Promise(r => setTimeout(() => r(window.location.href), 2000))
});

// 4. Read and assert state
await mcp_io_github_chr_evaluate_script({
  function: () => document.body.innerText.slice(-400)
});
```
