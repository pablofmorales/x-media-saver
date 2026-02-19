import { EXTENSION_NAME } from "../shared/constants";
import {
  extractImageUrls,
  getImageExtension,
  getUsername,
} from "./media-detector";
import type { ImageDownloadRequest, ImageInfo } from "../shared/types";

const BUTTON_ATTR = "data-xms-save-btn";

const DOWNLOAD_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" class="xms-icon">
  <path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/>
</svg>`;

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

    const username = getUsername(tweet) ?? "unknown";
    const imageUrls = extractImageUrls(tweet);

    if (imageUrls.length === 0) {
      console.warn(`[${EXTENSION_NAME}] No images found in tweet ${tweetId}`);
      return;
    }

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

    chrome.runtime.sendMessage(message);
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
