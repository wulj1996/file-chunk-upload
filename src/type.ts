export interface UploadChunk {
  index: number;
  hash: string;
  chunk: Blob;
  chunkSize: number;
  totalChunks: number;
}

export interface UploaderProps {
  chunkSize: number;

  concurrency: number;

  retryCount: number;

  uploadChunk: (params: UploadChunk) => Promise<void>;

  onHashStart?: () => void;

  onHashProcess?: (progress: number) => void;

  onHashFinished?: (chunkHashes: string[]) => void;

  onHashError?: (error: Error) => void;

  onUploadProgress?: (progress: number) => void;

  onUploadFinished?: () => void;

  onUploadError?: (error: Error, chunkIndex: number) => void;
}
