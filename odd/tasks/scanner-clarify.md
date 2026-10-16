# Feature: scanner-clarify

## Objective
Make every message the end user can see say what happened and what to do, without developer jargon or advice that cannot work.

## Problem
- `SecurityError` (the page itself is not allowed to use the camera, e.g. an iframe without `allow="camera"`) shows the permission copy: it sends people to browser settings and offers "Try again", neither of which can help.
- The result panel shows the raw format id (`ean_13`), which is an API value, not something the person scanning needs.

## Scope
- New overridable label `errorBlocked` for `SecurityError`, with no retry button.
- Remove the format line from the modal's result panel; `onScan(code, format)` is unchanged and the demo still shows the raw value for developers.

Out: the final pass (`polish`).

## Tasks
- [x] T1 `SecurityError` gets its own message and no retry. Route: inline (one component, one test).
  - Evidence: RED (permission copy shown) then GREEN 28/28; lint clean. Browser: blocked state at 393×852 shows the new copy and only the close button.
- [x] T2 Drop the raw format from the result panel. Route: inline (one-line deletion). No new test: the modal result is transient in the demo; the existing demo test still checks `ean_13` reaches the host.

## Acceptance criteria
- A `SecurityError` shows "This page isn't allowed to use the camera." and no "Try again".
- The modal never shows a format id.

## Checks
`npm run lint`, `npm run build` then `npx playwright test`, browser check of the blocked state at 393×852.

## Progress
Baseline: 27/27 e2e.

## Next step
`/impeccable polish`.
