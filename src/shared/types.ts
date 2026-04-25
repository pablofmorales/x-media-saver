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

export type MessageRequest =
  | ImageDownloadRequest
  | VideoDownloadRequest
  | GetDownloadStatusRequest
  | GetDownloadHistoryRequest
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
