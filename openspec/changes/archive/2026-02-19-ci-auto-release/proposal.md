## Why

Build artifacts (`dist/`, `*.zip`) are committed to the repository, bloating the repo and creating merge noise. Releases are currently created manually. Automating releases via GitHub Actions ensures consistent, reproducible builds and keeps the repository clean.

## What Changes

- Remove `dist/` directory and `*.zip` release files from version control
- Add `.gitignore` to exclude build artifacts (`dist/`, `node_modules/`, `*.zip`)
- Add a GitHub Actions workflow that triggers on push to `main`, builds the project, creates a versioned GitHub Release, and uploads a zip of the `dist/` contents as a release asset

## Capabilities

### New Capabilities
- `ci-release`: GitHub Actions workflow that builds the extension and publishes a release with a zip artifact on push to main
- `repo-hygiene`: `.gitignore` configuration to keep build artifacts out of version control

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Repository**: `dist/` and `*.zip` files removed from git history tracking (not rewritten — just untracked going forward)
- **Build process**: No change — `npm run build` still produces `dist/`
- **Release process**: Fully automated via GitHub Actions instead of manual zip creation
- **CI/CD**: New `.github/workflows/` directory with release workflow
- **Dependencies**: None — uses standard GitHub Actions (actions/checkout, actions/setup-node, actions/upload-artifact, GitHub CLI for releases)
