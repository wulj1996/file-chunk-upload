export function getWorkerPoolSize(): number {
  const coreCount = navigator.hardwareConcurrency || 4;
  const poolSize = Math.floor(coreCount / 2);
  return Math.max(poolSize, 1);
}

export function chunkFile(file: File, chunkSize: number): Blob[] {
  const chunkNumber = Math.ceil(file.size / chunkSize);
  const chunks: Blob[] = [];
  for (let i = 0; i < chunkNumber; i++) {
    const start = i * chunkSize;
    const end = (i + 1) * chunkSize;
    const chunk = file.slice(start, end);
    chunks.push(chunk);
  }
  return chunks;
}