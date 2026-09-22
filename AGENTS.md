# Working in this repository

## Branches and commits

Nearly all development happens on one machine, so the repository does not
use remote feature branches or pull requests.

- Day-to-day work lives on a local **scratch branch** (`feat/...`,
  `wip/...`, whatever describes it). Commit there only when asked; never
  push a scratch branch or open a pull request from it.
- A **release** is a squash of the scratch branch onto `main`: one commit
  with a release-style message, not a merge of the branch history.
  `git merge --squash <branch>` on `main`, then a single commit, then the
  `vMAJOR.MINOR.PATCH` tag described in [docs/release.md](docs/release.md).
- `main` is therefore a clean history of releases; the scratch branch is
  disposable once squashed.

## Conventions

- Add a `WORKLOG.md` entry (`## YYYY-MM-DD — Title` plus bullets) with every
  substantive change. The tag body for a release is that section.
- Source files aim for 250 lines and must stay under 300;
  `node scripts/check-file-lengths.mjs` enforces it.
- Run `pnpm check` and the affected tests **once, at the end** of a change,
  not after every edit. `pnpm check` typechecks every package and takes
  minutes; the app test suite takes about two. While iterating, use the
  cheap, targeted gates instead: `node scripts/check-file-lengths.mjs` for
  the line limit, `pnpm prettier --check <files>`, and
  `pnpm --filter ./apps/app exec vitest run <one test file>`.
- Prettier formats everything; `pnpm prettier --check <files>` on what you
  touched.
