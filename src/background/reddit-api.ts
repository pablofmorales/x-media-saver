interface RedditVideoData {
  fallback_url: string;
  height: number;
  width: number;
}

interface RedditMediaMetadataItem {
  s: {
    u: string; // HTML-encoded URL to highest-resolution image
    x: number;
    y: number;
  };
  e: string; // "Image" or "AnimatedImage"
  m: string; // MIME type, e.g. "image/jpg"
  id: string;
}

interface RedditGalleryItem {
  media_id: string;
  id: number;
}

interface RedditPostData {
  secure_media?: {
    reddit_video?: RedditVideoData;
  };
  media?: {
    reddit_video?: RedditVideoData;
  };
  gallery_data?: {
    items: RedditGalleryItem[];
  };
  media_metadata?: Record<string, RedditMediaMetadataItem>;
}

interface RedditListingChild {
  data: RedditPostData;
}

interface RedditListing {
  data: {
    children: RedditListingChild[];
  };
}

export interface GalleryImageInfo {
  url: string;
  extension: string;
}

export async function resolveRedditVideoUrl(
  postUrl: string
): Promise<string | null> {
  const jsonUrl = postUrl.replace(/\/?$/, ".json");

  try {
    const res = await fetch(jsonUrl, {
      headers: {
        // Reddit requires a User-Agent for API requests
        "User-Agent": "SocialMediaSaver/1.0",
      },
    });

    if (!res.ok) {
      console.warn(
        `[Social Media Saver] Reddit JSON API returned ${res.status} for ${postUrl}`
      );
      return null;
    }

    const data: RedditListing[] = await res.json();

    if (!Array.isArray(data) || data.length === 0) return null;

    const postData = data[0]?.data?.children?.[0]?.data;
    if (!postData) return null;

    const redditVideo =
      postData.secure_media?.reddit_video ||
      postData.media?.reddit_video;

    if (!redditVideo?.fallback_url) return null;

    // The fallback_url may have a query string — clean it for a direct MP4
    return redditVideo.fallback_url;
  } catch (err) {
    console.error(
      `[Social Media Saver] Reddit JSON fetch error for ${postUrl}:`,
      err
    );
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpg": "jpg",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mime] || "jpg";
}

export async function resolveRedditGalleryUrls(
  postUrl: string
): Promise<GalleryImageInfo[] | null> {
  const jsonUrl = postUrl.replace(/\/?$/, ".json");

  try {
    const res = await fetch(jsonUrl, {
      headers: {
        "User-Agent": "SocialMediaSaver/1.0",
      },
    });

    if (!res.ok) {
      console.warn(
        `[Social Media Saver] Reddit JSON API returned ${res.status} for ${postUrl}`
      );
      return null;
    }

    const data: RedditListing[] = await res.json();

    if (!Array.isArray(data) || data.length === 0) return null;

    const postData = data[0]?.data?.children?.[0]?.data;
    if (!postData) return null;

    const { gallery_data, media_metadata } = postData;
    if (!gallery_data?.items || !media_metadata) return null;

    const images: GalleryImageInfo[] = [];

    for (const item of gallery_data.items) {
      const meta = media_metadata[item.media_id];
      if (!meta?.s?.u) continue;

      images.push({
        url: decodeHtmlEntities(meta.s.u),
        extension: extensionFromMime(meta.m),
      });
    }

    return images.length > 0 ? images : null;
  } catch (err) {
    console.error(
      `[Social Media Saver] Reddit gallery JSON fetch error for ${postUrl}:`,
      err
    );
    return null;
  }
}
