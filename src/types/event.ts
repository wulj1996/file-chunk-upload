export enum UploaderEventName {
  HashStart = 'HashStart',
  HashProcess = 'HashProcess',
  HashFinished = 'HashFinished',
  HashError = 'HashError',
  UploadStart = 'UploadStart',
  UploadProcess = 'UploadProcess',
  UploadFinished = 'UploadFinished',
  UploadError = 'UploadError',
}

export type UploaderEventMap = {
  [UploaderEventName.HashStart]: () => void;
  [UploaderEventName.HashProcess]: (progress: number) => void;
  [UploaderEventName.HashFinished]: (chunkHashes: string[]) => void;
  [UploaderEventName.HashError]: (error: Error) => void;
  [UploaderEventName.UploadStart]: () => void;
  [UploaderEventName.UploadProcess]: (progress: number) => void;
  [UploaderEventName.UploadFinished]: () => void;
  [UploaderEventName.UploadError]: (error: Error, chunkIndex: number) => void;
};
