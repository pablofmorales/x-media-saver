import "./styles.css";
import { EXTENSION_NAME } from "../shared/constants";
import { getAllPostsFromNode, detectMedia } from "./media-detector";
import { injectSaveButton } from "./button";

const processedPosts = new WeakSet<HTMLElement>();

function processPost(post: HTMLElement): void {
  if (processedPosts.has(post)) return;
  processedPosts.add(post);

  const media = detectMedia(post);
  if (!media) return;

  console.log(
    `[${EXTENSION_NAME}] Reddit post with media detected:`,
    media.mediaTypes,
    post
  );

  injectSaveButton(post);
}

function scanExistingPosts(root: HTMLElement): void {
  const posts = root.querySelectorAll<HTMLElement>("shreddit-post");
  posts.forEach(processPost);
}

function init(): void {
  console.log(`[${EXTENSION_NAME}] Reddit content script loaded`);

  scanExistingPosts(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const posts = getAllPostsFromNode(node);
        posts.forEach(processPost);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

init();
