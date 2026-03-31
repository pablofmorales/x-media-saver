const DOWNLOAD_FOLDER_KEY = "downloadFolder";

/**
 * Sanitize a subfolder string: strip invalid path characters, trim whitespace,
 * and remove trailing slashes.
 */
export function sanitizeFolder(input: string): string {
  return input
    .replace(/[*?"<>|]/g, "")
    .trim()
    .replace(/[/\\]+$/, "");
}

/** Load the configured download subfolder from chrome.storage.sync. */
export async function loadDownloadFolder(): Promise<string> {
  const result = await chrome.storage.sync.get(DOWNLOAD_FOLDER_KEY);
  return (result[DOWNLOAD_FOLDER_KEY] as string | undefined) ?? "";
}

/** Save the download subfolder to chrome.storage.sync (sanitized). */
export async function saveDownloadFolder(folder: string): Promise<string> {
  const sanitized = sanitizeFolder(folder);
  await chrome.storage.sync.set({ [DOWNLOAD_FOLDER_KEY]: sanitized });
  return sanitized;
}
