## Why

The extension popup currently only shows active downloads with progress bars. Once a download completes, it disappears. Users have no way to see their recent download history or quickly navigate to saved files. Adding a download history section with a modern UI makes the popup genuinely useful beyond transient progress tracking.

## What Changes

- Add persistent download history tracking in `chrome.storage.local`, recording the last 10 completed downloads with filename, timestamp, and download path
- Redesign the popup UI with a modern, dark-themed aesthetic that matches X's design language — moving beyond the plain white/black appearance
- Display the 10 most recent downloads in the popup with filename, relative timestamp, and a clickable link to open the containing folder
- Service worker records completed downloads to storage instead of just discarding them after progress tracking ends

## Capabilities

### New Capabilities
- `download-history`: Persistent tracking and display of recent download history in the popup, including folder-open links

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **`src/popup/`**: Major redesign of popup HTML, CSS, and TypeScript — new history list UI, folder-open links, modern styling
- **`src/background/service-worker.ts`**: Add download completion recording to `chrome.storage.local`
- **`src/shared/types.ts`**: New `DownloadHistoryEntry` type
- **`manifest.json`**: No changes needed (already has `storage` and `downloads` permissions)
