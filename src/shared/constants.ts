import { AppSettings } from "./types";

export const EXTENSION_NAME = "X Media Saver";

export const DEFAULT_SETTINGS: AppSettings = {
  filenamePattern: "{username}-{tweetId}-{index}",
  downloadFolder: "X-Media",
  enableNotifications: true,
};

export const SETTINGS_KEY = "settings";
