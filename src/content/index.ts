import { EXTENSION_NAME } from "../shared/constants";
import {
  getAllTweetsFromNode,
  detectMedia,
  getPrimaryColumn,
} from "./media-detector";
import { injectSaveButton } from "./button";

const processedTweets = new WeakSet<HTMLElement>();

function processTweet(tweet: HTMLElement): void {
  if (processedTweets.has(tweet)) return;
  processedTweets.add(tweet);

  const media = detectMedia(tweet);
  if (!media) return;

  console.log(
    `[${EXTENSION_NAME}] Tweet with media detected:`,
    media.mediaTypes,
    tweet
  );

  injectSaveButton(tweet);
}

function scanExistingTweets(root: HTMLElement): void {
  const tweets = root.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  tweets.forEach(processTweet);
}

function observeColumn(column: HTMLElement): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const tweets = getAllTweetsFromNode(node);
        tweets.forEach(processTweet);
      }
    }
  });

  observer.observe(column, { childList: true, subtree: true });
  scanExistingTweets(column);

  return observer;
}

function init(): void {
  console.log(`[${EXTENSION_NAME}] Content script loaded`);

  const column = getPrimaryColumn();
  if (column) {
    observeColumn(column);
    return;
  }

  // primaryColumn may not exist yet (SPA navigation). Wait for it.
  const bodyObserver = new MutationObserver((_mutations, obs) => {
    const col = getPrimaryColumn();
    if (col) {
      obs.disconnect();
      observeColumn(col);
    }
  });

  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

init();
