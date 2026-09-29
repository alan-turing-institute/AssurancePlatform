# Review checklist

This file lists what a reviewer checks on every pull request to this repository.
It adds to `AGENTS.md`, which holds the conventions, so read that first.
Style the linter enforces is not a review finding.

Each rule below comes from defects that reached review more than once.
For each finding, give the file and line, the problem, why it matters, and a fix or a script that shows it.

Most rules can be checked by reading the diff.
Rules marked **(run)** need a test or CI result, so ask the author for the evidence or run it yourself.

## 1. Authorisation on every data path

- Every route, action or service that reads or changes a resource checks the actor's permission on that specific resource before any side effect.
  Parsing a body, storing a file or writing a row before the check is a defect, even if the check later fails.
- A resource referenced by ID inside a request body (a cited element, a linked case, an uploaded file) is checked as belonging to the resource the caller has access to.
  Checking only the outer case is not enough.
- A missing resource and an inaccessible one return the same status and the same body.
- A new or changed secured operation has integration tests for owner, direct permission levels, team permission, no permission, unauthenticated and missing resource.
  A missing test for any of these is a finding.

## 2. Data leaving the system

- Anything copied into a snapshot, export, public page, log entry or test report uses an explicit list of fields, not the whole object.
  Check for user-written text, email addresses, internal IDs and private case names passing through.
- Tests and fixtures never type or print real credentials.
  Use obvious placeholders, or the seed password read from the environment.
  Playwright's failure artefacts record typed form values.
  CI strips traces and error context before uploading artefacts, but that is a backstop, not a reason to relax this rule.
- Error messages returned to clients do not reveal whether a resource exists or who owns it.

## 3. Values that are validated but not saved

- When a schema accepts a new field, trace it through every hand-written object or allowlist between validation and the database write.
  Schema acceptance does not prove persistence.
- In forms, check that new controls forward `ref` and are registered, so focus and validation reach them.

## 4. Database transactions

- Inside `prisma.$transaction(async (tx) => ...)`, every query goes through `tx`, never the global client.
- A caught error inside a transaction leaves Postgres in an aborted state.
  Retrying inside the same transaction needs a savepoint, not only a JavaScript `try`/`catch`.
- A foreign-key or unique-constraint failure inside a transaction must produce a clear error, not a generic rollback.

## 5. Tests that can fail

- **(run)** Every test for a failure path fails against the code before the change.
  Ask for the evidence when it is not obvious.
- Watch for three patterns that pass without testing anything:
  - a spy on the global Prisma client, which a transaction bypasses
  - a malformed-input fixture that trips an earlier check than the one under test
  - a jsdom test of native browser behaviour (focus, key capture, outside-click dismissal), which jsdom does not reproduce
- Browser behaviour that jsdom cannot reproduce needs a Playwright test or a recorded browser check.

## 6. Canvas accessibility and end-to-end locators

- React Flow node wrappers have `role="button"` and no label of their own, so their accessible name is the text of everything inside them.
  Adding or changing an `aria-label` or visible text inside a node changes the wrapper's name too.
- End-to-end locators on the canvas or in dialogs are scoped first (to the node, dialog or section), then queried by role with an exact name.
  Unscoped `getByText` or `getByLabel`, or `getByRole` without `exact`, can match an unrelated element such as the node wrapper, and give false evidence.
- **(run)** Any change to a name, role or label on the canvas means running the canvas end-to-end specs on the branch.

## 7. Structural quality and coverage

- **(run)** CI's `structural-quality` job runs fallow with the merged coverage map, so complexity on untested code fails it.
  An extraction or small edit in a function with no test coverage can fail the job even when a local run without coverage passes.
- For any function the change touches or extracts, ask which test reaches it directly.
- Only findings the change introduced count.
  Existing findings are out of scope.

## 8. What goes into a public repository

- No partner names, internal project codenames, private design records or infrastructure identifiers in code, UI copy, placeholder text, demo content, fixtures, comments, docs or commit messages.
  Check the names the diff adds.
  An existing name that the diff only sits near is not a new finding.
- Code comments, docs and generated files state behaviour and do not cite internal rulings, people's decisions, internal design records or their dates.
- A new example name (an organisation, a domain, a case) must already be public and not tied to a partner.
- Product documentation in `content/` describes how the product works.
  It does not list open software defects or planned bug fixes.
  Design records in `docs/specs/`, which record accepted limitations, are the exception.
- The product is neutral between ethical frameworks.
  Do not add content that presents one framework as the product's own.
