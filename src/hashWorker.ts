import SparkMD5 from 'spark-md5';

self.onmessage = (event: MessageEvent) => {
  const { chunk, index } = event.data;
  try {
    const hash = new SparkMD5.ArrayBuffer().append(chunk).end();
    self.postMessage({
      hash,
      index,
      success: true,
    });
  } catch (err) {
    self.postMessage({
      hash: '',
      index,
      success: false,
      error: err instanceof Error ? err.message : 'unknown hash error',
    });
  }
};
