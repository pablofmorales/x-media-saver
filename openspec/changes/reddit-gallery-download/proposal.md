## Why

Reddit gallery posts (multi-image carousels) and mixed-media posts fail to download. The current `extractImageUrls()` only finds `img[src*="i.redd.it"]` visible in the DOM, but Reddit's gallery carousel (`shreddit-gallery`) doesn't expose all image URLs as `<img>` elements — only the currently visible slide is rendered. When no URLs are found, the click handler silently bails out. Users expect all images and videos from a gallery post to download.

## What Changes

- Add a background API function to fetch gallery image URLs from Reddit's JSON API (`media_metadata` + `gallery_data` fields)
- Add a new message type `download-reddit-gallery` so the content script can request the background worker to resolve and download all gallery media
- Update the content script click handler to fall back to the API when DOM extraction yields zero URLs for gallery posts
- Support mixed-media posts (posts containing both images and videos) by downloading all media types

## Capabilities

### New Capabilities
- `reddit-gallery-resolution`: Resolving gallery image URLs via Reddit's JSON API when DOM extraction fails, handling `media_metadata` and `gallery_data` response fields

### Modified Capabilities
- `reddit-media-detection`: Gallery click handler must fall back to API-based resolution instead of silently failing; must handle mixed-media posts (images + videos in the same post)

## Impact

- `src/background/reddit-api.ts` — New function to resolve gallery URLs from JSON API
- `src/background/service-worker.ts` — New message handler for `download-reddit-gallery`
- `src/content-reddit/button.ts` — Updated click handler for gallery fallback
- `src/shared/types.ts` — New `RedditGalleryDownloadRequest` message type
