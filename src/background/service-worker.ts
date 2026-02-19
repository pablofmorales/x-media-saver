import type { MessageRequest } from "../shared/types";

chrome.runtime.onMessage.addListener(
  (message: MessageRequest, _sender, _sendResponse) => {
    if (message.type === "download-images") {
      for (const image of message.images) {
        chrome.downloads.download({
          url: image.url,
          filename: image.filename,
          conflictAction: "uniquify",
        });
      }
    }
  }
);
