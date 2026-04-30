# Social Media Saver

A Chrome extension that adds a download button to X (Twitter) and Reddit posts, letting you save images and videos with a single click.

## Features

- **One-click download** — Adds a save button to every post's action bar
- **Full-quality images** — Downloads images at original resolution
- **Video support** — Resolves and downloads the highest-bitrate MP4 variant
- **Gallery support** — Downloads all images in a Reddit gallery or X multi-image post
- **Download progress** — Badge icon shows real-time download percentage
- **Download history** — Popup shows recent downloads with the option to open files
- **Desktop notifications** — Notifies you when downloads complete or fail

## Installation

1. Clone the repository:
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
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist/` folder

## Development

Start the Vite dev server with hot reload:

```bash
npm run dev
```

Then load the `dist/` folder as an unpacked extension in Chrome. Changes to source files will trigger a rebuild automatically.

Build for production:

```bash
npm run build
```

This runs TypeScript type-checking (`tsc`) followed by a Vite production build.

## Architecture

The extension runs across three isolated Chrome extension contexts that communicate via `chrome.runtime.sendMessage`:

```
Content Script (x.com)          Background Service Worker         Popup
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────┐
│ Observes DOM for     │       │ Handles download     │       │ Polls for    │
│ new tweets           │──────▶│ requests             │◀──────│ active       │
│                      │       │                      │       │ downloads &  │
│ Detects media        │       │ Resolves video URLs  │       │ history      │
│ (images/video)       │       │ via Twitter APIs     │       │              │
│                      │       │                      │       │ Shows        │
│ Injects download     │       │ Tracks progress      │       │ progress     │
│ buttons              │       │ & history            │       │ bars         │
└──────────────────────┘       └──────────────────────┘       └──────────────┘
```

### Content Script (`src/content/`)

Injected into x.com and twitter.com pages. Uses a `MutationObserver` to detect new tweets in the DOM, extracts media URLs, and injects a download button into each tweet's action bar. On click, sends `download-images` and/or `download-video` messages to the background worker.

### Background Service Worker (`src/background/`)

Handles download requests using `chrome.downloads.download()`. For videos, resolves the actual MP4 URL via a dual-API fallback strategy (Twitter Syndication API, then VxTwitter API). Tracks download progress, updates the extension badge, persists download history to `chrome.storage.local`, and sends desktop notifications.

### Popup (`src/popup/`)

Shown when clicking the extension icon. Polls the background worker for active download status and recent history, displaying progress bars and file information in a dark-themed UI matching X's design.

## Tech Stack

- **TypeScript** — Strict mode, ESNext target
- **Vite** — Build tooling with `@crxjs/vite-plugin` for Chrome extension support
- **Chrome Extension Manifest V3** — Service workers, content scripts, storage API
