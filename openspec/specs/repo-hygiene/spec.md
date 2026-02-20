### Requirement: Build artifacts excluded from version control
The repository SHALL have a `.gitignore` file that prevents build artifacts from being committed.

#### Scenario: dist directory ignored
- **WHEN** a developer runs `npm run build` producing a `dist/` directory
- **THEN** `dist/` SHALL NOT appear in `git status` as an untracked or modified file

#### Scenario: Zip files ignored
- **WHEN** a zip file is created in the project root
- **THEN** `*.zip` files SHALL NOT appear in `git status` as untracked files

#### Scenario: Node modules ignored
- **WHEN** `npm install` creates a `node_modules/` directory
- **THEN** `node_modules/` SHALL NOT appear in `git status` as untracked

### Requirement: Existing build artifacts removed from tracking
Previously committed build artifacts (`dist/` and `*.zip` files) SHALL be removed from git tracking.

#### Scenario: Clean repository after change
- **WHEN** this change is applied
- **THEN** `dist/` and `*.zip` files SHALL no longer be tracked by git (removed from the index)
