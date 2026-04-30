import { EXTENSION_NAME } from "../shared/constants";

export interface InstagramMediaInfo {
    url: string;
    extension: string;
}

export async function resolveInstagramMedia(
    postUrl: string,
    downloadThumbnail: boolean = false
): Promise<InstagramMediaInfo | null> {
    try {
        // Clean URL to avoid extra params
        const cleanUrl = postUrl.split('?')[0].replace(/\/?$/, '/');
        
        const res = await fetch(cleanUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        if (!res.ok) {
            console.warn(`[${EXTENSION_NAME}] Instagram fetch returned ${res.status} for ${cleanUrl}`);
            return null;
        }

        const html = await res.text();

        if (downloadThumbnail) {
            const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
            if (match) {
                return { url: decodeHtmlEntities(match[1]), extension: "jpg" };
            }
        }

        // Try to find video
        const videoMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]*)"/i);
        if (videoMatch) {
            return { url: decodeHtmlEntities(videoMatch[1]), extension: "mp4" };
        }

        // Fallback to image
        const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
        if (imageMatch) {
            return { url: decodeHtmlEntities(imageMatch[1]), extension: "jpg" };
        }

        // Try to find in LD+JSON if OG tags fail
        const ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (ldJsonMatch) {
            try {
                const data = JSON.parse(ldJsonMatch[1]);
                if (downloadThumbnail && data.image) {
                     return { url: data.image, extension: "jpg" };
                }
                if (data.video && data.video.contentUrl) {
                    return { url: data.video.contentUrl, extension: "mp4" };
                }
                if (data.image) {
                    return { url: data.image, extension: "jpg" };
                }
            } catch (e) {
                // ignore
            }
        }

        return null;
    } catch (err) {
        console.error(`[${EXTENSION_NAME}] Instagram resolution error:`, err);
        return null;
    }
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
