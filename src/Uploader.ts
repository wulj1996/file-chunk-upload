import { UploaderProps } from './type';
import { chunkFile, getWorkerPoolSize } from './utils';

export class Uploader {
  private workers: Worker[] = [];
  private chunkSize: number;

  private chunkHashes: string[] = [];
  private chunks: Blob[] = [];
  private nextResolveChunkIndex = 0;
  private resolvedChunkCount = 0;
  private hashError = false;

  private onHashStart: UploaderProps['onHashStart'];
  private onHashProcess: UploaderProps['onHashProcess'];
  private onHashFinished: UploaderProps['onHashFinished'];
  private onHashError: UploaderProps['onHashError'];

  constructor(props: UploaderProps) {
    const { chunkSize, onHashStart, onHashProcess, onHashFinished, onHashError } = props;
    this.chunkSize = chunkSize;
    this.onHashStart = onHashStart;
    this.onHashProcess = onHashProcess;
    this.onHashFinished = onHashFinished;
    this.onHashError = onHashError;
    // 用户创建uploader实例，
    // 调用start传入File，开始计算hash，分片上传  保证一个实例可以上传多个文件不需要再每次上传时创建实例
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
      const worker = new Worker(new URL('./hashWorker.ts', import.meta.url));
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

  private reset = () => {
    this.hashError = false;
    this.resolvedChunkCount = 0;
    this.nextResolveChunkIndex = 0;
    this.chunks = [];
    this.chunkHashes = [];
  };
}
