import { DEFAULT_SETTINGS, DownloadQuality, UserSettings } from "../shared/types";

let currentSettings = DEFAULT_SETTINGS;
chrome.storage.sync.get({ settings: DEFAULT_SETTINGS }, (res) => {
  currentSettings = res.settings as UserSettings;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    currentSettings = changes.settings.newValue as UserSettings;
  }
});

const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  tweetPhoto: '[data-testid="tweetPhoto"]',
  videoPlayer: '[data-testid="videoPlayer"]',
  primaryColumn: '[data-testid="primaryColumn"]',
} as const;

export type MediaType = "image" | "video";

export interface TweetMedia {
  element: HTMLElement;
  mediaTypes: MediaType[];
}

export function getTweetFromNode(node: Node): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;

  // The node itself may be a tweet article
  if (node.matches(SELECTORS.tweet)) return node;

  // Or the tweet may be a descendant of the added node
  return node.querySelector<HTMLElement>(SELECTORS.tweet);
}

export function getAllTweetsFromNode(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return [];

  const tweets: HTMLElement[] = [];

  if (node.matches(SELECTORS.tweet)) {
    tweets.push(node);
  }

  tweets.push(...node.querySelectorAll<HTMLElement>(SELECTORS.tweet));

  return tweets;
}

export function detectMedia(tweet: HTMLElement): TweetMedia | null {
  const mediaTypes: MediaType[] = [];

  if (tweet.querySelector(SELECTORS.tweetPhoto)) {
    mediaTypes.push("image");
  }

  if (tweet.querySelector(SELECTORS.videoPlayer)) {
    mediaTypes.push("video");
  }

  if (mediaTypes.length === 0) return null;

  return { element: tweet, mediaTypes };
}

export function getPrimaryColumn(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELECTORS.primaryColumn);
}

/**
 * Extract the username from a tweet element.
 * Looks for the status link pattern: /<username>/status/<id>
 */
export function getUsername(tweet: HTMLElement): string | null {
  const link = tweet.querySelector<HTMLAnchorElement>(
    'a[href*="/status/"] time'
  )?.closest<HTMLAnchorElement>("a");
  if (!link) return null;

  const match = link.href.match(/\/([^/]+)\/status\/\d+/);
  return match ? match[1] : null;
}

/**
 * Extract all image URLs from a tweet at original quality.
 * Handles single images and multi-image carousels.
 */
export function extractImageUrls(tweet: HTMLElement): string[] {
  const photoContainers = tweet.querySelectorAll<HTMLElement>(
    SELECTORS.tweetPhoto
  );
  const urls: string[] = [];

  for (const container of photoContainers) {
    const img = container.querySelector<HTMLImageElement>("img[src]");
    if (!img) continue;

    const url = toQuality(img.src, currentSettings.quality);
    if (url) urls.push(url);
  }

  return urls;
}

/**
 * Convert an X image URL to original quality by setting name=orig.
 * Returns the cleaned URL or null if it's not a recognized image URL.
 */
function toQuality(src: string, quality: DownloadQuality): string | null {
  try {
    const url = new URL(src);
    if (!url.hostname.includes("twimg.com")) return null;
    url.searchParams.set("name", quality);
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Detect the file extension from an X image URL.
 * Checks the `format` query param first, then falls back to the path extension.
 */
export function getImageExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const format = parsed.searchParams.get("format");
    if (format && /^(jpg|jpeg|png|webp)$/i.test(format)) {
      return format.toLowerCase() === "jpeg" ? "jpg" : format.toLowerCase();
    }

    const pathMatch = parsed.pathname.match(/\.(jpg|jpeg|png|webp)$/i);
    if (pathMatch) {
      return pathMatch[1].toLowerCase() === "jpeg"
        ? "jpg"
        : pathMatch[1].toLowerCase();
    }
  } catch {
    // fall through
  }
  return "jpg";
}
