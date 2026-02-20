## Why

The extension currently skips image downloads when a tweet contains both images and video — video always takes priority in mixed-media tweets. Users expect a single click to download all media from a tweet regardless of type. Additionally, the project has no README, making it difficult for contributors and users to understand the extension's purpose, setup, and usage.

## What Changes

- **Download all media in mixed-media tweets**: When a tweet contains both images and a video, download everything instead of only the video. Remove the video-over-images priority logic in the content script.
- **Comprehensive README**: Add a project README covering overview, features, installation, development setup, architecture, and contribution guidelines.

## Capabilities

### New Capabilities
- `project-readme`: Comprehensive README.md documentation covering project overview, features, installation, development, and architecture
- `full-media-download`: Download all media types (images + video) from a single tweet in one click, removing the current video-only priority for mixed-media tweets

### Modified Capabilities
<!-- No existing specs need modification — the download-history and other specs are unaffected -->

## Impact

- `src/content/button.ts` — Remove conditional that skips images when video is present; send both `download-video` and `download-images` messages for mixed-media tweets
- `src/background/service-worker.ts` — May need to handle concurrent image + video downloads for the same tweet gracefully (badge progress, notifications)
- Project root — New `README.md` file
