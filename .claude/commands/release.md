---
description: Cut a release — bump version, stamp CHANGELOG, commit, push, tag, push tag (triggers npm publish)
---

The user invoked `/release $ARGUMENTS`.

`$ARGUMENTS` is the version bump kind (`patch`, `minor`, `major`) or an explicit version (e.g. `0.2.0`). Default to `patch` if blank.

## The release flow

1. **Compute the next version.** Read the current version from `package.json`. Apply the bump per `$ARGUMENTS`, or use the explicit version verbatim. While the package is `0.0.x`, type-level breaking changes may land in patch releases — don't refuse a patch bump on that basis alone.

2. **Inspect what's changed since the last release.** Find the last release tag (`git describe --tags --abbrev=0`). Run `git log --oneline <tag>..HEAD` and `git status` to see commits + any uncommitted files that belong in this release. Read the current `CHANGELOG.md` to see what's already drafted under `## [Unreleased]`.

3. **Draft the CHANGELOG entry.** In `CHANGELOG.md`:
   - Insert a new `## [<version>] — <YYYY-MM-DD>` section directly below the existing `## [Unreleased]` heading.
   - Move any content currently under `[Unreleased]` into the new version section. Leave `[Unreleased]` as an empty heading.
   - If `[Unreleased]` was empty, draft the entries yourself based on commits since the last tag and any uncommitted changes. Use Keep a Changelog headings: `### Added`, `### Changed`, `### Fixed`, `### Removed`. One bullet per logical change; lead with the user-visible behavior, not the internal mechanism.

4. **Show the user the plan before writing anything.** Surface (in one short message):
   - the proposed version,
   - the proposed CHANGELOG entry (rendered),
   - the list of files that will be committed (uncommitted + the bumps).
   Then stop and wait for confirmation. **Do not skip this step.**

5. **Bump versions.** Edit `package.json` and `package-lock.json`. In the lockfile, update both the top-level `version` and the entry under `packages.""`.

6. **Commit.** Stage `CHANGELOG.md`, `package.json`, `package-lock.json`, and every in-flight file that the user named or that the conversation has already established as part of this release. Subject line is just the version (`0.0.8`). Body: 1–2 sentences naming the headline change. Use the standard `Co-Authored-By` footer.

7. **Push the branch.** If the push fails (conflict, protected-ref reject), stop and report. Do **not** tag.

8. **Tag and push the tag.** Annotated tag:
   ```
   git tag -a v<version> -m "v<version>"
   git push origin v<version>
   ```
   The tag push triggers `.github/workflows/publish.yml`, which runs `npm publish` via OIDC trusted publishing.

9. **Surface the result.** Tell the user the commit SHA, the tag, and `https://github.com/mezawebdev/agent-harness-sdk/actions` so they can watch the publish run.

## Constraints

- **Always pause for confirmation at step 4.** Releases are public and not cleanly reversible (`npm unpublish` has a 72h window and signals badly to consumers). The user should see the version + the changelog entry before any file is written.
- **Tag only AFTER the branch push succeeds.** A tag without its underlying commit on `main` is broken state.
- **Never use `--force`** on the branch push or the tag push. If the branch is behind, stop and investigate.
- **One commit per release.** Bundle the version bump, lockfile sync, changelog stamp, and any in-flight files into a single commit named `<version>`. Don't split.
- **The tag push is the point of no return.** Once it lands, the workflow publishes unattended. If the user expresses any doubt after the branch push but before the tag, stop and wait.
- **Do not run `npm publish` locally.** Publishing is the CI workflow's job (OIDC trusted publishing requires it).
