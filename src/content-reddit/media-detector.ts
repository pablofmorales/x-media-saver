export type RedditMediaType = "image" | "gallery" | "video";

export interface RedditPostMedia {
  element: HTMLElement;
  mediaTypes: RedditMediaType[];
}

export interface RedditPostMeta {
  subreddit: string;
  postId: string;
  permalink: string;
}

export function getAllPostsFromNode(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return [];

  const posts: HTMLElement[] = [];

  if (node.tagName === "SHREDDIT-POST") {
    posts.push(node);
  }

  posts.push(
    ...node.querySelectorAll<HTMLElement>("shreddit-post")
  );

  return posts;
}

export function detectMedia(post: HTMLElement): RedditPostMedia | null {
  const mediaTypes: RedditMediaType[] = [];

  // Gallery detection — shreddit-post has a `post-type` attribute
  const postType = post.getAttribute("post-type");
  if (postType === "gallery") {
    mediaTypes.push("gallery");
  }

  // Video detection
  if (
    postType === "video" ||
    post.querySelector("shreddit-player") ||
    post.querySelector("video")
  ) {
    mediaTypes.push("video");
  }

  // Image detection
  if (
    postType === "image" ||
    post.querySelector('img[src*="i.redd.it"]') ||
    post.querySelector('a[href*="i.redd.it"]')
  ) {
    if (!mediaTypes.includes("gallery")) {
      mediaTypes.push("image");
    }
  }

  if (mediaTypes.length === 0) return null;

  return { element: post, mediaTypes };
}

export function getPostMeta(post: HTMLElement): RedditPostMeta | null {
  const permalink =
    post.getAttribute("permalink") ||
    post.getAttribute("content-href");

  if (!permalink) return null;

  // Permalink format: /r/{subreddit}/comments/{postId}/...
  const match = permalink.match(/\/r\/([^/]+)\/comments\/([^/]+)/);
  if (!match) return null;

  return {
    subreddit: match[1],
    postId: match[2],
    permalink,
  };
}

export function extractImageUrls(post: HTMLElement): string[] {
  const urls: string[] = [];

  // Direct images from i.redd.it
  const images = post.querySelectorAll<HTMLImageElement>(
    'img[src*="i.redd.it"]'
  );
  for (const img of images) {
    if (img.src && !urls.includes(img.src)) {
      urls.push(img.src);
    }
  }

  // Links to i.redd.it (sometimes image is in an anchor)
  if (urls.length === 0) {
    const links = post.querySelectorAll<HTMLAnchorElement>(
      'a[href*="i.redd.it"]'
    );
    for (const link of links) {
      if (link.href && !urls.includes(link.href)) {
        urls.push(link.href);
      }
    }
  }

  return urls;
}

export function getImageExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
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
