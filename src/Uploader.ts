import { UploaderProps, EventName, EventMap } from './type';
import { chunkFile, getWorkerPoolSize } from './utils';

export class Uploader {
  private workers: Worker[] = [];
  private chunkSize: number;

  private listeners: {
    [K in EventName]: EventMap[K][];
  } = {
    [EventName.HashStart]: [],
    [EventName.HashProcess]: [],
    [EventName.HashFinished]: [],
    [EventName.HashError]: [],
  };
  private chunkHashes: string[] = [];
  private chunks: Blob[] = [];
  private nextResolveChunkIndex = 0;
  private resolvedChunkCount = 0;
  private hashError = false;

  constructor(props: UploaderProps) {
    const { chunkSize } = props;
    this.chunkSize = chunkSize;
    this.workers = this.createWorker();
    // 用户创建uploader实例，
    // 调用start传入File，开始计算hash，分片上传  保证一个实例可以上传多个文件不需要再每次上传时创建实例
  }

  start = (file: File) => {
    this.reset();
    this.computeChunkHashes(file);
  };

  private computeChunkHashes = (file: File) => {
    this.chunks = chunkFile(file, this.chunkSize);
    const hashStartListeners = this.getListener(EventName.HashStart);
    hashStartListeners.forEach((listener) => listener());
    this.workers.forEach(this.dispatchWorker);
  };

  private dispatchWorker = async (worker: Worker) => {
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
  };

  private getNextChunk = (): { chunk: Blob; index: number } | undefined => {
    const nextChunk = this.chunks[this.nextResolveChunkIndex];
    const currentResolvedChunkIndex = this.nextResolveChunkIndex;
    if (!nextChunk) {
      return undefined;
    }
    this.nextResolveChunkIndex++;
    return {
      chunk: nextChunk,
      index: currentResolvedChunkIndex,
    };
  };

  private createWorker = () => {
    const workerPoolSize = getWorkerPoolSize();
    const workers: Worker[] = [];
    for (let i = 0; i < workerPoolSize; i++) {
      const worker = new Worker(new URL('./hashWorker.ts', import.meta.url));
      worker.onmessage = (event) => {
        const { success, hash, index } = event.data;
        if (success && !this.hashError) {
          this.chunkHashes[index] = hash;
          this.resolvedChunkCount++;
          const chunkLen = this.chunks.length;
          if (this.resolvedChunkCount < chunkLen) {
            const hashProcessListener = this.getListener(EventName.HashProcess);
            hashProcessListener.forEach((listener) =>
              listener(Number((this.resolvedChunkCount / chunkLen).toFixed(2))),
            );
            this.dispatchWorker(worker);
          }
          if (this.resolvedChunkCount === chunkLen) {
            const hashFinishedListener = this.getListener(EventName.HashFinished);
            hashFinishedListener.forEach((listener) => listener());
            this.workers.forEach((worker) => worker.terminate());
          }
        } else {
          const hashErrorListener = this.getListener(EventName.HashError);
          const hashError = new Error('calculate hash error');
          this.hashError = true;
          hashErrorListener.forEach((listener) => listener(hashError));
          this.workers.forEach((worker) => worker.terminate());
        }
      };
      workers.push(worker);
    }
    return workers;
  };

  private getListener = <T extends EventName>(name: T): EventMap[T][] => {
    const listener = this.listeners[name] || [];
    return listener;
  };

  on = <T extends EventName>(name: T, listener: EventMap[T]) => {
    const listeners = this.getListener(name);
    const exited = listeners.includes(listener);
    if (exited) {
      console.warn('the callback has already been registered. please don,t register it again');
    } else {
      listeners.push(listener);
    }
  };

  remove = <T extends EventName>(name: T, listener: EventMap[T]) => {
    const listeners = this.getListener(name);
    (this.listeners[name] as EventMap[T][]) = listeners.filter((l) => l !== listener);
  };

  private reset = () => {
    this.hashError = false;
    this.resolvedChunkCount = 0;
    this.nextResolveChunkIndex = 0;
    this.chunks = [];
    this.chunkHashes = [];
    this.listeners = {
      [EventName.HashStart]: [],
      [EventName.HashProcess]: [],
      [EventName.HashFinished]: [],
      [EventName.HashError]: [],
    };
  };
}
