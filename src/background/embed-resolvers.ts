// ---------------------------------------------------------------------------
// Imgur URL resolution
// ---------------------------------------------------------------------------

export interface EmbedResolveResult {
  url: string;
  extension: string;
}

export async function resolveImgurUrl(
  embedUrl: string
): Promise<EmbedResolveResult | null> {
  try {
    const parsed = new URL(embedUrl);
    const pathname = parsed.pathname;

    // i.imgur.com/{id}.gifv → .mp4
    if (pathname.endsWith(".gifv")) {
      return {
        url: `https://i.imgur.com${pathname.replace(/\.gifv$/, ".mp4")}`,
        extension: "mp4",
      };
    }

    // i.imgur.com/{id}.gif → .mp4 (Imgur serves MP4 for all GIFs)
    if (pathname.endsWith(".gif")) {
      return {
        url: `https://i.imgur.com${pathname.replace(/\.gif$/, ".mp4")}`,
        extension: "mp4",
      };
    }

    // i.imgur.com/{id}.{jpg|png|webp|mp4} → direct download
    const extMatch = pathname.match(/\.(\w+)$/);
    if (extMatch && parsed.hostname === "i.imgur.com") {
      return { url: embedUrl, extension: extMatch[1].toLowerCase() };
    }

    // imgur.com/{id} (no extension) → try .mp4 first, fall back to .jpg
    const idMatch = pathname.match(/^\/(\w+)$/);
    if (idMatch) {
      const id = idMatch[1];
      const mp4Url = `https://i.imgur.com/${id}.mp4`;

      try {
        const res = await fetch(mp4Url, { method: "HEAD" });
        if (res.ok) {
          return { url: mp4Url, extension: "mp4" };
        }
      } catch {
        // fall through to jpg fallback
      }

      return {
        url: `https://i.imgur.com/${id}.jpg`,
        extension: "jpg",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Redgifs URL resolution
// ---------------------------------------------------------------------------

let redgifToken: string | null = null;

async function getRedgifToken(forceRefresh = false): Promise<string | null> {
  if (redgifToken && !forceRefresh) return redgifToken;

  try {
    const res = await fetch(
      "https://api.redgifs.com/v2/auth/temporary",
      { method: "GET" }
    );
    if (!res.ok) return null;

    const data = await res.json();
    redgifToken = data.token ?? null;
    return redgifToken;
  } catch {
    return null;
  }
}

export async function resolveRedgifUrl(
  embedUrl: string
): Promise<EmbedResolveResult | null> {
  try {
    const parsed = new URL(embedUrl);
    // Extract ID from /watch/{id} or /ifr/{id} or just /{id}
    const idMatch = parsed.pathname.match(
      /\/(?:watch|ifr)\/([a-zA-Z0-9]+)/
    );
    const id = idMatch?.[1] ?? parsed.pathname.replace(/^\//, "").split("/")[0];
    if (!id) return null;

    const token = await getRedgifToken();
    if (!token) return null;

    let res = await fetch(
      `https://api.redgifs.com/v2/gifs/${id.toLowerCase()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Token expired — refresh and retry
    if (res.status === 401) {
      const newToken = await getRedgifToken(true);
      if (!newToken) return null;

      res = await fetch(
        `https://api.redgifs.com/v2/gifs/${id.toLowerCase()}`,
        {
          headers: { Authorization: `Bearer ${newToken}` },
        }
      );
    }

    if (!res.ok) return null;

    const data = await res.json();
    const hdUrl = data.gif?.urls?.hd ?? data.gif?.urls?.sd;
    if (!hdUrl) return null;

    return { url: hdUrl, extension: "mp4" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const SUPPORTED_DOMAINS: Record<
  string,
  (url: string) => Promise<EmbedResolveResult | null>
> = {
  "imgur.com": resolveImgurUrl,
  "i.imgur.com": resolveImgurUrl,
  "redgifs.com": resolveRedgifUrl,
  "www.redgifs.com": resolveRedgifUrl,
};

export const SUPPORTED_EMBED_DOMAINS = Object.keys(SUPPORTED_DOMAINS);

export async function resolveEmbedUrl(
  embedUrl: string
): Promise<EmbedResolveResult | null> {
  try {
    const parsed = new URL(embedUrl);
    const hostname = parsed.hostname.replace(/^www\./, "");

    for (const [domain, resolver] of Object.entries(SUPPORTED_DOMAINS)) {
      const normalizedDomain = domain.replace(/^www\./, "");
      if (
        hostname === normalizedDomain ||
        hostname.endsWith(`.${normalizedDomain}`)
      ) {
        return resolver(embedUrl);
      }
    }

    return null;
  } catch {
    return null;
  }
}
