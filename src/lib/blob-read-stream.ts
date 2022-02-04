import internal, { Readable } from 'stream'

export interface BlobReadStreamOptions extends internal.ReadableOptions { }

class BlobReadStream extends Readable {

  blob: Blob
  slice: {
    (start?: number | undefined, end?: number | undefined, contentType?: string | undefined): Blob;
    (start?: number | undefined, end?: number | undefined, contentType?: string | undefined): Blob;
  }
  start: number = 0
  fileReader: FileReader;

  constructor(blob: Blob, options?: BlobReadStreamOptions) {
    super(options)

    options = options || {}
    this.blob = blob
    this.slice = blob.slice
    this.start = 0


    var fileReader = new FileReader()
    fileReader.onload = this._onload
    fileReader.onerror = this._onerror
    this.fileReader = fileReader
  }

  _onload(e: ProgressEvent<FileReader>) {
    if (!e.target) return;
    if (typeof e.target.result === 'string') {
      this.push(Buffer.from(e.target.result))
    } else if (e.target.result instanceof ArrayBuffer) {
      this.push(Buffer.from(new Uint8Array(e.target.result)))
    }
  }

  _onerror(e: ProgressEvent<FileReader>) {
    if (!e.target) return;
    const err = e.target.error
    if (err) {
      this.emit('error', err)
    }
  }

  _read(size: number): void {
    var start = this.start
    var end = this.start = this.start + size;
    var chunk = this.slice.call(this.blob, start, end)

    if (chunk.size) {
      this.fileReader.readAsArrayBuffer(this.blob)
    } else {
      this.push(null)
    }
  }
}

export default BlobReadStream