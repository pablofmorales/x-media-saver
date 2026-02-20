## Why

The extension currently only works on X/Twitter. Users also browse Reddit, which hosts significant image and video content. Extending to Reddit makes the extension a general-purpose social media saver rather than a single-platform tool.

## What Changes

- Add a separate content script for Reddit that detects posts with media and injects download buttons
- Support Reddit image posts (i.redd.it), gallery posts (multiple images), and video posts (v.redd.it)
- Update the manifest to include Reddit host permissions and content script matching
- Rename the extension from "X Media Saver" to "Social Media Saver" to reflect multi-platform support (**BREAKING**: extension name changes)
- Add Reddit-specific video resolution in the background worker using Reddit's JSON API
- Update the popup to show Reddit downloads alongside X downloads in the history

## Capabilities

### New Capabilities
- `reddit-media-detection`: Content script for Reddit that detects posts with images, galleries, and videos, and injects download buttons
- `reddit-video-resolution`: Background API logic to resolve Reddit video URLs via Reddit's JSON API (v.redd.it DASH fallback)

### Modified Capabilities
<!-- No existing specs are changing at the requirement level -->

## Impact

- **Manifest**: New `content_scripts` entry for `reddit.com`, new `host_permissions` for `i.redd.it`, `v.redd.it`, `www.reddit.com`
- **Extension name/description**: Updated to reflect multi-platform support
- **Content scripts**: New `src/content-reddit/` directory with Reddit-specific detection and button injection. Existing X content script unchanged.
- **Background worker**: New Reddit video URL resolver added alongside existing X video resolver. Message handler extended with `download-reddit-video` message type.
- **Shared types**: New message types for Reddit downloads
- **Popup**: No changes needed — already shows downloads generically by filename
