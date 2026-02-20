import type { QueueEntry } from "../shared/types";

const QUEUE_STORAGE_KEY = "downloadQueue";
const QUEUE_PAUSED_KEY = "downloadQueuePaused";
const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 2000;

export class DownloadQueue {
  private entries: QueueEntry[] = [];
  private paused = false;

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  async persist(): Promise<void> {
    await chrome.storage.local.set({
      [QUEUE_STORAGE_KEY]: this.entries,
      [QUEUE_PAUSED_KEY]: this.paused,
    });
  }

  async restore(): Promise<void> {
    const result = await chrome.storage.local.get([
      QUEUE_STORAGE_KEY,
      QUEUE_PAUSED_KEY,
    ]);
    this.entries =
      (result[QUEUE_STORAGE_KEY] as QueueEntry[] | undefined) ?? [];
    this.paused =
      (result[QUEUE_PAUSED_KEY] as boolean | undefined) ?? false;

    // Re-queue entries stuck in "downloading" (service worker restarted mid-download)
    for (const entry of this.entries) {
      if (entry.status === "downloading") {
        entry.status = "queued";
        entry.chromeDownloadId = undefined;
      }
    }

    await this.persist();
    this.processQueue();
  }

  // -------------------------------------------------------------------------
  // Enqueue
  // -------------------------------------------------------------------------

  async enqueue(
    url: string,
    filename: string,
    source: "twitter" | "reddit"
  ): Promise<QueueEntry> {
    const entry: QueueEntry = {
      id: crypto.randomUUID(),
      url,
      filename,
      status: "queued",
      retryCount: 0,
      addedAt: Date.now(),
      source,
    };
    this.entries.push(entry);
    await this.persist();
    this.processQueue();
    return entry;
  }

  // -------------------------------------------------------------------------
  // Process queue — promote queued → downloading up to concurrency limit
  // -------------------------------------------------------------------------

  processQueue(): void {
    if (this.paused) return;

    const activeCount = this.entries.filter(
      (e) => e.status === "downloading"
    ).length;
    const slotsAvailable = MAX_CONCURRENCY - activeCount;
    if (slotsAvailable <= 0) return;

    const queued = this.entries.filter((e) => e.status === "queued");
    const toPromote = queued.slice(0, slotsAvailable);

    for (const entry of toPromote) {
      entry.status = "downloading";
      chrome.downloads.download(
        {
          url: entry.url,
          filename: entry.filename,
          conflictAction: "uniquify",
        },
        (downloadId) => {
          if (chrome.runtime.lastError || downloadId === undefined) {
            const err =
              chrome.runtime.lastError?.message ?? "download failed to start";
            this.handleFailure(entry.id, err);
            return;
          }
          entry.chromeDownloadId = downloadId;
          this.persist();
        }
      );
    }

    this.persist();
  }

  // -------------------------------------------------------------------------
  // Download event handlers (called from service worker listeners)
  // -------------------------------------------------------------------------

  async onDownloadComplete(chromeDownloadId: number): Promise<QueueEntry | null> {
    const entry = this.entries.find(
      (e) => e.chromeDownloadId === chromeDownloadId
    );
    if (!entry) return null;

    // Remove completed entry from the queue
    this.entries = this.entries.filter((e) => e.id !== entry.id);
    entry.status = "completed";
    await this.persist();
    this.processQueue();
    return entry;
  }

  async onDownloadInterrupted(
    chromeDownloadId: number,
    error: string
  ): Promise<QueueEntry | null> {
    const entry = this.entries.find(
      (e) => e.chromeDownloadId === chromeDownloadId
    );
    if (!entry) return null;

    await this.handleFailure(entry.id, error);
    return entry;
  }

  // -------------------------------------------------------------------------
  // Retry logic with exponential backoff
  // -------------------------------------------------------------------------

  private async handleFailure(entryId: string, error: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return;

    entry.chromeDownloadId = undefined;
    entry.error = error;

    if (entry.retryCount < MAX_RETRIES) {
      entry.retryCount++;
      const delayMs = BACKOFF_BASE_MS * Math.pow(2, entry.retryCount - 1);
      entry.status = "queued";
      await this.persist();
      setTimeout(() => this.processQueue(), delayMs);
    } else {
      entry.status = "failed";
      await this.persist();
      this.processQueue();
    }
  }

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  async cancel(entryId: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return;

    if (
      entry.chromeDownloadId !== undefined &&
      (entry.status === "downloading" || entry.status === "paused")
    ) {
      chrome.downloads.cancel(entry.chromeDownloadId);
    }

    this.entries = this.entries.filter((e) => e.id !== entryId);
    await this.persist();
    this.processQueue();
  }

  // -------------------------------------------------------------------------
  // Pause (individual or global)
  // -------------------------------------------------------------------------

  async pause(entryId?: string): Promise<void> {
    if (entryId) {
      const entry = this.entries.find((e) => e.id === entryId);
      if (!entry) return;

      if (
        entry.status === "downloading" &&
        entry.chromeDownloadId !== undefined
      ) {
        chrome.downloads.pause(entry.chromeDownloadId);
      }
      entry.status = "paused";
      await this.persist();
    } else {
      // Global pause
      this.paused = true;
      for (const entry of this.entries) {
        if (
          entry.status === "downloading" &&
          entry.chromeDownloadId !== undefined
        ) {
          chrome.downloads.pause(entry.chromeDownloadId);
          entry.status = "paused";
        }
      }
      await this.persist();
    }
  }

  // -------------------------------------------------------------------------
  // Resume (individual or global)
  // -------------------------------------------------------------------------

  async resume(entryId?: string): Promise<void> {
    if (entryId) {
      const entry = this.entries.find((e) => e.id === entryId);
      if (!entry || entry.status !== "paused") return;

      if (entry.chromeDownloadId !== undefined) {
        chrome.downloads.resume(entry.chromeDownloadId);
        entry.status = "downloading";
      } else {
        entry.status = "queued";
      }
      await this.persist();
      this.processQueue();
    } else {
      // Global resume
      this.paused = false;
      for (const entry of this.entries) {
        if (entry.status === "paused") {
          if (entry.chromeDownloadId !== undefined) {
            chrome.downloads.resume(entry.chromeDownloadId);
            entry.status = "downloading";
          } else {
            entry.status = "queued";
          }
        }
      }
      await this.persist();
      this.processQueue();
    }
  }

  // -------------------------------------------------------------------------
  // Retry (manual — user-initiated for failed downloads)
  // -------------------------------------------------------------------------

  async retry(entryId: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry || entry.status !== "failed") return;

    entry.retryCount = 0;
    entry.status = "queued";
    entry.error = undefined;
    entry.chromeDownloadId = undefined;
    await this.persist();
    this.processQueue();
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  getStatus(): { entries: QueueEntry[]; queuePaused: boolean } {
    return {
      entries: [...this.entries],
      queuePaused: this.paused,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  findByChromeId(chromeDownloadId: number): QueueEntry | undefined {
    return this.entries.find((e) => e.chromeDownloadId === chromeDownloadId);
  }

  get activeCount(): number {
    return this.entries.filter((e) => e.status === "downloading").length;
  }

  get queuedCount(): number {
    return this.entries.filter((e) => e.status === "queued").length;
  }
}
