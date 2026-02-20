import type {
  MessageRequest,
  DownloadProgressInfo,
  DownloadStatusResponse,
  DownloadHistoryEntry,
  DownloadHistoryResponse,
} from "../shared/types";
import { EXTENSION_NAME } from "../shared/constants";
import { resolveVideoUrl } from "./api";
import { resolveRedditVideoUrl, resolveRedditGalleryUrls, resolveRedditImageUrl } from "./reddit-api";

// ---------------------------------------------------------------------------
// Notification helper
// ---------------------------------------------------------------------------

function notify(title: string, message: string): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title: `${EXTENSION_NAME}: ${title}`,
    message,
  });
}

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
// Download history persistence
// ---------------------------------------------------------------------------

const HISTORY_KEY = "downloadHistory";
const HISTORY_MAX = 10;

async function saveToHistory(
  downloadId: number,
  filename: string
): Promise<void> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  const history = (result[HISTORY_KEY] as DownloadHistoryEntry[] | undefined) ?? [];
  history.unshift({ downloadId, filename, completedAt: Date.now() });
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
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
      console.log(`[${EXTENSION_NAME}] Download complete: ${meta.filename}`);
      notify("Download finished", meta.filename);
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#00ba7c" });
      saveToHistory(delta.id, meta.filename);
      untrackDownload(delta.id);
    }

    if (delta.state.current === "interrupted") {
      const errorMsg = delta.error?.current ?? "unknown error";
      console.error(
        `[${EXTENSION_NAME}] Download failed: ${meta.filename} — ${errorMsg}`
      );
      notify("Error", `${meta.filename} — ${errorMsg}`);
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
      console.log(`[${EXTENSION_NAME}] Received download-images request`, message.images);
      notify("Starting download", `Downloading ${message.images.length} image(s)...`);
      try {
        let success = false;
        for (const image of message.images) {
          chrome.downloads.download(
            {
              url: image.url,
              filename: image.filename,
              conflictAction: "uniquify",
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message ?? "unknown error";
                console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                notify("Error", err);
                return;
              }
              if (downloadId !== undefined) {
                trackDownload(downloadId, image.filename);
              }
            }
          );
        }
        sendResponse({ success: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${EXTENSION_NAME}] download-images error: ${msg}`);
        notify("Error", msg);
        sendResponse({ success: false, error: msg });
      }
      return false; // synchronous sendResponse
    }

    if (message.type === "download-video") {
      const { tweetId, username } = message;
      const filename = `@${username}_${tweetId}_video.mp4`;
      console.log(`[${EXTENSION_NAME}] Received download-video request for tweet ${tweetId}`);
      notify("Starting download", `Resolving video for tweet ${tweetId}...`);

      resolveVideoUrl(tweetId)
        .then((videoUrl) => {
          if (!videoUrl) {
            const errMsg = `Could not resolve video URL for tweet ${tweetId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (activeDownloads.size === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          chrome.downloads.download(
            {
              url: videoUrl,
              filename,
              conflictAction: "uniquify",
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message ?? "unknown error";
                console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                notify("Error", err);
                sendResponse({ success: false, error: err });
                return;
              }
              if (downloadId !== undefined) {
                trackDownload(downloadId, filename);
                sendResponse({ success: true });
              } else {
                const errMsg = `Failed to start download for ${filename}`;
                console.error(`[${EXTENSION_NAME}] ${errMsg}`);
                notify("Error", errMsg);
                chrome.action.setBadgeText({ text: "ERR" });
                chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
                sendResponse({ success: false, error: errMsg });
              }
            }
          );
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${EXTENSION_NAME}] download-video error: ${msg}`);
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true; // async sendResponse
    }

    if (message.type === "download-reddit-video") {
      const { postUrl, subreddit, postId } = message;
      const filename = `r-${subreddit}_${postId}_video.mp4`;
      console.log(`[${EXTENSION_NAME}] Received download-reddit-video request for ${postUrl}`);
      notify("Starting download", `Resolving Reddit video...`);

      resolveRedditVideoUrl(postUrl)
        .then((videoUrl) => {
          if (!videoUrl) {
            const errMsg = `Could not resolve video URL for Reddit post ${postId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (activeDownloads.size === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          chrome.downloads.download(
            {
              url: videoUrl,
              filename,
              conflictAction: "uniquify",
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message ?? "unknown error";
                console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                notify("Error", err);
                sendResponse({ success: false, error: err });
                return;
              }
              if (downloadId !== undefined) {
                trackDownload(downloadId, filename);
                sendResponse({ success: true });
              } else {
                const errMsg = `Failed to start download for ${filename}`;
                console.error(`[${EXTENSION_NAME}] ${errMsg}`);
                notify("Error", errMsg);
                sendResponse({ success: false, error: errMsg });
              }
            }
          );
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${EXTENSION_NAME}] download-reddit-video error: ${msg}`);
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true; // async sendResponse
    }

    if (message.type === "download-reddit-gallery") {
      const { postUrl, subreddit, postId } = message;
      console.log(`[${EXTENSION_NAME}] Received download-reddit-gallery request for ${postUrl}`);
      notify("Starting download", `Resolving Reddit gallery...`);

      resolveRedditGalleryUrls(postUrl)
        .then((galleryImages) => {
          if (!galleryImages || galleryImages.length === 0) {
            const errMsg = `Could not resolve gallery images for Reddit post ${postId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (activeDownloads.size === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          // Build filenames for all images
          const filenames = galleryImages.map(
            (img, i) => `r-${subreddit}_${postId}_${i + 1}.${img.extension}`
          );

          // Single-image gallery: just use saveAs directly
          if (galleryImages.length === 1) {
            chrome.downloads.download(
              {
                url: galleryImages[0].url,
                filename: filenames[0],
                saveAs: true,
                conflictAction: "uniquify",
              },
              (downloadId) => {
                if (chrome.runtime.lastError) {
                  const err = chrome.runtime.lastError.message ?? "unknown error";
                  console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                  notify("Error", err);
                  return;
                }
                if (downloadId !== undefined) {
                  trackDownload(downloadId, filenames[0]);
                }
              }
            );
            sendResponse({ success: true });
            return;
          }

          // Multi-image gallery: prompt for folder on first image,
          // then download the rest to the same folder
          notify("Downloading", `${galleryImages.length} image(s) from gallery — pick a save location`);

          chrome.downloads.download(
            {
              url: galleryImages[0].url,
              filename: filenames[0],
              saveAs: true,
              conflictAction: "uniquify",
            },
            (firstDownloadId) => {
              if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message ?? "unknown error";
                console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                notify("Error", err);
                return;
              }
              if (firstDownloadId === undefined) return;

              trackDownload(firstDownloadId, filenames[0]);

              // Listen for the first download's filename to be determined
              // (user confirmed Save As dialog) or cancellation
              const onFirstDownloadChanged = (delta: chrome.downloads.DownloadDelta) => {
                if (delta.id !== firstDownloadId) return;

                // User cancelled the Save As dialog
                if (delta.state?.current === "interrupted" || delta.error) {
                  chrome.downloads.onChanged.removeListener(onFirstDownloadChanged);
                  notify("Cancelled", "Gallery download cancelled");
                  return;
                }

                // Filename determined — extract folder and download remaining images
                if (delta.filename?.current) {
                  chrome.downloads.onChanged.removeListener(onFirstDownloadChanged);
                  const fullPath = delta.filename.current;
                  const sepIndex = Math.max(fullPath.lastIndexOf("/"), fullPath.lastIndexOf("\\"));
                  const folder = sepIndex >= 0 ? fullPath.substring(0, sepIndex) : "";

                  for (let i = 1; i < galleryImages.length; i++) {
                    const remainingFilename = folder
                      ? `${folder}/${filenames[i]}`
                      : filenames[i];

                    chrome.downloads.download(
                      {
                        url: galleryImages[i].url,
                        filename: remainingFilename,
                        conflictAction: "uniquify",
                      },
                      (downloadId) => {
                        if (chrome.runtime.lastError) {
                          const err = chrome.runtime.lastError.message ?? "unknown error";
                          console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                          notify("Error", err);
                          return;
                        }
                        if (downloadId !== undefined) {
                          trackDownload(downloadId, filenames[i]);
                        }
                      }
                    );
                  }
                }
              };

              chrome.downloads.onChanged.addListener(onFirstDownloadChanged);
            }
          );

          sendResponse({ success: true });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${EXTENSION_NAME}] download-reddit-gallery error: ${msg}`);
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true; // async sendResponse
    }

    if (message.type === "download-reddit-image") {
      const { postUrl, subreddit, postId } = message;
      console.log(`[${EXTENSION_NAME}] Received download-reddit-image request for ${postUrl}`);
      notify("Starting download", `Resolving Reddit image...`);

      resolveRedditImageUrl(postUrl)
        .then((imageInfo) => {
          if (!imageInfo) {
            const errMsg = `Could not resolve image URL for Reddit post ${postId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (activeDownloads.size === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          const filename = `r-${subreddit}_${postId}.${imageInfo.extension}`;

          chrome.downloads.download(
            {
              url: imageInfo.url,
              filename,
              conflictAction: "uniquify",
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message ?? "unknown error";
                console.error(`[${EXTENSION_NAME}] Download API error: ${err}`);
                notify("Error", err);
                sendResponse({ success: false, error: err });
                return;
              }
              if (downloadId !== undefined) {
                trackDownload(downloadId, filename);
                sendResponse({ success: true });
              } else {
                const errMsg = `Failed to start download for ${filename}`;
                console.error(`[${EXTENSION_NAME}] ${errMsg}`);
                notify("Error", errMsg);
                sendResponse({ success: false, error: errMsg });
              }
            }
          );
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${EXTENSION_NAME}] download-reddit-image error: ${msg}`);
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true; // async sendResponse
    }

    if (message.type === "get-download-history") {
      chrome.storage.local.get(HISTORY_KEY, (result) => {
        const entries = (result[HISTORY_KEY] as DownloadHistoryEntry[] | undefined) ?? [];
        sendResponse({ entries } satisfies DownloadHistoryResponse);
      });
      return true; // async sendResponse
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
