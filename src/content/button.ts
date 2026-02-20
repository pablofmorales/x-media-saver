import { EXTENSION_NAME } from "../shared/constants";
import {
  detectMedia,
  extractImageUrls,
  getImageExtension,
  getUsername,
} from "./media-detector";
import type {
  ImageDownloadRequest,
  ImageInfo,
  VideoDownloadRequest,
} from "../shared/types";

const BUTTON_ATTR = "data-xms-save-btn";

const DOWNLOAD_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" class="xms-icon">
  <path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/>
</svg>
<div class="xms-spinner"></div>`;

function getTweetId(tweet: HTMLElement): string | null {
  // Tweet links follow the pattern /<user>/status/<id>
  const link = tweet.querySelector<HTMLAnchorElement>(
    'a[href*="/status/"] time'
  )?.closest<HTMLAnchorElement>("a");
  if (!link) return null;

  const match = link.href.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function getActionBar(tweet: HTMLElement): HTMLElement | null {
  // The action bar is the parent group containing reply, retweet, like, etc.
  const reply = tweet.querySelector<HTMLElement>('[data-testid="reply"]');
  if (!reply) return null;

  // The action bar is the nearest ancestor that's a row of action buttons
  // It's the parent's parent — the group div containing all action buttons
  return reply.closest<HTMLElement>('[role="group"]');
}

function createSaveButton(tweet: HTMLElement, tweetId: string): HTMLElement {
  const container = document.createElement("div");
  container.setAttribute(BUTTON_ATTR, "");
  container.className = "xms-save-container";

  const button = document.createElement("button");
  button.className = "xms-save-btn";
  button.setAttribute("aria-label", "Save media");
  button.setAttribute("role", "button");
  button.setAttribute("type", "button");
  button.innerHTML = DOWNLOAD_ICON_SVG;

  // Tooltip
  const tooltip = document.createElement("span");
  tooltip.className = "xms-tooltip";
  tooltip.textContent = "Save media";
  container.appendChild(tooltip);

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(`[${EXTENSION_NAME}] Save button clicked for tweet ${tweetId}`);

    button.classList.add("xms-loading");
    const clearLoading = () => button.classList.remove("xms-loading");

    try {
      const username = getUsername(tweet) ?? "unknown";
      const media = detectMedia(tweet);
      console.log(`[${EXTENSION_NAME}] Detected media:`, media, `username: ${username}`);
      const hasVideo = media?.mediaTypes.includes("video") ?? false;
      const imageUrls = extractImageUrls(tweet);
      console.log(`[${EXTENSION_NAME}] Extracted image URLs:`, imageUrls);

      // Track pending responses so loading state covers all downloads
      let pendingResponses = 0;
      const onResponse = () => {
        pendingResponses--;
        if (pendingResponses <= 0) {
          setTimeout(clearLoading, 500);
        }
      };

      if (hasVideo) {
        pendingResponses++;
        const message: VideoDownloadRequest = {
          type: "download-video",
          tweetId,
          username,
        };
        console.log(`[${EXTENSION_NAME}] Sending download-video message`, message);
        chrome.runtime.sendMessage(message, (response) => {
          console.log(`[${EXTENSION_NAME}] Video download response:`, response);
          onResponse();
        });
      }

      if (imageUrls.length > 0) {
        pendingResponses++;
        const images: ImageInfo[] = imageUrls.map((url, index) => {
          const ext = getImageExtension(url);
          const n = imageUrls.length > 1 ? `_${index + 1}` : "";
          return {
            url,
            filename: `@${username}_${tweetId}${n}.${ext}`,
          };
        });

        const message: ImageDownloadRequest = {
          type: "download-images",
          images,
        };

        console.log(`[${EXTENSION_NAME}] Sending download-images message`, message);
        chrome.runtime.sendMessage(message, (response) => {
          console.log(`[${EXTENSION_NAME}] Image download response:`, response);
          onResponse();
        });
      }

      if (pendingResponses === 0) {
        console.warn(`[${EXTENSION_NAME}] No media found in tweet ${tweetId}`);
        clearLoading();
      }
    } catch (err) {
      console.error(`[${EXTENSION_NAME}] Click handler error:`, err);
      clearLoading();
    }
  });

  container.appendChild(button);
  return container;
}

export function injectSaveButton(tweet: HTMLElement): void {
  // Skip if already injected
  if (tweet.querySelector(`[${BUTTON_ATTR}]`)) return;

  const tweetId = getTweetId(tweet);
  if (!tweetId) {
    console.warn(`[${EXTENSION_NAME}] Could not extract tweet ID`, tweet);
    return;
  }

  const actionBar = getActionBar(tweet);
  if (!actionBar) return;

  const saveBtn = createSaveButton(tweet, tweetId);
  actionBar.appendChild(saveBtn);
}
