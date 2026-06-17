export interface UploaderProps {
  /** 分片大小 */
  chunkSize: number;

  /** 并发数量 */
  concurrency: number;

  /** 重试次数 */
  retryCount: number;

  /** hash 计算开始 */
  onHashStart?: () => void;

  /** hash 计算进度 (0-1) */
  onHashProcess?: (progress: number) => void;

  /** hash 计算完成 */
  onHashFinished?: (chunkHashes: string[]) => void;

  /** hash 计算出错 */
  onHashError?: (error: Error) => void;
}
