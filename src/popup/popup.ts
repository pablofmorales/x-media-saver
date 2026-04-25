import type {
  GetDownloadStatusRequest,
  GetDownloadHistoryRequest,
  DownloadStatusResponse,
  DownloadHistoryResponse,
  DownloadProgressInfo,
  DownloadHistoryEntry,
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
// Render active downloads
// ---------------------------------------------------------------------------

function renderActiveDownloads(downloads: DownloadProgressInfo[]): void {
  if (downloads.length === 0) {
    activeSection.style.display = "none";
    activeContainer.innerHTML = "";
    return;
  }

  activeSection.style.display = "";
  activeContainer.innerHTML = "";

  for (const dl of downloads) {
    const card = document.createElement("div");
    card.className = "download-card";

    const name = document.createElement("div");
    name.className = "download-filename";
    name.textContent = dl.filename;
    name.title = dl.filename;

    const bar = document.createElement("div");
    bar.className = "progress-bar";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    if (dl.state === "complete") fill.classList.add("complete");
    if (dl.state === "interrupted") fill.classList.add("error");
    fill.style.width = `${dl.progress}%`;

    bar.appendChild(fill);

    const status = document.createElement("div");
    status.className = "download-status";
    if (dl.state === "interrupted") {
      status.textContent = `Error: ${dl.error ?? "download interrupted"}`;
    } else if (dl.state === "complete") {
      status.textContent = "Complete";
    } else {
      status.textContent = `${dl.progress}%`;
    }

    card.appendChild(name);
    card.appendChild(bar);
    card.appendChild(status);
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
  emptyState.style.display =
    !hasActive && !hasHistory ? "" : "none";
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
    const downloads = response.downloads;
    lastActiveCount = downloads.length;
    renderActiveDownloads(downloads);
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

// Initial fetch
fetchActiveDownloads();
fetchHistory();

// Poll active downloads; refresh history less frequently
setInterval(fetchActiveDownloads, 500);
setInterval(fetchHistory, 3000);
