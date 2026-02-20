import type {
  GetDownloadStatusRequest,
  DownloadStatusResponse,
  DownloadProgressInfo,
} from "../shared/types";

const container = document.getElementById("downloads")!;
const emptyState = document.getElementById("empty-state")!;

function renderDownloads(downloads: DownloadProgressInfo[]): void {
  if (downloads.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "";
    return;
  }

  emptyState.style.display = "none";
  container.innerHTML = "";

  for (const dl of downloads) {
    const item = document.createElement("div");
    item.className = "download-item";

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

    item.appendChild(name);
    item.appendChild(bar);
    item.appendChild(status);
    container.appendChild(item);
  }
}

function poll(): void {
  const msg: GetDownloadStatusRequest = { type: "get-download-status" };
  chrome.runtime.sendMessage(msg, (response: DownloadStatusResponse) => {
    if (chrome.runtime.lastError) return;
    renderDownloads(response.downloads);
  });
}

// Poll while popup is open
poll();
setInterval(poll, 500);
