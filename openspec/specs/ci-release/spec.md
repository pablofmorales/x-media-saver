### Requirement: Automated release on push to main
The system SHALL run a GitHub Actions workflow on every push to the `main` branch that builds the project and creates a GitHub Release.

#### Scenario: Push to main with new version
- **WHEN** code is pushed to `main` and the version in `package.json` has no existing GitHub Release
- **THEN** the workflow SHALL build the project with `npm run build`, create a zip of the `dist/` contents named `x-media-saver-v{version}.zip`, create a GitHub Release tagged `v{version}`, and upload the zip as a release asset

#### Scenario: Push to main with existing version
- **WHEN** code is pushed to `main` and a GitHub Release for the current `package.json` version already exists
- **THEN** the workflow SHALL skip release creation without failing

#### Scenario: Build failure
- **WHEN** the build step (`npm run build`) fails
- **THEN** the workflow SHALL fail and NOT create a release

### Requirement: Release asset contains dist contents
The release zip asset SHALL contain the built extension files ready for loading as an unpacked Chrome extension.

#### Scenario: Zip structure
- **WHEN** the release zip is downloaded and extracted
- **THEN** the extracted directory SHALL contain `manifest.json` at the root level (not nested under `dist/`)
