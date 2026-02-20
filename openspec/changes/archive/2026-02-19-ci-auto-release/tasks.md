## 1. Repository Cleanup

- [x] 1.1 Create `.gitignore` with entries for `dist/`, `node_modules/`, and `*.zip`
- [x] 1.2 Remove `dist/` from git tracking (`git rm -r --cached dist/`)
- [x] 1.3 Remove `*.zip` files from git tracking (`git rm --cached *.zip`)

## 2. GitHub Actions Workflow

- [x] 2.1 Create `.github/workflows/release.yml` with trigger on push to `main`
- [x] 2.2 Add checkout, Node.js setup, and `npm ci && npm run build` steps
- [x] 2.3 Add step to read version from `package.json` and check if release already exists
- [x] 2.4 Add step to zip `dist/` contents as `x-media-saver-v{version}.zip` (with `manifest.json` at zip root)
- [x] 2.5 Add step to create GitHub Release with `gh release create` and upload the zip asset, skipping if release exists
