## ADDED Requirements

### Requirement: Project README exists at repository root
The project SHALL have a `README.md` file at the repository root that provides comprehensive documentation for users and contributors.

#### Scenario: README is present
- **WHEN** a user or contributor visits the repository
- **THEN** they SHALL find a `README.md` at the project root

### Requirement: README covers project overview
The README SHALL include a project overview section explaining what X Media Saver is, what it does, and its key features.

#### Scenario: Project description
- **WHEN** a reader views the README
- **THEN** they SHALL find a clear description of the extension's purpose (downloading images and videos from X/Twitter posts) and its key features (one-click download, full-quality images, video support, download history)

### Requirement: README covers installation
The README SHALL include instructions for installing the extension from source as an unpacked Chrome extension.

#### Scenario: Installation steps
- **WHEN** a user wants to install the extension
- **THEN** the README SHALL provide step-by-step instructions: clone the repo, install dependencies, build, and load as unpacked extension in Chrome

### Requirement: README covers development setup
The README SHALL include a development section with commands for building and running the extension in dev mode.

#### Scenario: Development commands
- **WHEN** a developer wants to contribute
- **THEN** the README SHALL document `npm run dev` for development and `npm run build` for production builds

### Requirement: README covers architecture
The README SHALL include a section describing the extension's architecture: the three runtime contexts (background service worker, content script, popup) and how they communicate.

#### Scenario: Architecture overview
- **WHEN** a developer reads the architecture section
- **THEN** they SHALL understand the separation between background worker, content script, and popup, and the message-passing pattern between them
