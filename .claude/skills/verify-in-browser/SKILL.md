---
name: verify-in-browser
description: Build and run the app to confirm a change works in a real browser. Serves a production build on a throwaway database, checks each changed page for status, page errors, layout shift, accessibility and placeholder text, then drives the change's own proof steps. Use after any change to a page, component, dialog, stylesheet or UI library, before reporting the change as done.
---

# Verify a change in the browser

Use this after any change a user can see: a page, component, dialog or stylesheet.
Use it also after upgrading a UI library (`@radix-ui/*`, React, Next.js, React Flow, react-hook-form, the editor packages), even when no page changed.

## 1. Start a production server

```bash
scripts/serve-production-build.sh up <port>
```

Pick a free port, and check it first with `ss -ltn` (the script refuses a port already in use).
The script builds the app, creates a new throwaway database on the test Postgres container (port 5433), seeds it and starts the server.
Wait for the `READY` line, and note the URL and the seed password it prints.
Start the test container first if it is not running: `docker compose -f docker-compose.local.yml up -d postgres-test`.

## 2. Check the changed pages

```bash
SEED_USER_PASSWORD=<printed password> pnpm exec tsx scripts/check-pages.ts --base-url <url> <path> [<path> ...]
```

List every page the change can affect, not only the one you edited.
For a UI-library upgrade, or a change to a shared component or layout, use `--all`.
Each page reports its status, page errors, console errors, layout shift, accessibility violations and placeholder text.
A page fails on a status of 400 or above, any page error, placeholder text, or a redirect to the sign-in page.
Accessibility and layout shift are compared with `.a11y-baseline.json`, which records what each page has today.
A page fails only on a new accessibility rule, a higher count for a rule already recorded, or layout shift above the baseline plus 0.02 (with 0.1 as the floor).
Each result's `baselineDelta` shows what is new.
If a change deliberately alters a page's accessibility or layout, regenerate the file with `--all --write-baseline` and include the diff in the change.

## 3. Prove the change itself

The page check shows a page loads cleanly; it does not show the change works.
Write a short Playwright script that performs the change's proof steps against the same server: the click, the saved value, the new text.
Put it in `.tmp/` inside the repository, which is gitignored, and run it with `pnpm exec tsx .tmp/<name>.ts` so it can import `@playwright/test`.
A script outside the repository cannot resolve Playwright.
Attach `page.on("pageerror")` and fail on any error.
Scope locators to the element first (a dialog, a canvas node, a section), then query by role with an exact name.

## 4. Stop the server

```bash
scripts/serve-production-build.sh down <port>
```

This stops the server and drops that run's database.

## 5. Report

Report what you ran and what you saw: the pages checked and their results, the proof steps and their outcome.
For any defect, include the exact script or steps that reproduce it, the page, and the expected and actual result.
