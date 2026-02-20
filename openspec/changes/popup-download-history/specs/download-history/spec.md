## ADDED Requirements

### Requirement: Download history persistence
The service worker SHALL persist the 10 most recent completed downloads to `chrome.storage.local` under the key `"downloadHistory"`. Each entry SHALL contain the Chrome download ID, display filename, and completion timestamp. When a new entry is added and the list exceeds 10 entries, the oldest entry SHALL be evicted.

#### Scenario: Download completes and is recorded
- **WHEN** a tracked download transitions to state "complete"
- **THEN** the service worker SHALL create a `DownloadHistoryEntry` with the download's ID, filename, and current timestamp, and prepend it to the `"downloadHistory"` array in `chrome.storage.local`

#### Scenario: History exceeds 10 entries
- **WHEN** a new entry is added and the stored array length exceeds 10
- **THEN** the service worker SHALL trim the array to the 10 most recent entries (by `completedAt` descending)

#### Scenario: Service worker restarts
- **WHEN** the service worker restarts after termination
- **THEN** the download history SHALL still be available from `chrome.storage.local` without data loss

### Requirement: Download history retrieval
The service worker SHALL respond to `get-download-history` messages by reading the `"downloadHistory"` array from `chrome.storage.local` and returning it to the sender.

#### Scenario: Popup requests download history
- **WHEN** the popup sends a message with `type: "get-download-history"`
- **THEN** the service worker SHALL respond with `{ entries: DownloadHistoryEntry[] }` containing the stored history, ordered most recent first

#### Scenario: No history exists
- **WHEN** the popup sends `get-download-history` and no history is stored
- **THEN** the service worker SHALL respond with `{ entries: [] }`

### Requirement: Popup displays recent downloads
The popup SHALL display the 10 most recent completed downloads in a "Recent Downloads" section below any active downloads. Each history entry SHALL show the filename and a human-readable relative timestamp.

#### Scenario: History entries displayed
- **WHEN** the popup opens and download history exists
- **THEN** the popup SHALL render each entry showing the filename and relative time (e.g., "2 min ago", "1 hour ago", "3 days ago")

#### Scenario: No history and no active downloads
- **WHEN** the popup opens with no active downloads and no history
- **THEN** the popup SHALL display an empty state message "No downloads yet"

#### Scenario: Active downloads present with history
- **WHEN** both active downloads and history entries exist
- **THEN** active downloads SHALL appear in an "Active Downloads" section above the "Recent Downloads" section

### Requirement: Open containing folder
Each download history entry SHALL include a clickable action to open the containing folder of the downloaded file using `chrome.downloads.show()`.

#### Scenario: User clicks open folder
- **WHEN** the user clicks the "Open folder" action on a history entry
- **THEN** the popup SHALL call `chrome.downloads.show(downloadId)` to highlight the file in its containing folder in the system file manager

#### Scenario: File no longer exists
- **WHEN** the user clicks "Open folder" and the file has been moved or deleted
- **THEN** the action SHALL fail silently without crashing the popup

### Requirement: Modern dark-themed popup UI
The popup SHALL use a dark-themed design consistent with X's visual language. The background SHALL be dark (`#15202b`), with card-based layout for download items, rounded corners, and X's standard color palette for text and accents.

#### Scenario: Popup opens with dark theme
- **WHEN** the user clicks the extension icon
- **THEN** the popup SHALL render with a dark background, light text (`#e7e9ea`), and card-style containers with subtle borders (`#2f3336`)

#### Scenario: Visual consistency with X
- **WHEN** the popup is displayed
- **THEN** it SHALL use X's accent blue (`#1d9bf0`) for interactive elements, green (`#00ba7c`) for success states, and red (`#f4212e`) for error states
