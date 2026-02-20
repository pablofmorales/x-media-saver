## Context

Reddit gallery posts use a carousel component (`shreddit-gallery`) that only renders the currently visible slide as an `<img>` element. The current `extractImageUrls()` queries the DOM for `img[src*="i.redd.it"]`, which finds at most 1 image from a gallery. When zero URLs are found (common on initial load before any slide renders), the click handler silently bails out. Reddit's JSON API (`{postUrl}.json`) exposes full gallery data via `media_metadata` (image URLs by media ID) and `gallery_data` (ordered list of media IDs).

## Goals / Non-Goals

**Goals:**
- Download all images from Reddit gallery posts via the JSON API
- Handle mixed-media posts (images + videos in the same post)
- Reuse existing download infrastructure (`download-images`, `trackDownload`)

**Non-Goals:**
- Downloading Reddit-hosted videos with separate audio tracks (DASH) — `fallback_url` provides a muxed MP4
- Supporting crossposted galleries (would require resolving the crosspost source)
- Downloading external-link or embed posts

## Decisions

### 1. Gallery resolution via Reddit JSON API in the background worker

The content script sends a `download-reddit-gallery` message with `postUrl`, `subreddit`, and `postId`. The background worker fetches `{postUrl}.json`, extracts gallery URLs from `media_metadata`, orders them by `gallery_data.items`, and initiates downloads.

**Why not resolve in the content script?** The content script runs in the page context with potential CORS restrictions. The background worker already has `host_permissions` for Reddit domains and uses the same pattern for video resolution.

**Alternatives considered:**
- DOM scraping of the gallery carousel — fragile, only the visible slide is rendered
- Using Reddit's OAuth API — requires app registration and auth flow, overkill for public post data

### 2. Image URL extraction from `media_metadata`

Each gallery item in `media_metadata` has an `s` (source) object with a `u` (URL) field containing the highest-resolution image. The URL is HTML-encoded (e.g., `&amp;` instead of `&`) and needs decoding. Format: `https://preview.redd.it/{id}.{ext}?width=...&format=...&s=...`.

We'll use the `s.u` field, decode HTML entities, and keep the full URL (the query params are required for access).

### 3. Mixed-media handling

When a post contains both gallery images and a video, the click handler will download both. The gallery resolution handles images, and the existing `download-reddit-video` handler covers the video. The content script will dispatch both message types from a single click.

### 4. Content script fallback strategy

The click handler for gallery posts will:
1. First attempt DOM extraction via existing `extractImageUrls()`
2. If zero URLs found, send `download-reddit-gallery` to the background worker
3. This preserves fast DOM-based downloads when possible while falling back to API

## Risks / Trade-offs

- **Reddit API rate limiting** → Minimal risk since this is per-user browser extension usage, not bulk scraping. Each gallery post requires a single API call.
- **`media_metadata` format changes** → Reddit's JSON API is unofficial. Mitigation: clear error messages when fields are missing.
- **HTML-encoded URLs in `media_metadata`** → Must decode `&amp;` entities. Mitigation: use a simple replace or DOMParser decode.
- **Gallery ordering** → `gallery_data.items` provides the canonical order. If absent, fall back to `media_metadata` key order.
