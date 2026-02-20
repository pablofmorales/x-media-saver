## Context

The extension currently runs only on X/Twitter with a single content script that uses X-specific DOM selectors (`data-testid="tweet"`, `data-testid="tweetPhoto"`, etc.) and X-specific APIs (Syndication, VxTwitter) for video resolution. The background service worker handles downloads generically via `chrome.downloads` — it receives URLs and filenames and doesn't care about the source platform.

Reddit uses a different DOM structure. New Reddit uses `<shreddit-post>` custom elements. Media is hosted on `i.redd.it` (images) and `v.redd.it` (videos). Gallery posts contain multiple images. Reddit videos use DASH streaming with separate audio and video tracks.

## Goals / Non-Goals

**Goals:**
- Add download buttons to Reddit posts containing images, galleries, or videos
- Support new Reddit (shreddit) DOM structure
- Download Reddit images at full quality
- Download all images from gallery posts
- Download Reddit videos using the DASH fallback URL
- Keep existing X/Twitter functionality untouched

**Non-Goals:**
- Old Reddit support (old.reddit.com) — different DOM, lower usage, future work
- Audio+video muxing for Reddit videos — requires ffmpeg, not feasible in browser extension. Video-only download is acceptable for v1.
- Reddit comment media — only top-level post media
- Subreddit-wide batch downloads

## Decisions

### 1. Separate content script per platform
Create `src/content-reddit/` as a separate content script entry, not merged with the X content script. Each platform has fundamentally different DOM structures and selectors.

**Alternative**: Shared content script with platform detection. Rejected — would create a tangled codebase with conditional logic everywhere. Separate scripts are cleaner and independently deployable.

### 2. Reddit DOM selectors: target `<shreddit-post>`
New Reddit uses `<shreddit-post>` custom elements for posts. Media is within shadow DOM in some cases, but image/video elements are accessible from the light DOM.

Key selectors:
- Post container: `shreddit-post`
- Images: `a[href*="i.redd.it"] img`, `img[src*="i.redd.it"]`, or gallery images within the post
- Video: `shreddit-player` or `video` elements
- Post permalink: `a[href*="/comments/"]` in the post, or the `permalink` attribute on `<shreddit-post>`

### 3. Reddit video resolution: JSON API
Append `.json` to the Reddit post URL to get post metadata including `reddit_video.fallback_url`. This gives the highest quality video-only MP4 (DASH fallback). No authentication required.

**Alternative**: Scrape video src from DOM. Rejected — the DOM uses DASH/HLS which requires a player; the JSON API gives a direct MP4 URL.

**Limitation**: The DASH fallback is video-only (no audio). Muxing audio+video requires ffmpeg which isn't available in extensions. This is acceptable for v1.

### 4. Gallery support: Reddit JSON API
Gallery posts use `gallery_data` and `media_metadata` in the JSON API response. Each gallery item has a media ID that maps to a full-resolution URL in `media_metadata`.

### 5. Reuse existing download infrastructure
The background service worker's `download-images` message type already works for any URL+filename pair. Reddit images can reuse this. Reddit videos need a new `download-reddit-video` message to resolve the URL first (similar to `download-video` for X).

### 6. Button injection: Reddit action bar
Inject the download button into the Reddit post's action bar (share/comment/save row). Use similar styling approach but adapted to Reddit's UI.

### 7. CSS: separate stylesheet
Create `src/content-reddit/styles.css` with Reddit-adapted button styles. The button design will match Reddit's visual language rather than X's.

## Risks / Trade-offs

- **[Reddit DOM changes]** → Reddit updates its frontend frequently. Selectors may break. Mitigation: use stable attributes like tag names (`shreddit-post`) and data attributes rather than class names.
- **[Video without audio]** → Users may expect full video+audio. Mitigation: document this limitation. Consider adding a note in the filename (e.g., `_video-only.mp4`).
- **[Rate limiting]** → Reddit JSON API may rate-limit. Mitigation: single request per video click, no bulk operations.
- **[Shadow DOM]** → Some Reddit elements use shadow DOM. Mitigation: research during implementation; if needed, use `element.shadowRoot` access.
- **[Gallery complexity]** → Gallery API response structure may vary. Mitigation: handle missing/malformed gallery data gracefully.
