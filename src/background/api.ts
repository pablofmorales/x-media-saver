interface VideoVariant {
  bitrate?: number;
  content_type: string;
  url: string;
}

interface SyndicationMediaDetail {
  type: string;
  video_info?: {
    variants: VideoVariant[];
  };
}

interface SyndicationResponse {
  mediaDetails?: SyndicationMediaDetail[];
}

interface VxTwitterMedia {
  url: string;
  type: string;
}

interface VxTwitterResponse {
  media_extended?: VxTwitterMedia[];
}

function pickBestMp4(variants: VideoVariant[]): string | null {
  const mp4s = variants.filter(
    (v) => v.content_type === "video/mp4" && v.bitrate != null
  );
  if (mp4s.length === 0) return null;

  mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4s[0].url;
}

async function fetchFromSyndication(tweetId: string): Promise<string | null> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[X Media Saver] Syndication API returned ${res.status} for tweet ${tweetId}`);
      return null;
    }

    const data: SyndicationResponse = await res.json();
    if (!data.mediaDetails) return null;

    for (const media of data.mediaDetails) {
      if (
        (media.type === "video" || media.type === "animated_gif") &&
        media.video_info?.variants
      ) {
        const best = pickBestMp4(media.video_info.variants);
        if (best) return best;
      }
    }

    return null;
  } catch (err) {
    console.error(`[X Media Saver] Syndication fetch error for tweet ${tweetId}:`, err);
    return null;
  }
}

async function fetchFromVxTwitter(tweetId: string): Promise<string | null> {
  const url = `https://api.vxtwitter.com/Twitter/status/${tweetId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[X Media Saver] VxTwitter API returned ${res.status} for tweet ${tweetId}`);
      return null;
    }

    const data: VxTwitterResponse = await res.json();
    if (!data.media_extended) return null;

    for (const media of data.media_extended) {
      if ((media.type === "video" || media.type === "gif") && media.url) {
        // Security fix #23: validate URL scheme before returning.
        // vxtwitter could theoretically return a file:// or javascript: URL.
        // Only allow https: URLs to reach chrome.downloads.
        try {
          const parsed = new URL(media.url);
          if (parsed.protocol !== "https:") {
            console.warn(`[X Media Saver] Rejected non-HTTPS URL from vxtwitter: ${media.url}`);
            continue;
          }
        } catch {
          console.warn(`[X Media Saver] Rejected invalid URL from vxtwitter: ${media.url}`);
          continue;
        }
        return media.url;
      }
    }

    return null;
  } catch (err) {
    console.error(`[X Media Saver] VxTwitter fetch error for tweet ${tweetId}:`, err);
    return null;
  }
}

export async function resolveVideoUrl(tweetId: string): Promise<string | null> {
  // Fix #15: Validate tweetId to prevent URL injection
  // Tweet IDs are strictly numeric. If the input contains anything else,
  // it could be used to manipulate the API paths.
  if (!/^\d+$/.test(tweetId)) {
    console.error(`[X Media Saver] Invalid tweetId format: ${tweetId}`);
    return null;
  }

  const syndicationUrl = await fetchFromSyndication(tweetId);
  if (syndicationUrl) return syndicationUrl;

  return fetchFromVxTwitter(tweetId);
}
