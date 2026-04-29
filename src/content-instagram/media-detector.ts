import { EXTENSION_NAME } from "../shared/constants";

export type InstagramMediaType = "post" | "reel" | "story";

export interface InstagramMediaInfo {
  element: HTMLElement;
  mediaType: InstagramMediaType;
  shortcode: string;
  username: string;
  url: string;
}

export function getShortcodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    
    // /p/SHORTCODE/
    // /reels/SHORTCODE/
    // /reel/SHORTCODE/
    // /stories/USERNAME/SHORTCODE/
    
    if (pathParts[0] === "p" || pathParts[0] === "reel" || pathParts[0] === "reels") {
      return pathParts[1] || null;
    }
    
    if (pathParts[0] === "stories" && pathParts.length >= 3) {
      return pathParts[2] || null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export function getUsernameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    
    if (pathParts[0] === "stories") {
      return pathParts[1] || null;
    }
    
    // For posts, it's harder from URL alone if we are on /p/shortcode
    // But we can sometimes find it in the DOM
  } catch (e) {
    return null;
  }
  return null;
}

export function detectMedia(container: HTMLElement): InstagramMediaInfo | null {
  // Try to find the shortcode and username
  let shortcode = getShortcodeFromUrl(window.location.href);
  let username = getUsernameFromUrl(window.location.href) || "unknown";
  let mediaType: InstagramMediaType = "post";

  if (window.location.pathname.includes("/reels/") || window.location.pathname.includes("/reel/")) {
    mediaType = "reel";
  } else if (window.location.pathname.includes("/stories/")) {
    mediaType = "story";
  }

  // If we are in the main feed, we need to find the specific article/post
  const article = container.closest("article");
  if (article) {
    const links = article.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    for (const link of Array.from(links) as HTMLAnchorElement[]) {
      const code = getShortcodeFromUrl(link.href);
      if (code) {
        shortcode = code;
        break;
      }
    }
    
    // Try to find username in the article
    const userLink = article.querySelector('a[href^="/"][role="link"]');
    if (userLink) {
      const parts = userLink.getAttribute("href")?.split("/").filter(Boolean);
      if (parts && parts.length > 0 && parts[0] !== "p" && parts[0] !== "reel" && parts[0] !== "explore") {
        username = parts[0];
      }
    }
  }

  if (!shortcode) return null;

  return {
    element: article || container,
    mediaType,
    shortcode,
    username,
    url: window.location.href
  };
}
