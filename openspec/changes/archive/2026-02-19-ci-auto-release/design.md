## Context

The repository currently has `dist/` and four `*.zip` release files committed to version control. There is no `.gitignore` file. Releases are created manually by building locally and zipping the `dist/` contents. The project uses `npm run build` (`tsc && vite build`) to produce the `dist/` directory.

## Goals / Non-Goals

**Goals:**
- Remove build artifacts (`dist/`, `*.zip`) from version control
- Add `.gitignore` to prevent future accidental commits of build output
- Automate release creation on push to `main` via GitHub Actions
- Publish a zip of `dist/` contents as a GitHub Release asset

**Non-Goals:**
- Rewriting git history to purge old artifacts from past commits
- Publishing to the Chrome Web Store (future work)
- Adding tests or linting to the CI pipeline
- Versioning automation (version is read from `package.json` as-is)

## Decisions

### 1. Version source: `package.json`
Read the version from `package.json` to tag the release (e.g., `v0.2.2`). This keeps the existing manual versioning workflow — bump `package.json` before merging to `main`.

**Alternative**: Auto-increment version or use conventional commits. Rejected — adds complexity with no immediate benefit.

### 2. Release trigger: push to `main`
Trigger the workflow on `push` to `main` rather than manual dispatch or tag-based triggers. This matches the user's request and ensures every merge creates a release.

**Alternative**: Tag-based triggers (`on: push: tags: 'v*'`). Rejected — requires an extra manual step of creating tags.

### 3. Release creation: `gh release create`
Use the GitHub CLI (`gh release create`) which is pre-installed on GitHub Actions runners. Create a release with the tag from `package.json` and upload the zip.

**Alternative**: `softprops/action-gh-release` action. Rejected — `gh` CLI is simpler, has no third-party dependency, and is maintained by GitHub.

### 4. Duplicate version handling: skip release
If a release for the current version already exists (e.g., a non-version-bump commit to `main`), skip release creation gracefully rather than failing the workflow.

**Alternative**: Fail the workflow. Rejected — pushes to `main` that don't bump the version shouldn't break CI.

### 5. Zip naming convention
Name the zip `x-media-saver-v{version}.zip` to match the existing manual naming convention.

## Risks / Trade-offs

- **[Non-version-bump pushes]** → Mitigated by checking if the release tag already exists and skipping if so.
- **[Breaking existing local workflows]** → Low risk. Developers can still run `npm run build` locally. The `.gitignore` just prevents accidental commits.
- **[Large zip files in releases]** → Acceptable. Chrome extension builds are small (< 1MB). GitHub Releases supports up to 2GB per asset.
