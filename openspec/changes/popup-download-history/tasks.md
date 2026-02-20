## 1. Types & Message Protocol

- [x] 1.1 Add `DownloadHistoryEntry` interface to `src/shared/types.ts` with fields: `downloadId` (number), `filename` (string), `completedAt` (number)
- [x] 1.2 Add `GetDownloadHistoryRequest` and `DownloadHistoryResponse` types to `src/shared/types.ts` and include in the `MessageRequest` union

## 2. Service Worker — History Persistence

- [x] 2.1 Add a `saveToHistory(downloadId, filename)` function in `src/background/service-worker.ts` that reads `"downloadHistory"` from `chrome.storage.local`, prepends the new entry, trims to 10, and writes back
- [x] 2.2 Call `saveToHistory()` in the `chrome.downloads.onChanged` listener when a tracked download completes (state === "complete")
- [x] 2.3 Handle the `get-download-history` message type in the message listener — read from `chrome.storage.local` and respond with `{ entries }`

## 3. Popup — UI Redesign & History Display

- [x] 3.1 Update `src/popup/popup.html` with two sections: "Active Downloads" and "Recent Downloads", plus updated empty state
- [x] 3.2 Rewrite `src/popup/popup.css` with dark theme (`#15202b` background, card-based layout, rounded corners, X color palette)
- [x] 3.3 Update `src/popup/popup.ts` to fetch and render download history from `get-download-history` message on popup open
- [x] 3.4 Add relative time formatting (e.g., "2 min ago", "1 hour ago") for history entry timestamps
- [x] 3.5 Add "Open folder" button per history entry that calls `chrome.downloads.show(downloadId)`
- [x] 3.6 Handle empty states: show "No downloads yet" when both sections are empty, hide section headers when a section has no items

## 4. Verification

- [x] 4.1 Build the extension with `npm run build` and verify no TypeScript errors
