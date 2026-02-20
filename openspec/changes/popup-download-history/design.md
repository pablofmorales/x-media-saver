## Context

The extension popup (`src/popup/`) currently shows only active, in-progress downloads via a 500ms polling loop against an in-memory `activeDownloads` Map in the service worker. Once a download completes or errors, it is removed from the Map and disappears from the popup entirely. The popup has minimal styling — plain white background, black text, basic progress bars.

Users want to see what they've downloaded recently and navigate to those files quickly. The popup needs to serve as both a live progress view and a lightweight download history.

## Goals / Non-Goals

**Goals:**
- Show the 10 most recent completed downloads in the popup, persisted across sessions
- Each history entry shows filename, relative time (e.g., "2 min ago"), and an "Open folder" link
- Modern, dark-themed UI consistent with X's design language (dark background, rounded cards, subtle borders)
- Active downloads section remains at the top with existing progress bar behavior

**Non-Goals:**
- Search or filtering within history
- Configurable history length (hardcode to 10)
- Clearing individual history entries (could be added later)
- Thumbnail previews of downloaded media

## Decisions

### 1. Storage: `chrome.storage.local` for history persistence

Store an array of `DownloadHistoryEntry` objects in `chrome.storage.local` under the key `"downloadHistory"`. Cap at 10 entries, FIFO eviction.

**Why not in-memory:** Service workers are ephemeral in MV3 — they get terminated and restarted. Storage survives restarts.

**Why not `chrome.storage.sync`:** History is device-local data, no need for cross-device sync. Local storage has a 10MB quota vs sync's 100KB.

### 2. Recording: service worker writes on download completion

Hook into the existing `chrome.downloads.onChanged` listener. When a download completes, query `chrome.downloads.search({ id })` to get the full file path, then push a `DownloadHistoryEntry` to storage.

**Entry shape:**
```ts
interface DownloadHistoryEntry {
  filename: string;       // Display name (e.g., "@user_123_video.mp4")
  fullPath: string;       // Absolute file path for folder-open
  completedAt: number;    // Date.now() timestamp
}
```

### 3. Folder-open: `chrome.downloads.showDefaultFolder()` + platform path

Use `chrome.downloads.show(downloadId)` if the download ID is still known. For history entries where the ID may no longer be valid, store the `fullPath` and open the containing folder via `chrome.downloads.showDefaultFolder()`. However, `showDefaultFolder()` only opens the default downloads folder, not arbitrary paths.

Better approach: store the `downloadId` alongside the entry. Use `chrome.downloads.show(downloadId)` which highlights the file in its containing folder. If the file has been moved/deleted, it will silently fail — acceptable behavior.

**Entry shape (revised):**
```ts
interface DownloadHistoryEntry {
  downloadId: number;     // Chrome download ID for show()
  filename: string;       // Display name
  completedAt: number;    // Timestamp
}
```

### 4. Popup UI structure: two sections with dark theme

```
┌──────────────────────────┐
│  ⬇ X Media Saver         │  Header with icon
├──────────────────────────┤
│  Active Downloads         │  Section (only if active)
│  ┌────────────────────┐  │
│  │ file.mp4   45%     │  │  Progress cards
│  │ ████████░░░░░░░░░  │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  Recent Downloads         │  Section
│  ┌────────────────────┐  │
│  │ video.mp4   2m ago │  │  History cards
│  │         📂 Open    │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ image.jpg   1h ago │  │
│  │         📂 Open    │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  No downloads yet         │  Empty state (only if both empty)
└──────────────────────────┘
```

**Dark theme colors** (matching X's palette):
- Background: `#15202b` (X dark blue)
- Card background: `#1e2d3d`
- Card border: `#2f3336`
- Primary text: `#e7e9ea`
- Secondary text: `#71767b`
- Accent: `#1d9bf0`

### 5. Message protocol: new `get-download-history` message type

Add a new message type so the popup can request history from storage via the service worker. This keeps storage access centralized in the service worker.

```ts
interface GetDownloadHistoryRequest {
  type: "get-download-history";
}

interface DownloadHistoryResponse {
  entries: DownloadHistoryEntry[];
}
```

## Risks / Trade-offs

- **Download ID invalidation**: `chrome.downloads.show()` may fail silently if the file was moved or deleted after download. Users will see no feedback → acceptable since the folder link is a convenience, not critical. Could add a subtle error toast later.
- **Storage quota**: 10 entries with small payloads is negligible (~1KB). No risk.
- **Popup width increase**: Moving from 300px to 340px for better card layout. Minor change, well within Chrome's popup limits.
