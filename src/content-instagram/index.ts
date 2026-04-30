import "./styles.css";
import { EXTENSION_NAME } from "../shared/constants";
import { detectMedia } from "./media-detector";
import { injectSaveButton } from "./button";

const processedElements = new WeakSet<HTMLElement>();

function processElement(el: HTMLElement): void {
  if (processedElements.has(el)) return;
  
  // Look for articles (posts) or specific containers for reels/stories
  const media = detectMedia(el);
  if (!media) return;

  processedElements.add(el);
  console.log(`[${EXTENSION_NAME}] Instagram ${media.mediaType} detected:`, media.shortcode);
  injectSaveButton(el);
}

function scan(root: HTMLElement): void {
  // Articles for feed posts
  root.querySelectorAll<HTMLElement>("article").forEach(processElement);
  
  // Reels and Stories often use different structures, but we can try to find them by roles or tags
  root.querySelectorAll<HTMLElement>('main[role="main"]').forEach(processElement);
}

function init(): void {
  console.log(`[${EXTENSION_NAME}] Instagram content script loaded`);

  scan(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.tagName === "ARTICLE") {
            processElement(node);
          } else {
            // Check if it contains an article or is a relevant container
            node.querySelectorAll<HTMLElement>("article").forEach(processElement);
            
            // For Stories/Reels that might just be div overlays
            if (node.querySelector('video') || node.querySelector('img[src*="cdninstagram.com"]')) {
                processElement(node);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

init();
