interface RedditVideoData {
  fallback_url: string;
  height: number;
  width: number;
}

interface RedditPostData {
  secure_media?: {
    reddit_video?: RedditVideoData;
  };
  media?: {
    reddit_video?: RedditVideoData;
  };
}

interface RedditListingChild {
  data: RedditPostData;
}

interface RedditListing {
  data: {
    children: RedditListingChild[];
  };
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
