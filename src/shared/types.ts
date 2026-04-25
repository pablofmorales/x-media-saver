export interface QueueEntry {
  id: string;
  url: string;
  filename: string;
  status: "queued" | "downloading" | "paused" | "completed" | "failed";
  chromeDownloadId?: number;
  retryCount: number;
  error?: string;
  addedAt: number;
  source: "twitter" | "reddit";
}

export interface ImageDownloadRequest {
  type: "download-images";
  images: ImageInfo[];
  tweetId: string;
  username: string;
}

export interface ImageInfo {
  url: string;
  // filename is now optional, background script can generate it if missing
  filename?: string;
}

export interface VideoDownloadRequest {
  type: "download-video";
  tweetId: string;
  username: string;
}

export interface GetDownloadStatusRequest {
  type: "get-download-status";
}

export interface DownloadStatusResponse {
  downloads: DownloadProgressInfo[];
  entries: QueueEntry[];
  queuePaused: boolean;
}

export interface DownloadProgressInfo {
  id: number;
  filename: string;
  progress: number; // 0-100
  state: "in_progress" | "complete" | "interrupted";
  error?: string;
}

export interface DownloadHistoryEntry {
  downloadId: number;
  filename: string;
  completedAt: number;
}

export interface GetDownloadHistoryRequest {
  type: "get-download-history";
}

export interface DownloadHistoryResponse {
  entries: DownloadHistoryEntry[];
}

export interface RedditVideoDownloadRequest {
  type: "download-reddit-video";
  postUrl: string;
  subreddit: string;
  postId: string;
}

export interface RedditGalleryDownloadRequest {
  type: "download-reddit-gallery";
  postUrl: string;
  subreddit: string;
  postId: string;
}

export interface RedditImageDownloadRequest {
  type: "download-reddit-image";
  postUrl: string;
  subreddit: string;
  postId: string;
}

export interface RedditGifDownloadRequest {
  type: "download-reddit-gif";
  postUrl: string;
  subreddit: string;
  postId: string;
}

export interface RedditEmbedDownloadRequest {
  type: "download-reddit-embed";
  postUrl: string;
  embedUrl: string;
  subreddit: string;
  postId: string;
}

export interface QueueCancelRequest {
  type: "queue-cancel";
  id: string;
}

export interface QueueRetryRequest {
  type: "queue-retry";
  id: string;
}

export interface QueuePauseRequest {
  type: "queue-pause";
  id?: string;
}

export interface QueueResumeRequest {
  type: "queue-resume";
  id?: string;
}

export type MessageRequest =
  | ImageDownloadRequest
  | VideoDownloadRequest
  | RedditVideoDownloadRequest
  | RedditGalleryDownloadRequest
  | RedditImageDownloadRequest
  | RedditGifDownloadRequest
  | RedditEmbedDownloadRequest
  | GetDownloadStatusRequest
  | GetDownloadHistoryRequest
  | QueueCancelRequest
  | QueueRetryRequest
  | QueuePauseRequest
  | QueueResumeRequest
  | GetSettingsRequest
  | SaveSettingsRequest;

export interface AppSettings {
  filenamePattern: string;
  downloadFolder: string;
  enableNotifications: boolean;
}

export interface GetSettingsRequest {
  type: "get-settings";
}

export interface SaveSettingsRequest {
  type: "save-settings";
  settings: AppSettings;
}
