## 1. Manifest and Shared Types

- [x] 1.1 Update `manifest.json`: rename extension to "Social Media Saver", update description, add Reddit content script entry for `https://www.reddit.com/*`, add host permissions for `https://www.reddit.com/*`, `https://i.redd.it/*`, `https://v.redd.it/*`
- [x] 1.2 Add `RedditVideoDownloadRequest` type to `src/shared/types.ts` with fields `type: "download-reddit-video"`, `postUrl`, `subreddit`, `postId`. Add to `MessageRequest` union.
- [x] 1.3 Update `src/shared/constants.ts` with new extension name "Social Media Saver"

## 2. Reddit Content Script

- [x] 2.1 Create `src/content-reddit/media-detector.ts` with functions to detect `<shreddit-post>` elements, check for images (`i.redd.it`), galleries, and videos (`shreddit-player`, `<video>`), extract image URLs, extract post metadata (subreddit, postId from permalink)
- [x] 2.2 Create `src/content-reddit/button.ts` with Reddit download button injection into the post action bar, click handler that detects media type and sends appropriate messages (`download-images` for images/galleries, `download-reddit-video` for videos)
- [x] 2.3 Create `src/content-reddit/styles.css` with download button styles adapted to Reddit's UI
- [x] 2.4 Create `src/content-reddit/index.ts` entry point with MutationObserver for `<shreddit-post>` elements, WeakSet for processed posts, init function

## 3. Background Worker

- [x] 3.1 Create `src/background/reddit-api.ts` with `resolveRedditVideoUrl(postUrl)` function that fetches `{postUrl}.json`, parses the response, and returns the `reddit_video.fallback_url`
- [x] 3.2 Add `download-reddit-video` message handler in `src/background/service-worker.ts` that calls `resolveRedditVideoUrl`, constructs filename as `r-{subreddit}_{postId}_video.mp4`, and initiates download

## 4. Build Verification

- [x] 4.1 Run `npm run build` to verify TypeScript compilation and Vite build succeed with the new content script entry
