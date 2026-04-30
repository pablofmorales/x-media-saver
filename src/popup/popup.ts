import type {
  GetDownloadStatusRequest,
  GetDownloadHistoryRequest,
  DownloadStatusResponse,
  DownloadHistoryResponse,
  QueueEntry,
  DownloadHistoryEntry,
  QueueCancelRequest,
  QueueRetryRequest,
  QueuePauseRequest,
  QueueResumeRequest,
  AppSettings,
  GetSettingsRequest,
  SaveSettingsRequest,
} from "../shared/types";


const mainView = document.getElementById("main-view")!;
const settingsView = document.getElementById("settings-view")!;
const settingsBtn = document.getElementById("settings-btn")!;
const backBtn = document.getElementById("back-btn")!;

const activeSection = document.getElementById("active-section")!;
const activeContainer = document.getElementById("active-downloads")!;
const historySection = document.getElementById("history-section")!;
const historyContainer = document.getElementById("history-downloads")!;
const emptyState = document.getElementById("empty-state")!;

const folderInput = document.getElementById("download-folder") as HTMLInputElement;
const patternInput = document.getElementById("filename-pattern") as HTMLInputElement;
const notifyCheckbox = document.getElementById("enable-notifications") as HTMLInputElement;
const saveBtn = document.getElementById("save-settings-btn")!;
const saveStatus = document.getElementById("save-status")!;

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Queue control helpers
// ---------------------------------------------------------------------------

function sendQueueCancel(id: string): void {
  const msg: QueueCancelRequest = { type: "queue-cancel", id };
  chrome.runtime.sendMessage(msg);
}

function sendQueueRetry(id: string): void {
  const msg: QueueRetryRequest = { type: "queue-retry", id };
  chrome.runtime.sendMessage(msg);
}

function sendQueuePause(id?: string): void {
  const msg: QueuePauseRequest = { type: "queue-pause", id };
  chrome.runtime.sendMessage(msg);
}

function sendQueueResume(id?: string): void {
  const msg: QueueResumeRequest = { type: "queue-resume", id };
  chrome.runtime.sendMessage(msg);
}

// ---------------------------------------------------------------------------
// Render active downloads (queue entries grouped by status)
// ---------------------------------------------------------------------------

function renderActiveDownloads(
  entries: QueueEntry[],
  queuePaused: boolean
): void {
  // Filter to only show non-completed entries
  const visible = entries.filter((e) => e.status !== "completed");

  if (visible.length === 0) {
    activeSection.style.display = "none";
    activeContainer.innerHTML = "";
    return;
  }

  activeSection.style.display = "";
  activeContainer.innerHTML = "";

  // Global pause/resume toggle
  const hasActiveOrQueued = visible.some(
    (e) => e.status === "downloading" || e.status === "queued"
  );
  if (hasActiveOrQueued || queuePaused) {
    const globalToggle = document.createElement("button");
    globalToggle.className = queuePaused
      ? "queue-btn queue-btn-resume global-toggle"
      : "queue-btn queue-btn-pause global-toggle";
    globalToggle.textContent = queuePaused ? "Resume All" : "Pause All";
    globalToggle.addEventListener("click", () => {
      if (queuePaused) {
        sendQueueResume();
      } else {
        sendQueuePause();
      }
    });
    activeContainer.appendChild(globalToggle);
  }

  // Group by status: downloading first, then paused, then queued, then failed
  const statusOrder: QueueEntry["status"][] = [
    "downloading",
    "paused",
    "queued",
    "failed",
  ];
  const sorted = [...visible].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
  );

  // Compute queue positions for "queued" entries
  const queuedEntries = sorted.filter((e) => e.status === "queued");

  for (const entry of sorted) {
    const card = document.createElement("div");
    card.className = "download-card";

    // Header row: filename + action buttons
    const header = document.createElement("div");
    header.className = "download-card-header";

    const name = document.createElement("div");
    name.className = "download-filename";
    name.textContent = entry.filename;
    name.title = entry.filename;

    const actions = document.createElement("div");
    actions.className = "download-actions";

    // Pause/resume button for downloading/paused entries
    if (entry.status === "downloading" || entry.status === "paused") {
      const pauseResumeBtn = document.createElement("button");
      pauseResumeBtn.className =
        entry.status === "paused"
          ? "queue-btn queue-btn-resume"
          : "queue-btn queue-btn-pause";
      pauseResumeBtn.title =
        entry.status === "paused" ? "Resume" : "Pause";
      pauseResumeBtn.innerHTML =
        entry.status === "paused"
          ? '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>'
          : '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>';
      pauseResumeBtn.addEventListener("click", () => {
        if (entry.status === "paused") {
          sendQueueResume(entry.id);
        } else {
          sendQueuePause(entry.id);
        }
      });
      actions.appendChild(pauseResumeBtn);
    }

    // Retry button for failed entries
    if (entry.status === "failed") {
      const retryBtn = document.createElement("button");
      retryBtn.className = "queue-btn queue-btn-retry";
      retryBtn.title = "Retry";
      retryBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M13.6 2.4A7 7 0 1 0 15 8h-2a5 5 0 1 1-1-3l-2.5 2.5H15V2l-1.4.4z"/></svg>';
      retryBtn.addEventListener("click", () => {
        sendQueueRetry(entry.id);
      });
      actions.appendChild(retryBtn);
    }

    // Cancel button for all non-completed, non-failed entries
    if (
      entry.status === "downloading" ||
      entry.status === "queued" ||
      entry.status === "paused"
    ) {
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "queue-btn queue-btn-cancel";
      cancelBtn.title = "Cancel";
      cancelBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M12.2 3.8L8 8l4.2 4.2-1.4 1.4L6.6 9.4l-4.2 4.2-1.4-1.4L5.2 8 1 3.8l1.4-1.4L6.6 6.6l4.2-4.2 1.4 1.4z"/></svg>';
      cancelBtn.addEventListener("click", () => {
        sendQueueCancel(entry.id);
      });
      actions.appendChild(cancelBtn);
    }

    header.appendChild(name);
    header.appendChild(actions);
    card.appendChild(header);

    // Progress bar for downloading entries
    if (entry.status === "downloading") {
      const progress = (entry as any).progress ?? 0;
      const bar = document.createElement("div");
      bar.className = "progress-bar";
      const fill = document.createElement("div");
      fill.className = "progress-fill";
      fill.style.width = `${progress}%`;
      bar.appendChild(fill);
      card.appendChild(bar);

      const status = document.createElement("div");
      status.className = "download-status";
      status.textContent = `${progress}%`;
      card.appendChild(status);
    }

    // Paused state
    if (entry.status === "paused") {
      const bar = document.createElement("div");
      bar.className = "progress-bar";
      const fill = document.createElement("div");
      fill.className = "progress-fill paused";
      fill.style.width = `${(entry as any).progress ?? 0}%`;
      bar.appendChild(fill);
      card.appendChild(bar);

      const status = document.createElement("div");
      status.className = "download-status";
      status.textContent = "Paused";
      card.appendChild(status);
    }

    // Queue position for queued entries
    if (entry.status === "queued") {
      const queuePos = queuedEntries.indexOf(entry) + 1;
      const status = document.createElement("div");
      status.className = "download-status queue-position";
      status.textContent = `#${queuePos} in queue`;
      card.appendChild(status);
    }

    // Failed state with retry count
    if (entry.status === "failed") {
      const status = document.createElement("div");
      status.className = "download-status error-status";
      const retryText =
        entry.retryCount > 0 ? ` (retried ${entry.retryCount}x)` : "";
      status.textContent = `Failed${retryText}${entry.error ? ": " + entry.error : ""}`;
      card.appendChild(status);
    }

    activeContainer.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Render download history
// ---------------------------------------------------------------------------

function renderHistory(entries: DownloadHistoryEntry[]): void {
  if (entries.length === 0) {
    historySection.style.display = "none";
    historyContainer.innerHTML = "";
    return;
  }

  historySection.style.display = "";
  historyContainer.innerHTML = "";

  for (const entry of entries) {
    const card = document.createElement("div");
    card.className = "history-card";

    const info = document.createElement("div");
    info.className = "history-info";

    const name = document.createElement("div");
    name.className = "history-filename";
    name.textContent = entry.filename;
    name.title = entry.filename;

    const time = document.createElement("div");
    time.className = "history-time";
    time.textContent = formatRelativeTime(entry.completedAt);

    info.appendChild(name);
    info.appendChild(time);

    const btn = document.createElement("button");
    btn.className = "folder-btn";
    btn.innerHTML =
      '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">' +
      '<path d="M2 4a2 2 0 0 1 2-2h3.17a2 2 0 0 1 1.41.59l1.42 1.41H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z"/>' +
      "</svg> Open";
    btn.addEventListener("click", () => {
      chrome.downloads.show(entry.downloadId);
    });

    card.appendChild(info);
    card.appendChild(btn);
    historyContainer.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Settings logic
// ---------------------------------------------------------------------------

function showSettings(): void {
  mainView.style.display = "none";
  settingsView.style.display = "block";
  loadSettings();
}

function hideSettings(): void {
  settingsView.style.display = "none";
  mainView.style.display = "block";
}

function loadSettings(): void {
  const msg: GetSettingsRequest = { type: "get-settings" };
  chrome.runtime.sendMessage(msg, (settings: AppSettings) => {
    if (chrome.runtime.lastError || !settings) return;
    folderInput.value = settings.downloadFolder;
    patternInput.value = settings.filenamePattern;
    notifyCheckbox.checked = settings.enableNotifications;
  });
}

function saveSettings(): void {
  const settings: AppSettings = {
    downloadFolder: folderInput.value.trim(),
    filenamePattern: patternInput.value.trim(),
    enableNotifications: notifyCheckbox.checked,
  };

  const msg: SaveSettingsRequest = { type: "save-settings", settings };
  saveBtn.setAttribute("disabled", "true");

  chrome.runtime.sendMessage(msg, () => {
    saveBtn.removeAttribute("disabled");
    saveStatus.textContent = "Saved!";
    saveStatus.classList.add("show");
    setTimeout(() => {
      saveStatus.classList.remove("show");
    }, 2000);
  });
}

settingsBtn.addEventListener("click", showSettings);
backBtn.addEventListener("click", hideSettings);
saveBtn.addEventListener("click", saveSettings);

// ---------------------------------------------------------------------------
// Visibility logic
// ---------------------------------------------------------------------------

function updateVisibility(
  hasActive: boolean,
  hasHistory: boolean
): void {
  emptyState.style.display = !hasActive && !hasHistory ? "" : "none";
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

let lastActiveCount = 0;
let lastHistoryHtml = "";

function fetchActiveDownloads(): void {
  const msg: GetDownloadStatusRequest = { type: "get-download-status" };
  chrome.runtime.sendMessage(msg, (response: DownloadStatusResponse) => {
    if (chrome.runtime.lastError) return;
    const entries = response.entries ?? [];
    const queuePaused = response.queuePaused ?? false;
    const visible = entries.filter((e) => e.status !== "completed");
    lastActiveCount = visible.length;
    renderActiveDownloads(entries, queuePaused);
    updateVisibility(lastActiveCount > 0, lastHistoryHtml.length > 0);
  });
}

function fetchHistory(): void {
  const msg: GetDownloadHistoryRequest = { type: "get-download-history" };
  chrome.runtime.sendMessage(msg, (response: DownloadHistoryResponse) => {
    if (chrome.runtime.lastError) return;
    const entries = response.entries;
    lastHistoryHtml = entries.length > 0 ? "has" : "";
    renderHistory(entries);
    updateVisibility(lastActiveCount > 0, entries.length > 0);
  });
}

// ---------------------------------------------------------------------------
// Initial fetch & polling
// ---------------------------------------------------------------------------

fetchActiveDownloads();
fetchHistory();

// Poll active downloads; refresh history less frequently
setInterval(fetchActiveDownloads, 500);
setInterval(fetchHistory, 3000);
