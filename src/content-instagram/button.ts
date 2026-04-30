import { EXTENSION_NAME } from "../shared/constants";
import { detectMedia } from "../content/instagram-detector";
import type { InstagramDownloadRequest } from "../shared/types";

const BUTTON_ATTR = "data-sms-save-btn";

const DOWNLOAD_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" class="sms-icon" style="width: 24px; height: 24px; fill: currentColor;">
  <path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/>
</svg>`;

function getActionBar(post: HTMLElement): HTMLElement | null {
  // Instagram's action bar usually contains Heart, Comment, Share buttons
  // Look for the section with these buttons
  const section = post.querySelector('section');
  if (section) {
    // Check if it's the right section (contains buttons)
    const buttons = section.querySelectorAll('button');
    if (buttons.length > 0) return section as HTMLElement;
  }

  // Fallback for Reels (vertical actions on the right)
  const reelsActions = post.querySelector('[role="menu"]')?.parentElement || 
                       post.querySelector('div[aria-label="Reels actions"]') ||
                       post.querySelector('div[style*="flex-direction: column"] > div[role="button"]')?.parentElement;
  if (reelsActions) return reelsActions as HTMLElement;

  // Fallback for Stories (top right or bottom)
  const storiesActions = post.querySelector('header')?.parentElement ||
                         post.querySelector<HTMLElement>('div[role="dialog"] header');
  if (storiesActions) return storiesActions as HTMLElement;

  return null;
}

function createSaveButton(media: any): HTMLElement {
  const container = document.createElement("div");
  container.setAttribute(BUTTON_ATTR, "");
  container.className = "sms-save-container instagram";
  container.style.display = "inline-flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.marginLeft = "8px";
  container.style.cursor = "pointer";

  const button = document.createElement("button");
  button.className = "sms-save-btn";
  button.setAttribute("aria-label", "Save media");
  button.setAttribute("type", "button");
  button.style.background = "none";
  button.style.border = "none";
  button.style.padding = "8px";
  button.style.cursor = "pointer";
  button.style.color = "inherit";
  button.innerHTML = DOWNLOAD_ICON_SVG;

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(`[${EXTENSION_NAME}] Save button clicked for Instagram ${media.mediaType} ${media.shortcode}`);

    button.classList.add("sms-loading");
    const clearLoading = () => button.classList.remove("sms-loading");

    // Download both media and thumbnail for videos/reels/stories
    const downloadMedia = () => {
      const message: InstagramDownloadRequest = {
        type: "download-instagram",
        url: media.url,
        username: media.username,
        shortcode: media.shortcode,
        mediaType: media.mediaType,
        downloadThumbnail: false
      };
      chrome.runtime.sendMessage(message, (response) => {
        if (!response?.success) {
          console.error(`[${EXTENSION_NAME}] Failed to download Instagram media`, response?.error);
        }
        clearLoading();
      });
    };

    const downloadThumbnail = () => {
      const message: InstagramDownloadRequest = {
        type: "download-instagram",
        url: media.url,
        username: media.username,
        shortcode: media.shortcode,
        mediaType: media.mediaType,
        downloadThumbnail: true
      };
      chrome.runtime.sendMessage(message);
    };

    downloadMedia();
    // If it's a video/reel/story, also download the thumbnail
    if (media.mediaType !== "post" || postHasVideo(media.element)) {
        downloadThumbnail();
    }
  });

  container.appendChild(button);
  return container;
}

function postHasVideo(element: HTMLElement): boolean {
    return !!element.querySelector('video') || !!element.querySelector('[aria-label*="Video"]');
}

export function injectSaveButton(post: HTMLElement): void {
  if (post.querySelector(`[${BUTTON_ATTR}]`)) return;

  const media = detectMedia(post);
  if (!media) return;

  const actionBar = getActionBar(post);
  if (!actionBar) {
    // Fallback: append to the post itself
    const saveBtn = createSaveButton(media);
    saveBtn.style.position = "absolute";
    saveBtn.style.top = "12px";
    saveBtn.style.right = "12px";
    saveBtn.style.zIndex = "10";
    post.style.position = "relative";
    post.appendChild(saveBtn);
    return;
  }

  const saveBtn = createSaveButton(media);
  // On Instagram feed, we want it in the same row as other icons
  actionBar.appendChild(saveBtn);
}
