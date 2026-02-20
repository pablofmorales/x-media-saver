# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X Media Saver is a Chrome extension (Manifest V3) that adds download buttons to X/Twitter posts for saving images and videos. Built with TypeScript and Vite using the `@crxjs/vite-plugin` for Chrome extension support.

## Build Commands

- `npm run dev` — Start Vite dev server with hot reload (load `dist/` as unpacked extension in `chrome://extensions/`)
- `npm run build` — Type-check with `tsc` then build with Vite to `dist/`

No test framework or linter is configured.

## Architecture

The extension has three isolated runtime contexts that communicate via `chrome.runtime.sendMessage`:

### Background Service Worker (`src/background/`)
- `service-worker.ts` — Handles download requests, tracks active downloads via a Map, polls `chrome.downloads.search()` for progress, updates the badge icon, persists history to `chrome.storage.local` (max 10 entries)
- `api.ts` — Resolves video URLs with dual-API fallback: Twitter Syndication API → VxTwitter API. Picks highest-bitrate MP4 variant

### Content Script (`src/content/`)
Injected into x.com and twitter.com pages:
- `index.ts` — Entry point. Uses MutationObserver to detect new tweets in the DOM, tracks processed tweets via WeakSet
- `media-detector.ts` — Extracts image URLs (upgraded to `?name=orig` for full quality) and detects video presence using `data-testid` selectors
- `button.ts` — Injects a download button into each tweet's action bar. Handles click → media detection → message to background worker
- `styles.css` — Button styling matching X's native UI, imported from the content script entry point

### Popup (`src/popup/`)
Shown when clicking the extension icon:
- `popup.ts` — Polls active download status (500ms) and history (3000ms) from the background worker
- `popup.css` — Dark theme matching X's color scheme

### Shared (`src/shared/`)
- `types.ts` — TypeScript interfaces for all message types (`MessageRequest` union type with `download-images`, `download-video`, `get-download-status`, `get-download-history`)
- `constants.ts` — Extension name constant

## Message Flow

Content script detects media → sends `download-images` or `download-video` message → background worker initiates `chrome.downloads.download()` → popup polls `get-download-status` / `get-download-history` for UI updates.

## Key X/Twitter DOM Selectors

- `article[data-testid="tweet"]` — Tweet container
- `[data-testid="tweetPhoto"]` — Image element
- `[data-testid="videoPlayer"]` — Video player
- `[data-testid="primaryColumn"]` — Main feed column
- `[data-testid="reply"]` — Reply button (used to locate action bar for button injection)

## Configuration

- `manifest.json` — Extension manifest (source of truth, read by Vite plugin)
- `vite.config.ts` — Minimal config, just applies the `crx` plugin with the manifest
- `tsconfig.json` — Strict mode, ESNext target, bundler module resolution
