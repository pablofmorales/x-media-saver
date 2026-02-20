## 1. Types & Message Interface

- [x] 1.1 Add `RedditGalleryDownloadRequest` type to `src/shared/types.ts` with fields `type: "download-reddit-gallery"`, `postUrl`, `subreddit`, `postId`
- [x] 1.2 Add `RedditGalleryDownloadRequest` to the `MessageRequest` union type

## 2. Gallery API Resolution

- [x] 2.1 Add `resolveRedditGalleryUrls()` function to `src/background/reddit-api.ts` that fetches `{postUrl}.json`, extracts image URLs from `media_metadata[id].s.u` ordered by `gallery_data.items`, decodes HTML entities, and returns an array of `{ url, extension }` objects
- [x] 2.2 Add Reddit API types for gallery data (`RedditGalleryData`, `RedditMediaMetadata`) to `src/background/reddit-api.ts`

## 3. Background Worker Handler

- [x] 3.1 Add `download-reddit-gallery` message handler to `src/background/service-worker.ts` that calls `resolveRedditGalleryUrls()`, constructs filenames as `r-{subreddit}_{postId}_{index}.{ext}`, and initiates downloads for each image via `chrome.downloads.download()`
- [x] 3.2 Add error handling and user notifications for gallery resolution failures (missing data, API errors)

## 4. Content Script Click Handler

- [x] 4.1 Update the click handler in `src/content-reddit/button.ts` to send `download-reddit-gallery` message when `extractImageUrls()` returns zero URLs for a gallery post
- [x] 4.2 Update the click handler to handle mixed-media posts: when a post has both video and images/gallery, dispatch both `download-reddit-video` and image download messages from a single click

## 5. Verification

- [x] 5.1 Build the project with `npm run build` and verify no type or compilation errors
