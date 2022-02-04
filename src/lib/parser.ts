import { EventEmitter } from 'events';
import IOStream, { IOStreamOptions } from './iostream';
const slice = Array.prototype.slice

type EncodedStream = { $stream: string; options?: IOStreamOptions };
type EncodedObjectType = { [k: string | number | symbol]: any }

export class Encoder extends EventEmitter {
  constructor() {
    super()
  }

  encode(v: any): any {
    if (v instanceof IOStream) {
      return this.encodeStream(v);
    } else if (Array.isArray(v)) {
      return this.encodeArray(v)
    } else if (v && 'object' === typeof v) {
      return this.encodeObject(v);
    }

    return v
  }

  encodeStream(stream: IOStream): EncodedStream {
    this.emit('stream', stream)

    var v: EncodedStream = { $stream: stream.id }
    if (stream.options) {
      v.options = stream.options;
    }

    return v;
  }

  encodeArray(arr: Array<any>): Array<any> {
    var v = []
    for (let i = 0; i < arr.length; i++) {
      v.push(this.encode(arr[i]))
    }

    return v;
  }

  encodeObject(obj: EncodedObjectType): EncodedObjectType {
    var v: EncodedObjectType = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        v[key] = this.encode(obj[key])
      }
    }

    return v
  }
}

export class Decoder extends EventEmitter {
  constructor() {
    super()
  }

  decode(v: any): any {
    if (v && v.$stream) {
      return this.decodeStream(v)
    } else if (Array.isArray(v)) {
      return this.decodeArray(v)
    } else if (v && typeof v === 'object') {
      return this.decodeObject(v)
    }

    return v;
  }

  decodeStream(obj: EncodedStream): IOStream {
    var stream = new IOStream(obj.options || {})
    stream.id = obj.$stream
    this.emit('stream', stream)
    return stream
  }

  decodeArray(arr: Array<any>): Array<any> {
    var v = []
    for (let i = 0; i < arr.length; i++) {
      v.push(this.decode(arr[i]))
    }

    return v;
  }

  decodeObject(obj: EncodedObjectType): EncodedObjectType {
    var v: EncodedObjectType = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        v[key] = this.decode(obj[key])
      }
    }

    return v
  }
}

export default { Encoder, Decoder }