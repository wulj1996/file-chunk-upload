import { UploadChunk } from '../types';

export interface ConcurrentExecutorOptions {
  concurrency: number;
  retryCount: number;
  executor: (task: UploadChunk) => Promise<void>;
  onProgress: (completed: number, total: number) => void;
}

export class ConcurrentExecutor {
  private concurrency: number;
  private retryCount: number;
  private executor: (task: UploadChunk) => Promise<void>;
  private onProgress: (completed: number, total: number) => void;

  constructor(options: ConcurrentExecutorOptions) {
    const { concurrency, retryCount, executor, onProgress } = options;
    this.concurrency = concurrency;
    this.retryCount = retryCount;
    this.executor = executor;
    this.onProgress = onProgress;
  }

  start = (tasks: UploadChunk[]) => {
    return new Promise<void>((resolve, reject) => {
      const total = tasks.length;

      if (total === 0) {
        resolve();
        return;
      }

      let nextIndex = 0;
      let completedCount = 0;
      let settled = false;

      const runNext = async () => {
        if (settled) return;

        const currentIndex = nextIndex++;
        if (currentIndex >= total) return;

        try {
          await this.excuteWithRetry(tasks[currentIndex]);

          if (settled) return;

          completedCount++;
          this.onProgress(completedCount, total);

          if (completedCount >= total) {
            settled = true;
            resolve();
            return;
          }

          runNext();
        } catch (error) {
          if (!settled) {
            settled = true;
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }
      };

      const concurrency = Math.min(this.concurrency, total);
      for (let i = 0; i < concurrency; i++) {
        runNext();
      }
    });
  };

  private excuteWithRetry = async (task: UploadChunk) => {
    let lastError: Error | undefined;
    const maxAttempts = this.retryCount + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.executor(task);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
        }
      }
    }

    throw lastError;
  };
}