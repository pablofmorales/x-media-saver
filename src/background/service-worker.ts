import type {
  MessageRequest,
  DownloadStatusResponse,
  DownloadHistoryEntry,
  DownloadHistoryResponse,
  AppSettings,
  SaveSettingsRequest,
  GetSettingsRequest,
} from "../shared/types";
import { EXTENSION_NAME, SETTINGS_KEY, DEFAULT_SETTINGS } from "../shared/constants";
import { resolveVideoUrl } from "./api";
import {
  resolveRedditVideoUrl,
  resolveRedditGalleryUrls,
  resolveRedditImageUrl,
  resolveRedditGifUrl,
} from "./reddit-api";
import { resolveInstagramMedia } from "./instagram-api";
import { resolveEmbedUrl } from "./embed-resolvers";
import { DownloadQueue } from "./download-queue";


// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = result[SETTINGS_KEY] as Partial<AppSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

function formatFilename(
  pattern: string,
  folder: string,
  vars: { username: string; tweetId: string; index?: number; date?: string; ext: string }
): string {
  let name = pattern
    .replace(/{username}/g, vars.username)
    .replace(/{tweetId}/g, vars.tweetId)
    .replace(/{index}/g, vars.index !== undefined ? String(vars.index) : "")
    .replace(/{date}/g, vars.date ?? new Date().toISOString().split("T")[0]);

  name = name.replace(/-+/g, "-").replace(/^-|-$/g, "");
  const subfolder = folder.trim();
  return subfolder ? `${subfolder}/${name}.${vars.ext}` : `${name}.${vars.ext}`;
}

// ---------------------------------------------------------------------------
// Notification helper
// ---------------------------------------------------------------------------

async function notify(title: string, message: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.enableNotifications) return;

  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title: `${EXTENSION_NAME}: ${title}`,
    message,
  });
}

// ---------------------------------------------------------------------------
// Download queue instance
// ---------------------------------------------------------------------------

const queue = new DownloadQueue();

// Restore queue state on service worker startup
queue.restore();

// Update download folder when the user changes the setting
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.downloadFolder) {
    queue.downloadFolder = (changes.downloadFolder.newValue as string) ?? "";
  }
});

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const POLL_MS = 500;
let progressInterval: ReturnType<typeof setInterval> | null = null;

function updateBadge(): void {
  if (queue.activeCount === 0 && queue.queuedCount === 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  // Show queued count if nothing is actively downloading
  if (queue.activeCount === 0 && queue.queuedCount > 0) {
    chrome.action.setBadgeText({ text: `${queue.queuedCount}` });
    chrome.action.setBadgeBackgroundColor({ color: "#71767b" });
    return;
  }

  // Aggregate progress of downloading entries
  const { entries } = queue.getStatus();
  const downloading = entries.filter((e) => e.status === "downloading");
  const ids = downloading
    .map((e) => e.chromeDownloadId)
    .filter((id): id is number => id !== undefined);

  if (ids.length === 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

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
        const queuedSuffix =
          queue.queuedCount > 0 ? `+${queue.queuedCount}` : "";
        chrome.action.setBadgeText({ text: `${pct}%${queuedSuffix}` });
        chrome.action.setBadgeBackgroundColor({ color: "#1d9bf0" });
      }
    });
  }
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

function refreshPolling(): void {
  if (queue.activeCount > 0 || queue.queuedCount > 0) {
    startProgressPolling();
  } else {
    stopProgressPolling();
    setTimeout(() => {
      if (queue.activeCount === 0 && queue.queuedCount === 0) {
        chrome.action.setBadgeText({ text: "" });
      }
    }, 1500);
  }
  updateBadge();
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
  const history =
    (result[HISTORY_KEY] as DownloadHistoryEntry[] | undefined) ?? [];
  history.unshift({ downloadId, filename, completedAt: Date.now() });
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

// ---------------------------------------------------------------------------
// chrome.downloads.onChanged — route events to queue
// ---------------------------------------------------------------------------

chrome.downloads.onChanged.addListener((delta) => {
  const entry = queue.findByChromeId(delta.id);
  if (!entry) return;

  if (delta.state) {
    if (delta.state.current === "complete") {
      console.log(
        `[${EXTENSION_NAME}] Download complete: ${entry.filename}`
      );
      notify("Download finished", entry.filename);
      chrome.action.setBadgeText({ text: "\u2713" });
      chrome.action.setBadgeBackgroundColor({ color: "#00ba7c" });
      saveToHistory(delta.id, entry.filename);
      queue.onDownloadComplete(delta.id).then(() => refreshPolling());
    }

    if (delta.state.current === "interrupted") {
      const errorMsg = delta.error?.current ?? "unknown error";
      console.error(
        `[${EXTENSION_NAME}] Download failed: ${entry.filename} — ${errorMsg}`
      );
      queue
        .onDownloadInterrupted(delta.id, errorMsg)
        .then((updatedEntry) => {
          if (updatedEntry && updatedEntry.status === "failed") {
            notify("Error", `${entry.filename} — ${errorMsg}`);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
          }
          refreshPolling();
        });
    }
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: MessageRequest, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    if (message.type === "get-settings") {
      getSettings().then(sendResponse);
      return true;
    }

    if (message.type === "save-settings") {
      saveSettings(message.settings).then(() => sendResponse({ success: true }));
      return true;
    }

    if (message.type === "download-images") {
      getSettings().then((settings) => {
        console.log(`[${EXTENSION_NAME}] Received download-images request`, message.images);
        notify("Starting download", `Downloading ${message.images.length} image(s)...`);
        try {
          message.images.forEach((image, index) => {
            const ext = image.url.split(".").pop()?.split("?")[0]?.split(":")[0] ?? "jpg";
            const filename = image.filename || formatFilename(settings.filenamePattern, settings.downloadFolder, {
              username: message.username,
              tweetId: message.tweetId,
              index: message.images.length > 1 ? index + 1 : undefined,
              ext,
            });
            queue.enqueue(image.url, filename, "twitter").then(() => {
              refreshPolling();
            });
          });
          sendResponse({ success: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${EXTENSION_NAME}] download-images error: ${msg}`);
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        }
      });
      return true;
    }

    if (message.type === "download-video") {
      const { tweetId, username } = message;
      getSettings().then(settings => {
        const filename = formatFilename(settings.filenamePattern, settings.downloadFolder, { username, tweetId, ext: "mp4" });
      console.log(
        `[${EXTENSION_NAME}] Received download-video request for tweet ${tweetId}`
      );
      notify(
        "Starting download",
        `Resolving video for tweet ${tweetId}...`
      );

      resolveVideoUrl(tweetId)
        .then((videoUrl) => {
          if (!videoUrl) {
            const errMsg = `Could not resolve video URL for tweet ${tweetId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (queue.activeCount === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          queue.enqueue(videoUrl, filename, "twitter").then(() => {
            refreshPolling();
            sendResponse({ success: true });
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[${EXTENSION_NAME}] download-video error: ${msg}`
          );
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      });
      return true;
    }

    if (message.type === "download-reddit-video") {
      const { postUrl, subreddit, postId } = message;
      const filename = `r-${subreddit}_${postId}_video.mp4`;
      console.log(
        `[${EXTENSION_NAME}] Received download-reddit-video request for ${postUrl}`
      );
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
              if (queue.activeCount === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          queue.enqueue(videoUrl, filename, "reddit").then(() => {
            refreshPolling();
            sendResponse({ success: true });
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[${EXTENSION_NAME}] download-reddit-video error: ${msg}`
          );
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }

    if (message.type === "download-reddit-gallery") {
      const { postUrl, subreddit, postId } = message;
      console.log(
        `[${EXTENSION_NAME}] Received download-reddit-gallery request for ${postUrl}`
      );
      notify("Starting download", `Resolving Reddit gallery...`);

      resolveRedditGalleryUrls(postUrl)
        .then(async (galleryImages) => {
          if (!galleryImages || galleryImages.length === 0) {
            const errMsg = `Could not resolve gallery images for Reddit post ${postId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (queue.activeCount === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          for (let i = 0; i < galleryImages.length; i++) {
            const img = galleryImages[i];
            const filename = `r-${subreddit}_${postId}_${i + 1}.${img.extension}`;
            await queue.enqueue(img.url, filename, "reddit");
          }

          refreshPolling();
          sendResponse({ success: true });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[${EXTENSION_NAME}] download-reddit-gallery error: ${msg}`
          );
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }

    if (message.type === "download-reddit-image") {
      const { postUrl, subreddit, postId } = message;
      console.log(
        `[${EXTENSION_NAME}] Received download-reddit-image request for ${postUrl}`
      );
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
              if (queue.activeCount === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          const filename = `r-${subreddit}_${postId}.${imageInfo.extension}`;
          queue.enqueue(imageInfo.url, filename, "reddit").then(() => {
            refreshPolling();
            sendResponse({ success: true });
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[${EXTENSION_NAME}] download-reddit-image error: ${msg}`
          );
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }

    if (message.type === "download-reddit-gif") {
      const { postUrl, subreddit, postId } = message;
      const filename = `r-${subreddit}_${postId}_gif.mp4`;
      console.log(
        `[${EXTENSION_NAME}] Received download-reddit-gif request for ${postUrl}`
      );
      notify("Starting download", `Resolving Reddit GIF...`);

      resolveRedditGifUrl(postUrl)
        .then((gifUrl) => {
          if (!gifUrl) {
            const errMsg = `Could not resolve GIF URL for Reddit post ${postId}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (queue.activeCount === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          queue.enqueue(gifUrl, filename, "reddit").then(() => {
            refreshPolling();
            sendResponse({ success: true });
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[${EXTENSION_NAME}] download-reddit-gif error: ${msg}`
          );
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }

    if (message.type === "download-reddit-embed") {
      const { postUrl, embedUrl, subreddit, postId } = message;
      console.log(
        `[${EXTENSION_NAME}] Received download-reddit-embed request for ${embedUrl}`
      );
      notify("Starting download", `Resolving embedded media...`);

      resolveEmbedUrl(embedUrl)
        .then((result) => {
          if (!result) {
            const errMsg = `Could not resolve embed URL: ${embedUrl}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            notify("Error", errMsg);
            chrome.action.setBadgeText({ text: "ERR" });
            chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            setTimeout(() => {
              if (queue.activeCount === 0) {
                chrome.action.setBadgeText({ text: "" });
              }
            }, 3000);
            sendResponse({ success: false, error: errMsg });
            return;
          }

          // Determine platform for filename suffix
          let platform = "embed";
          try {
            const hostname = new URL(embedUrl).hostname.replace(/^www\./, "");
            if (hostname.includes("imgur")) platform = "imgur";
            else if (hostname.includes("redgifs")) platform = "redgifs";
          } catch {
            // keep default
          }

          const filename = `r-${subreddit}_${postId}_${platform}.${result.extension}`;
          queue.enqueue(result.url, filename, "reddit").then(() => {
            refreshPolling();
            sendResponse({ success: true });
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[${EXTENSION_NAME}] download-reddit-embed error: ${msg}`
          );
          notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }

    if (message.type === "download-instagram") {
      const { url, username, shortcode, mediaType, downloadThumbnail } = message;
      const suffix = downloadThumbnail ? "_thumbnail" : "";
      console.log(
        `[${EXTENSION_NAME}] Received download-instagram request for ${url} (thumb: ${downloadThumbnail})`
      );
      
      if (!downloadThumbnail) {
        notify("Starting download", `Resolving Instagram ${mediaType}...`);
      }

      resolveInstagramMedia(url, downloadThumbnail)
        .then((result) => {
          if (!result) {
            const errMsg = `Could not resolve Instagram ${mediaType} ${shortcode}`;
            console.error(`[${EXTENSION_NAME}] ${errMsg}`);
            if (!downloadThumbnail) {
                notify("Error", errMsg);
                chrome.action.setBadgeText({ text: "ERR" });
                chrome.action.setBadgeBackgroundColor({ color: "#f4212e" });
            }
            sendResponse({ success: false, error: errMsg });
            return;
          }

          const filename = `ig-${username}_${shortcode}${suffix}.${result.extension}`;
          queue.enqueue(result.url, filename, "instagram").then(() => {
            refreshPolling();
            sendResponse({ success: true });
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${EXTENSION_NAME}] download-instagram error: ${msg}`);
          if (!downloadThumbnail) notify("Error", msg);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }

    if (message.type === "get-download-history") {
      chrome.storage.local.get(HISTORY_KEY, (result) => {
        const entries =
          (result[HISTORY_KEY] as DownloadHistoryEntry[] | undefined) ?? [];
        sendResponse({ entries } satisfies DownloadHistoryResponse);
      });
      return true;
    }

    if (message.type === "get-download-status") {
      const { entries, queuePaused } = queue.getStatus();

      // Enrich entries that are downloading with progress from chrome.downloads
      const downloading = entries.filter(
        (e) =>
          e.status === "downloading" && e.chromeDownloadId !== undefined
      );

      if (downloading.length === 0) {
        sendResponse({
          downloads: [],
          entries,
          queuePaused,
        } satisfies DownloadStatusResponse);
        return false;
      }

      let pending = downloading.length;
      for (const entry of downloading) {
        chrome.downloads.search(
          { id: entry.chromeDownloadId! },
          (results) => {
            if (results && results.length > 0) {
              const item = results[0];
              // Attach progress as a transient property via casting
              (entry as any).progress =
                item.totalBytes > 0
                  ? Math.round(
                      (item.bytesReceived / item.totalBytes) * 100
                    )
                  : 0;
            }
            pending--;
            if (pending === 0) {
              sendResponse({
                downloads: [],
                entries,
                queuePaused,
              } satisfies DownloadStatusResponse);
            }
          }
        );
      }
      return true;
    }

    // Queue control messages
    if (message.type === "queue-cancel") {
      queue.cancel(message.id).then(() => {
        refreshPolling();
        sendResponse({ success: true });
      });
      return true;
    }

    if (message.type === "queue-retry") {
      queue.retry(message.id).then(() => {
        refreshPolling();
        sendResponse({ success: true });
      });
      return true;
    }

    if (message.type === "queue-pause") {
      queue.pause(message.id).then(() => {
        refreshPolling();
        sendResponse({ success: true });
      });
      return true;
    }

    if (message.type === "queue-resume") {
      queue.resume(message.id).then(() => {
        refreshPolling();
        sendResponse({ success: true });
      });
      return true;
    }
  }
);
