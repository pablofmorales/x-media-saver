import type {
  MessageRequest,
  DownloadProgressInfo,
  DownloadStatusResponse,
} from "../shared/types";
import { resolveVideoUrl } from "./api";

/** Active downloads being tracked: downloadId → metadata */
const activeDownloads = new Map<number, { filename: string }>();

/** Polling interval handle for progress updates */
let progressInterval: ReturnType<typeof setInterval> | null = null;

const POLL_MS = 500;

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function updateBadge(): void {
  if (activeDownloads.size === 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  // Query all tracked downloads to compute aggregate progress
  const ids = [...activeDownloads.keys()];
  chrome.downloads.search({ id: ids[0] }, () => {
    // Search each tracked download individually so we can aggregate
    let totalBytes = 0;
    let receivedBytes = 0;
    let pending = ids.length;

    for (const id of ids) {
      chrome.downloads.search({ id }, (results) => {
        if (results && results.length > 0) {
          const item = results[0];
          if (item.totalBytes > 0) {
            totalBytes += item.totalBytes;
            receivedBytes += item.bytesReceived;
          }
        }
        pending--;
        if (pending === 0) {
          const pct =
            totalBytes > 0
              ? Math.round((receivedBytes / totalBytes) * 100)
              : 0;
          chrome.action.setBadgeText({ text: `${pct}%` });
          chrome.action.setBadgeBackgroundColor({ color: "#1d9bf0" });
        }
      });
    }
  });
}

function startProgressPolling(): void {
  if (progressInterval) return;
  progressInterval = setInterval(updateBadge, POLL_MS);
}

function stopProgressPolling(): void {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Download tracking
// ---------------------------------------------------------------------------

function trackDownload(downloadId: number, filename: string): void {
  activeDownloads.set(downloadId, { filename });
  startProgressPolling();
  updateBadge();
}

function untrackDownload(downloadId: number): void {
  activeDownloads.delete(downloadId);
  if (activeDownloads.size === 0) {
    stopProgressPolling();
    // Clear badge after a short delay so user can see 100%
    setTimeout(() => {
      if (activeDownloads.size === 0) {
        chrome.action.setBadgeText({ text: "" });
      }
    }, 1500);
  }
}

// ---------------------------------------------------------------------------
// chrome.downloads.onChanged — detect completion and errors
// ---------------------------------------------------------------------------

chrome.downloads.onChanged.addListener((delta) => {
  if (!activeDownloads.has(delta.id)) return;

  if (delta.state) {
    const meta = activeDownloads.get(delta.id)!;

    if (delta.state.current === "complete") {
      console.log(`[X Media Saver] Download complete: ${meta.filename}`);
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#00ba7c" });
      untrackDownload(delta.id);
    }

    if (delta.state.current === "interrupted") {
      const errorMsg = delta.error?.current ?? "unknown error";
      console.error(
        `[X Media Saver] Download failed: ${meta.filename} — ${errorMsg}`
      );
      chrome.action.setBadgeText({ text: "ERR" });
      chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
      untrackDownload(delta.id);
    }
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: MessageRequest, _sender, sendResponse) => {
    if (message.type === "download-images") {
      for (const image of message.images) {
        chrome.downloads.download(
          {
            url: image.url,
            filename: image.filename,
            conflictAction: "uniquify",
          },
          (downloadId) => {
            if (downloadId !== undefined) {
              trackDownload(downloadId, image.filename);
            }
          }
        );
      }
    }

    if (message.type === "download-video") {
      const { tweetId, username } = message;
      const filename = `@${username}_${tweetId}_video.mp4`;

      resolveVideoUrl(tweetId).then((videoUrl) => {
        if (!videoUrl) {
          console.error(
            `[X Media Saver] Could not resolve video URL for tweet ${tweetId}`
          );
          chrome.action.setBadgeText({ text: "ERR" });
          chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
          setTimeout(() => {
            if (activeDownloads.size === 0) {
              chrome.action.setBadgeText({ text: "" });
            }
          }, 3000);
          return;
        }

        chrome.downloads.download(
          {
            url: videoUrl,
            filename,
            conflictAction: "uniquify",
          },
          (downloadId) => {
            if (downloadId !== undefined) {
              trackDownload(downloadId, filename);
            } else {
              console.error(
                `[X Media Saver] Failed to start download for ${filename}`
              );
              chrome.action.setBadgeText({ text: "ERR" });
              chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            }
          }
        );
      });
    }

    if (message.type === "get-download-status") {
      // Async response — gather progress for all active downloads
      const ids = [...activeDownloads.keys()];
      if (ids.length === 0) {
        sendResponse({ downloads: [] } satisfies DownloadStatusResponse);
        return false;
      }

      let pending = ids.length;
      const infos: DownloadProgressInfo[] = [];

      for (const id of ids) {
        chrome.downloads.search({ id }, (results) => {
          if (results && results.length > 0) {
            const item = results[0];
            const meta = activeDownloads.get(id);
            infos.push({
              id,
              filename: meta?.filename ?? item.filename,
              progress:
                item.totalBytes > 0
                  ? Math.round((item.bytesReceived / item.totalBytes) * 100)
                  : 0,
              state: item.state as DownloadProgressInfo["state"],
              error: item.error,
            });
          }
          pending--;
          if (pending === 0) {
            sendResponse({ downloads: infos } satisfies DownloadStatusResponse);
          }
        });
      }

      return true; // keep message channel open for async sendResponse
    }
  }
);
