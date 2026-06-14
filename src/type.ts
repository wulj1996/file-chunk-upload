export interface UploaderProps {
  /** 分片大小 */
  chunkSize: number;

  /** 并发数量 */
  concurrency: number;

  /** 重试次数 */
  retryCount: number;
}

export enum EventName {
  HashStart = 'HashStart',
  HashProcess = 'HashProcess',
  HashFinished = 'HashFinished',
  HashError = 'HashError',
}

export interface EventMap {
  [EventName.HashStart]: () => void;
  [EventName.HashProcess]: (progress: number) => void;
  [EventName.HashFinished]: () => void;
  [EventName.HashError]: (err: Error) => void;
}
