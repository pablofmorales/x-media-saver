import { EXTENSION_NAME } from "../shared/constants";
import {
  detectMedia,
  extractImageUrls,
  getImageExtension,
  getPostMeta,
} from "./media-detector";
import type {
  ImageDownloadRequest,
  ImageInfo,
  RedditVideoDownloadRequest,
  RedditGalleryDownloadRequest,
} from "../shared/types";

const BUTTON_ATTR = "data-sms-save-btn";

const DOWNLOAD_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" class="sms-icon">
  <path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/>
</svg>`;

function getActionBar(post: HTMLElement): HTMLElement | null {
  // Reddit's action bar contains buttons like upvote, comment, share
  // Look for the shreddit-post's action row
  const actionRow = post.querySelector<HTMLElement>(
    'faceplate-tracker[source="post"] button'
  )?.closest<HTMLElement>('[class*="action"]');

  if (actionRow) return actionRow;

  // Fallback: find the bar with comment/share buttons
  const shareButton = post.querySelector<HTMLElement>(
    'button[aria-label*="Share"], shreddit-post-share-button'
  );
  if (shareButton?.parentElement) {
    return shareButton.parentElement;
  }

  return null;
}

function createSaveButton(post: HTMLElement): HTMLElement {
  const container = document.createElement("span");
  container.setAttribute(BUTTON_ATTR, "");
  container.className = "sms-save-container";

  const button = document.createElement("button");
  button.className = "sms-save-btn";
  button.setAttribute("aria-label", "Save media");
  button.setAttribute("type", "button");
  button.innerHTML = DOWNLOAD_ICON_SVG;

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const meta = getPostMeta(post);
    if (!meta) {
      console.warn(`[${EXTENSION_NAME}] Could not extract post metadata`);
      return;
    }

    console.log(
      `[${EXTENSION_NAME}] Save button clicked for r/${meta.subreddit} post ${meta.postId}`
    );

    button.classList.add("sms-loading");
    const clearLoading = () => button.classList.remove("sms-loading");

    try {
      const media = detectMedia(post);
      if (!media) {
        console.warn(`[${EXTENSION_NAME}] No media found in post`);
        clearLoading();
        return;
      }

      const postUrl = `https://www.reddit.com${meta.permalink}`;
      const hasVideo = media.mediaTypes.includes("video");
      const hasGallery = media.mediaTypes.includes("gallery");
      const hasImage = media.mediaTypes.includes("image");
      let pendingResponses = 0;

      const onResponse = () => {
        pendingResponses--;
        if (pendingResponses <= 0) {
          setTimeout(clearLoading, 500);
        }
      };

      // Download video if present
      if (hasVideo) {
        pendingResponses++;
        const videoMessage: RedditVideoDownloadRequest = {
          type: "download-reddit-video",
          postUrl,
          subreddit: meta.subreddit,
          postId: meta.postId,
        };
        chrome.runtime.sendMessage(videoMessage, onResponse);
      }

      // Download images/gallery if present
      if (hasGallery || hasImage) {
        const imageUrls = extractImageUrls(post);

        if (imageUrls.length > 0) {
          // DOM extraction succeeded — use download-images
          pendingResponses++;
          const images: ImageInfo[] = imageUrls.map((url, index) => {
            const ext = getImageExtension(url);
            const n = imageUrls.length > 1 ? `_${index + 1}` : "";
            return {
              url,
              filename: `r-${meta.subreddit}_${meta.postId}${n}.${ext}`,
            };
          });
          const imageMessage: ImageDownloadRequest = {
            type: "download-images",
            images,
          };
          chrome.runtime.sendMessage(imageMessage, onResponse);
        } else {
          // DOM extraction failed — fall back to API-based gallery resolution
          pendingResponses++;
          const galleryMessage: RedditGalleryDownloadRequest = {
            type: "download-reddit-gallery",
            postUrl,
            subreddit: meta.subreddit,
            postId: meta.postId,
          };
          chrome.runtime.sendMessage(galleryMessage, onResponse);
        }
      }

      // If only video was present and no image/gallery, pendingResponses is already set
      if (pendingResponses === 0) {
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

export function injectSaveButton(post: HTMLElement): void {
  if (post.querySelector(`[${BUTTON_ATTR}]`)) return;

  const meta = getPostMeta(post);
  if (!meta) return;

  const actionBar = getActionBar(post);
  if (!actionBar) {
    // Fallback: append to the post itself
    const saveBtn = createSaveButton(post);
    saveBtn.style.position = "absolute";
    saveBtn.style.bottom = "8px";
    saveBtn.style.right = "8px";
    post.style.position = "relative";
    post.appendChild(saveBtn);
    return;
  }

  const saveBtn = createSaveButton(post);
  actionBar.appendChild(saveBtn);
}
