# Social Media Saver

A Chrome extension that adds a download button to X (Twitter) posts so you can save images and videos with one click.

## Install

### From the Chrome Web Store

*(Coming soon)*

### From source

1. Clone the repo:
   ```bash
   git clone https://github.com/pablofmorales/x-media-saver.git
   cd x-media-saver
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top right toggle)
   - Click **Load unpacked**
   - Select the `dist/` folder

## What it does

- Downloads images at full resolution (`?name=orig`)
- Resolves and downloads the highest-bitrate MP4 for videos
- Handles tweets with both images and video in one click
- Shows download progress on the extension badge
- Keeps a history of recent downloads in the popup, with a button to open each file
- Sends a desktop notification when a download finishes or fails

## Development

```bash
npm run dev
```

This starts the Vite dev server with hot reload. Load the `dist/` folder as an unpacked extension in Chrome — changes to source files trigger a rebuild automatically.

```bash
npm run build
```

Runs TypeScript type-checking (`tsc`) then a Vite production build.

## How it works

The extension has three parts that communicate via `chrome.runtime.sendMessage`:

```
Content Script (x.com)     Background Service Worker     Popup
┌─────────────────────┐    ┌──────────────────────┐    ┌──────────────┐
│ Watches DOM for     │    │ Handles download     │    │ Shows active │
│ new tweets          │───▶│ requests             │◀───│ downloads &  │
│                     │    │                      │    │ history      │
│ Detects media and   │    │ Resolves video URLs  │    │              │
│ injects download    │    │ Tracks progress      │    │              │
│ buttons             │    │ & history            │    │              │
└─────────────────────┘    └──────────────────────┘    └──────────────┘
```

**Content script** (`src/content/`) — injected into x.com and twitter.com. Uses a `MutationObserver` to detect new tweets, extracts media URLs, and injects a download button into each tweet's action bar.

**Background service worker** (`src/background/`) — handles the actual downloads via `chrome.downloads.download()`. For videos, it resolves the MP4 URL through a dual-API fallback (Twitter Syndication API, then VxTwitter). Tracks progress, updates the badge, persists history to `chrome.storage.local`, and sends notifications.

**Popup** (`src/popup/`) — shown when you click the extension icon. Polls the background worker for download status and recent history, displaying progress bars and file info.

## Tech stack

- TypeScript (strict mode, ESNext target)
- Vite with `@crxjs/vite-plugin` for Chrome extension support
- Chrome Extension Manifest V3
