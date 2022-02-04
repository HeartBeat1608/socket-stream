import { Duplex, DuplexOptions } from 'stream';
import { debug_factory } from './debug';
import Socket from './socket';
import uuid from './uuid';

const debug = debug_factory('socket-stream:iostream')

export interface IOStreamOptions extends DuplexOptions { }

type TFunction<RType> = () => RType;

class IOStream extends Duplex {

  options: IOStreamOptions;
  id: string = "";

  socket?: Socket;

  pushBuffer: Array<TFunction<boolean>>;
  writeBuffer: Array<TFunction<void>>;

  _readable: boolean = false;
  _writable: boolean = false;

  constructor(options: IOStreamOptions) {
    super(options)

    this.options = options
    this.id = uuid();

    this.pushBuffer = []
    this.writeBuffer = []

    this._readable = false
    this._writable = false
    this.destroyed = false

    this.allowHalfOpen = options && options.allowHalfOpen || false

    this.on('finish', this._onfinish);
    this.on('end', this._onend);
    this.on('error', this._onerror);
  }

  destroy(error?: Error): this {
    if (this.destroyed) {
      debug(`stream ${this.id} already destroyed`)
      return this;
    }

    this.readable = this._readable = this._writable = false

    if (this.socket) {
      debug('socket cleanup')
      this.socket.cleanup(this.id)
      this.socket = undefined;
    }

    return this;
  }

  _read(size: number): void {
    if (this.destroyed) return;

    var push;
    if (this.pushBuffer.length) {
      while (push = this.pushBuffer.shift()) {
        if (!push()) break;
      }
      return;
    }

    this._readable = true
    this.socket?._read(this.id, size)
  }

  _onread(size: number) {
    var write = this.writeBuffer.shift();
    if (write) return write();

    this._writable = true;
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    var self = this

    function write() {
      if (self.destroyed) return;

      self._writable = false;
      self.socket?._write(self.id, chunk, encoding, callback)
    }

    if (this._writable) {
      write()
    } else {
      this.writeBuffer.push(write)
    }
  }

  _onwrite(chunk: any, encoding: BufferEncoding, callback: (error?: Error) => void): void {
    var self = this;

    function push() {
      self._readable = false;
      var ret = self.push(chunk || "", encoding)
      callback()
      return ret
    }

    if (this._readable) {
      push()
    } else {
      this.pushBuffer.push(push)
    }
  }

  _end() {
    if (this.pushBuffer.length) {
      this.pushBuffer.push(this._done.bind(this))
    }
  }

  _done() {
    this._readable = false
    return this.push(null)
  }

  _onfinish() {
    debug('_onfinish')

    if (this.socket) {
      this.socket._end(this.id)
    }

    this._writable = false;

    if (this.readable || this.readableEnded) {
      debug('_onfinish: ended, destroy', this.readableEnded);
      return this.destroy()
    }

    debug('_onfinish: not ended')

    if (this.allowHalfOpen) {
      this.push(null)

      if (this.readable && !this.readableEnded) {
        this.read(0);
      }
    }
  }

  _onend() {
    debug('_onend')

    this._readable = false
    this.readable = false

    if (!this.writable || this.writableEnded) {
      debug('_onend: %s', this.writableEnded)
      return this.destroy()
    }

    debug('_onend: not finished')

    if (!this.allowHalfOpen) {
      this.end()
    }
  }

  _onerror(err?: any) {
    if (err && !err.remote && this.socket) {
      this.socket._error(this.id, err)
    }

    this.destroy()
  }
}

export default IOStream