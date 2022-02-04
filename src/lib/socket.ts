import IOStream from './iostream';
import parser, { Decoder, Encoder } from './parser';
import { EventEmitter } from 'stream';
import { debug_factory } from './debug';

const emit = EventEmitter.prototype.emit
const on = EventEmitter.prototype.on
const slice = Array.prototype.slice

const debug = debug_factory('socket-stream:socket')

export interface InternalSocketOptions {
  forceBase64?: boolean;
}

export class SocketStreamError extends Error {
  remote?: boolean;

  constructor(message: string) {
    super(message)
  }
}

export var event = "$stream";
export var events = [
  'error',
  'newListener',
  'removeListener'
]

class Socket extends EventEmitter {

  sio: any;
  forceBase64: boolean;
  options: InternalSocketOptions;
  streams: { [k: string]: IOStream }
  encoder: Encoder;
  decoder: Decoder;

  constructor(sio: any, options?: InternalSocketOptions) {
    super()

    this.sio = sio
    this.options = options || {}
    this.forceBase64 = !!this.options.forceBase64
    this.streams = {}
    this.encoder = new parser.Encoder()
    this.decoder = new parser.Decoder()

    var eventName = event;
    this.sio.on(eventName, emit.bind(this))
    this.sio.on(eventName + "-read", this._onread)
    this.sio.on(eventName + "-write", this._onwrite)
    this.sio.on(eventName + "-end", this._onend)
    this.sio.on(eventName + "-error", this._onerror)

    this.sio.on("error", emit.bind(this, 'error'))
    this.sio.on("disconnect", this._ondisconnect)

    this.encoder.on('stream', this._onencode);
    this.decoder.on('stream', this._ondecode);
  }

  // Original Emit function
  $emit = emit

  emit(type: string): boolean {
    if (events.includes(type)) {
      return emit.call(this, type)
    }
    this._stream.call(this, type);
    return true
  }

  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    if (events.includes(eventName.toString())) {
      return on.call(this, eventName, listener) as this;
    }

    this._onstream(eventName.toString(), listener)
    return this
  }

  _stream(type: string) {
    debug('sending new stream')

    var self = this
    var args = slice.call(arguments, 1)
    var ack = args[args.length - 1];

    if (typeof ack === 'function') {
      args[args.length - 1] = function () {
        var args = slice.call(arguments)
        args = self.decoder.decode(args)
        ack.apply(this, args)
      }
    }

    args = this.encoder.encode(args)
    var sio = this.sio
    sio.emit.apply(sio, [event, type].concat(args))
  }

  _read(id: string, size: number) {
    this.sio.emit(event + '-read', id, size);
  }

  _write(id: string, chunk: string | ArrayBuffer | undefined, encoding: BufferEncoding, callback: (err?: Error, data?: any) => void) {
    if (Buffer.isBuffer(chunk)) {
      if (this.forceBase64) {
        encoding = 'base64'
        chunk = chunk.toString(encoding)
      } else if (!global.Buffer) {
        if ('toArraBuffer' in chunk) {
          chunk = (chunk as any).toArraBuffer()
        } else {
          chunk = (chunk as any).buffer
        }
      }
    }

    this.sio.emit(event + '-write', id, chunk, encoding, callback)
  }

  _end(id: string) {
    this.sio.emit(event + '-end', id)
  }

  _error(id: string, err?: Error) {
    this.sio.emit(event + '-error', id, err?.message || err)
  }

  _onstream(type: string, listener: (...args: any[]) => void) {
    if (typeof listener === 'function') {
      throw TypeError("listener needs to be a function, got " + typeof listener);
    }

    const onstream = (i_listener: (...args: any[]) => void) => () => {
      debug('new streams')

      var self = this as Socket;
      var args = slice.call(arguments)
      var ack = args[args.length - 1]

      if (typeof ack === 'function') {
        args[args.length - 1] = () => {
          var args = slice.call(arguments)
          args = self.encoder.encode(args)
          ack.apply(this, args)
        }
      }

      args = this.decoder.decode(args);
      i_listener.call(this, args)
    }

    on.call(this, type, onstream(listener))
  }

  _onread(id: string, size: number) {
    debug('read: %s', id)
    var stream = this.streams[id]

    if (!stream) {
      debug('read: ignoring invalid stream id')
      return;
    }

    stream._onread(size)
  }

  _onwrite(id: string, chunk: string | ArrayBuffer | undefined, encoding: BufferEncoding, callback: (err?: Error) => void) {
    debug('write: $s', id)

    var stream = this.streams[id]
    if (!stream) {
      debug('write: inavlid stream id %s', id)
      callback(new Error("inavlid stream id " + id))
      return;
    }

    if (global.ArrayBuffer && chunk instanceof ArrayBuffer) {
      chunk = Buffer.from(new Uint8Array(chunk))
    }

    stream._onwrite(chunk, encoding, callback)
  }

  _onend(id: string) {
    debug('end: %s', id)

    var stream = this.streams[id]
    if (!stream) {
      debug('end: ignore non-existent stream %s', id)
      return;
    }

    stream._end();
  }

  _onerror(id: string, error: string) {
    debug('error: "%s", "%s"', id, error);

    var stream = this.streams[id];
    if (!stream) {
      debug('invalid stream id: "%s"', id);
      return;
    }

    var err = new SocketStreamError(error);
    err.remote = true;
    stream.emit('error', err);
  }

  _ondisconnect() {
    var stream: IOStream;
    for (var id in this.streams) {
      stream = this.streams[id];
      stream.destroy();

      // Close streams when the underlaying
      // socket.io connection is closed (regardless why)
      stream.emit('close');
      stream.emit('error', new SocketStreamError('Connection aborted'));
    }
  }

  _onencode(stream: IOStream) {
    if (stream.socket || stream.destroyed) {
      throw new SocketStreamError("stream has already been sent.")
    }

    var id = stream.id
    if (this.streams[id]) {
      this._error(id, new SocketStreamError("Decoded stream already exisits: " + id))
      return;
    }

    this.streams[id] = stream;
    stream.socket = this;
  }

  _ondecode(stream: IOStream) {
    var id = stream.id
    if (this.streams[id]) {
      this._error(id, new SocketStreamError("Decoded stream already exisits: " + id))
      return;
    }

    this.streams[id] = stream;
    stream.socket = this;
  }

  cleanup(id: string) {
    delete this.streams[id]
  }
}

export default Socket