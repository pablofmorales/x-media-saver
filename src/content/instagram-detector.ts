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
    
    // Handle cases where the URL might be like instagram.com/p/SHORTCODE?igsh=...
    const pMatch = parsed.pathname.match(/\/p\/([^/]+)/);
    if (pMatch) return pMatch[1];
    
    const reelMatch = parsed.pathname.match(/\/(?:reel|reels)\/([^/]+)/);
    if (reelMatch) return reelMatch[1];

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
  } catch (e) {
    return null;
  }
  return null;
}

export function detectMedia(container: HTMLElement): InstagramMediaInfo | null {
  // If we are in the main feed, we need to find the specific article/post
  const article = container.closest("article") || (container.tagName === "ARTICLE" ? container : null);
  
  let shortcode = "";
  let username = "unknown";
  let mediaType: InstagramMediaType = "post";

  if (article) {
    // Try to find the shortcode from links within the article
    const links = article.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    for (const link of Array.from(links) as HTMLAnchorElement[]) {
      const code = getShortcodeFromUrl(link.href);
      if (code) {
        shortcode = code;
        if (link.href.includes("/reel/")) mediaType = "reel";
        break;
      }
    }
    
    // Try to find username in the article
    // Instagram usually has the username in a link with role="link" or near the avatar
    const userLinks = article.querySelectorAll('a[href^="/"][role="link"]');
    for (const link of Array.from(userLinks) as HTMLAnchorElement[]) {
        const href = link.getAttribute("href");
        if (href) {
            const parts = href.split("/").filter(Boolean);
            if (parts.length === 1 && !["explore", "reels", "direct", "stories"].includes(parts[0])) {
                username = parts[0];
                break;
            }
        }
    }
  }

  // Handle Stories
  if (window.location.pathname.includes("/stories/")) {
    mediaType = "story";
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 3) {
      username = parts[1];
      shortcode = parts[2];
    } else if (parts.length === 2) {
        username = parts[1];
        // Shortcode might be harder to get without a direct link, but we can try to find it in the DOM if needed
        // For now, let's use a timestamp or something if missing? No, better wait for it to appear in URL
    }
  }

  // Handle Reels page
  if (window.location.pathname.includes("/reels/") || window.location.pathname.includes("/reel/")) {
      mediaType = "reel";
      const code = getShortcodeFromUrl(window.location.href);
      if (code) shortcode = code;
  }

  if (!shortcode) {
      // Last ditch effort: if we are on a single post page
      const code = getShortcodeFromUrl(window.location.href);
      if (code) shortcode = code;
  }

  if (!shortcode) return null;

  let url = `https://www.instagram.com/p/${shortcode}/`;
  if (mediaType === "story") {
    url = `https://www.instagram.com/stories/${username}/${shortcode}/`;
  } else if (mediaType === "reel") {
    url = `https://www.instagram.com/reels/${shortcode}/`;
  }

  return {
    element: (article as HTMLElement) || container,
    mediaType,
    shortcode,
    username,
    url
  };
}
