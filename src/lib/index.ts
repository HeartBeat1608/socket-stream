import Socket from './socket';
import IOStream, { IOStreamOptions } from './iostream';
import BlobReadStream, { BlobReadStreamOptions } from './blob-read-stream';

export {
  Buffer,
  Socket,
  IOStream,
}

export var forceBase64: boolean = false

export interface LookupStreamOptions extends IOStreamOptions {
  forceBase64?: boolean
}

export const lookup = (sio: any, options?: LookupStreamOptions): Socket => {
  options = options || {}
  if (!options.forceBase64) {
    options.forceBase64 = forceBase64
  }

  if (!sio._streamSocket) {
    sio._streamSocket = new Socket(sio, options)
  }

  return sio._streamSocket as Socket
}

export const createStream = (options: IOStreamOptions) => {
  return new IOStream(options)
}

export const createBlobReadStream = (blob: Blob, options: BlobReadStreamOptions) => {
  return new BlobReadStream(blob, options)
}

export default lookup