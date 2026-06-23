import { UploadChunk, UploaderProps } from '../types';
import { chunkFile, getWorkerPoolSize } from '../utils';
import { ConcurrentExecutor } from './ConcurrentExecutor';

export class Uploader {
  private workers: Worker[] = [];
  private chunkSize: number;
  private concurrency: number;
  private retryCount: number;

  private chunkHashes: string[] = [];
  private chunks: Blob[] = [];
  private nextResolveChunkIndex = 0;
  private resolvedChunkCount = 0;
  private hashError = false;

  private onHashStart: UploaderProps['onHashStart'];
  private onHashProcess: UploaderProps['onHashProcess'];
  private onHashFinished: UploaderProps['onHashFinished'];
  private onHashError: UploaderProps['onHashError'];

  private onUploadProgress: UploaderProps['onUploadProgress'];
  private onUploadFinished: UploaderProps['onUploadFinished'];
  private onUploadError: UploaderProps['onUploadError'];

  private uploadChunkFn: UploaderProps['uploadChunk'];

  private uploadExecutor: ConcurrentExecutor | null = null;

  constructor(props: UploaderProps) {
    const {
      chunkSize,
      concurrency,
      retryCount,
      uploadChunk,
      onHashStart,
      onHashProcess,
      onHashFinished,
      onHashError,
      onUploadProgress,
      onUploadFinished,
      onUploadError,
    } = props;
    this.chunkSize = chunkSize;
    this.concurrency = concurrency;
    this.retryCount = retryCount;
    this.uploadChunkFn = uploadChunk;
    this.onHashStart = onHashStart;
    this.onHashProcess = onHashProcess;
    this.onHashFinished = onHashFinished;
    this.onHashError = onHashError;
    this.onUploadProgress = onUploadProgress;
    this.onUploadFinished = onUploadFinished;
    this.onUploadError = onUploadError;
  }

  start = (file: File) => {
    if (!(file instanceof Blob)) {
      throw new TypeError('file must be a File or Blob');
    }
    if (file.size === 0) {
      throw new Error('file must not be empty');
    }
    if (this.chunkSize <= 0) {
      throw new RangeError('chunkSize must be greater than 0');
    }
    this.reset();
    this.chunks = chunkFile(file, this.chunkSize);
    this.workers = this.createWorker(this.chunks.length);
    this.computeChunkHashes();
  };

  private computeChunkHashes = () => {
    this.onHashStart?.();
    this.workers.forEach(this.dispatchWorker);
  };

  private dispatchWorker = async (worker: Worker) => {
    try {
      const nextChunk = this.getNextChunk();
      if (nextChunk) {
        const { chunk, index } = nextChunk;
        const chunkArrayBuffer = await chunk.arrayBuffer();
        worker.postMessage(
          {
            chunk: chunkArrayBuffer,
            index,
          },
          [chunkArrayBuffer],
        );
      }
    } catch (err) {
      this.handleHashError(err instanceof Error ? err : new Error('read or dispatch chunk failed'));
    }
  };

  private getNextChunk = (): { chunk: Blob; index: number } | undefined => {
    const nextChunk = this.chunks[this.nextResolveChunkIndex];
    const nextIndex = this.nextResolveChunkIndex;
    if (!nextChunk) {
      return undefined;
    }
    this.nextResolveChunkIndex++;
    return {
      chunk: nextChunk,
      index: nextIndex,
    };
  };

  private createWorker = (chunkCount: number) => {
    const workerPoolSize = Math.min(getWorkerPoolSize(), chunkCount);
    const workers: Worker[] = [];
    for (let i = 0; i < workerPoolSize; i++) {
      const worker = new Worker(new URL('../workers/hashWorker.ts', import.meta.url));
      worker.onmessage = (event) => {
        const { success, hash, index, error: workerError } = event.data;
        if (success && !this.hashError) {
          this.chunkHashes[index] = hash;
          this.resolvedChunkCount++;
          const chunkLen = this.chunks.length;
          if (this.resolvedChunkCount < chunkLen) {
            this.onHashProcess?.(Number((this.resolvedChunkCount / chunkLen).toFixed(2)));
            this.dispatchWorker(worker);
          }
          if (this.resolvedChunkCount === chunkLen) {
            this.onHashFinished?.(this.chunkHashes);
            this.terminateWorkers();
            this.startUpload();
          }
        } else if (!this.hashError) {
          this.handleHashError(new Error(workerError || 'calculate hash error'));
        }
      };
      workers.push(worker);
    }
    return workers;
  };

  private terminateWorkers = () => {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
  };

  private handleHashError = (error: Error) => {
    if (this.hashError) return;
    this.hashError = true;
    this.onHashError?.(error);
    this.terminateWorkers();
  };

  private startUpload = () => {
    const totalChunks = this.chunks.length;
    const tasks: UploadChunk[] = this.chunks.map((chunk, i) => ({
      index: i,
      hash: this.chunkHashes[i],
      chunk,
      chunkSize: chunk.size,
      totalChunks,
    }));

    this.uploadExecutor = new ConcurrentExecutor({
      concurrency: this.concurrency,
      retryCount: this.retryCount,
      executor: async (task) => {
        await this.uploadChunkFn(task);
      },
      onProgress: (completed, total) => {
        const progress = Number((completed / total).toFixed(2));
        this.onUploadProgress?.(progress);
      },
    });

    this.uploadExecutor.start(tasks).then(
      () => {
        this.onUploadFinished?.();
      },
      (err) => {
        this.onUploadError?.(err instanceof Error ? err : new Error(String(err)), -1);
      },
    );
  };

  private reset = () => {
    this.hashError = false;
    this.resolvedChunkCount = 0;
    this.nextResolveChunkIndex = 0;
    this.chunks = [];
    this.chunkHashes = [];
    this.uploadExecutor = null;
  };
}