Fixes #

## Proposed Changes

  -
  -
  -

## Tests

  - [ ] Backend tests: `make test`
  - [ ] Frontend typecheck/lint/test/build: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  - [ ] Migration tests or manual migration verification, if database schema/data changes are included
  - [ ] Helm or deployment verification, if deployment files or release packaging changed

## Release Risk

  - [ ] No database migration or backfill risk
  - [ ] No configuration, environment variable, secret, or deployment change
  - [ ] No user-visible compatibility or rollback concern
  - [ ] Rollback plan is documented in the PR description when any item above is unchecked
