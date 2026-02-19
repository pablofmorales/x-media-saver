export interface ImageDownloadRequest {
  type: "download-images";
  images: ImageInfo[];
}

export interface ImageInfo {
  url: string;
  filename: string;
}

export type MessageRequest = ImageDownloadRequest;
