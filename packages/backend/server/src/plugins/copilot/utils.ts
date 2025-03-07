import { Readable } from 'node:stream';

import { BlobQuotaExceeded } from '../../base';

export async function readBufferFromStream(
  readable: Readable,
  checkExceeded: (recvSize: number) => boolean
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    readable.on('data', chunk => {
      totalSize += chunk.length;

      // check size after receive each chunk to avoid unnecessary memory usage
      if (checkExceeded(totalSize)) {
        reject(new BlobQuotaExceeded());
        readable.destroy(new BlobQuotaExceeded());
        return;
      }
      chunks.push(chunk);
    });

    readable.on('error', reject);
    readable.on('end', () => {
      const buffer = Buffer.concat(chunks, totalSize);

      if (checkExceeded(buffer.length)) {
        reject(new BlobQuotaExceeded());
      } else {
        resolve(buffer);
      }
    });
  });
}
