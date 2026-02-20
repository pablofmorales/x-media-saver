## Context

X Media Saver currently downloads media from tweets but uses a priority system: if a tweet contains both images and a video, only the video is downloaded (see `button.ts:76-88`). The `return` statement at line 87 exits the click handler after sending the video download message, skipping image extraction entirely. Users who want all media from a mixed-media tweet must currently have no way to get the images.

The project also lacks a README.md — only CLAUDE.md exists, which is a machine-facing file for Claude Code, not a human-facing project guide.

## Goals / Non-Goals

**Goals:**
- Download all media from a tweet in one click: both images and video when both are present
- Add a comprehensive, human-readable README.md to the project root

**Non-Goals:**
- Changing filename conventions or download folder structure
- Adding new UI controls (e.g., a toggle to select which media types to download)
- Changing the popup UI or download history behavior
- Adding GIF-specific handling (GIFs already resolve as MP4 via the video API)

## Decisions

### 1. Remove video priority, send both messages for mixed-media tweets

**Decision**: In `button.ts`, when a tweet has both video and images, send `download-video` AND `download-images` messages instead of only `download-video`.

**Rationale**: The simplest change — remove the early `return` at line 87 so execution continues to the image extraction logic. Both message handlers in the service worker are already independent and can run concurrently. No new message types or protocol changes needed.

**Alternative considered**: A single `download-all-media` message type that bundles both. Rejected because it would require changes to the message protocol, types, and service worker handler with no real benefit — the existing handlers already work independently.

### 2. Keep notifications per-download-type

**Decision**: Each download (images batch, video) triggers its own notification. No aggregation.

**Rationale**: The existing notification system works per-message. Aggregating notifications for mixed-media would add complexity for minimal UX gain. Users see "Downloading 3 image(s)..." and "Resolving video..." as separate notifications, which accurately reflects what's happening.

### 3. README as a static markdown file

**Decision**: Create a standard `README.md` at the project root covering overview, features, installation, development, architecture, and contributing.

**Rationale**: Standard practice. No tooling or generation needed — just a well-written document.

## Risks / Trade-offs

- **Concurrent download load**: Downloading images + video simultaneously doubles the number of downloads for mixed-media tweets. This is fine — Chrome's download manager handles concurrency natively and the extension already supports multiple concurrent image downloads.
- **Badge progress accuracy**: With both image and video downloads active, the badge percentage aggregates all tracked downloads, which already works correctly since `updateBadge()` iterates all entries in `activeDownloads`.
- **Double notification on start**: Users will see two "Starting download" notifications for mixed-media tweets (one for images, one for video). This is acceptable and informative.
