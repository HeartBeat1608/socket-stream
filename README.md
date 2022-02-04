# Socket.IO Streaming Support

Stream files using the latest socket.io client and server SDKs. Uses recent upgrades to these libraries and some performance improvements from it's ancestor [socket.io-stream](https://github.com/nkzawa/socket.io-stream.git).

# Usage

If you are not familiar with Stream API, be sure to check out [the docs](http://nodejs.org/api/stream.html).
I also recommend checking out the awesome [Stream Handbook](https://github.com/substack/stream-handbook).

For streaming between server and client, you will send stream instances first.
To receive streams, you just wrap `socket` with `socket-stream`, then listen any events as usual.

Server:

```js
var io = require('socket.io').listen(80);
var ss = require('socket-stream');
var path = require('path');

io.of('/user').on('connection', function(socket) {
  ss(socket).on('profile-image', function(stream, data) {
    var filename = path.basename(data.name);
    stream.pipe(fs.createWriteStream(filename));
  });
});
```

`createStream()` returns a new stream which can be sent by `emit()`.

Client:

```js
var io = require('socket.io-client');
var ss = require('socket-stream');

var socket = io.connect('http://example.com/user');
var stream = ss.createStream();
var filename = 'profile.jpg';

ss(socket).emit('profile-image', stream, {name: filename});
fs.createReadStream(filename).pipe(stream);
```

You can stream data from a client to server, and vice versa.

```js
// send data
ss(socket).on('file', function(stream) {
  fs.createReadStream('/path/to/file').pipe(stream);
});

// receive data
ss(socket).emit('file', stream);
stream.pipe(fs.createWriteStream('file.txt'));
```

#### Upload progress

You can track upload progress like the following:

```js
var blobStream = ss.createBlobReadStream(file);
var size = 0;

blobStream.on('data', function(chunk) {
  size += chunk.length;
  console.log(Math.floor(size / file.size * 100) + '%');
  // -> e.g. '42%'
});

blobStream.pipe(stream);
```


## Documentation

### ss(sio)

- sio `socket.io Socket` A socket of Socket.IO, both for client and server
- return `Socket`

Look up an existing `Socket` instance based on `sio` (a socket of Socket.IO), or create one if it doesn't exist.

### socket.emit(event, [arg1], [arg2], [...])

- event `String` The event name

Emit an `event` with variable number of arguments including at least a stream.

```js
ss(socket).emit('myevent', stream, {name: 'thefilename'}, function() { ... });

// send some streams at a time.
ss(socket).emit('multiple-streams', stream1, stream2);

// as members of array or object.
ss(socket).emit('flexible', [stream1, { foo: stream2 }]);

// get streams through the ack callback
ss(socket).emit('ack', function(stream1, stream2) { ... });
```

### socket.on(event, listener)

- event `String` The event name
- listener `Function` The event handler function

Add a `listener` for `event`. `listener` will take stream(s) with any data as arguments.

```js
ss(socket).on('myevent', function(stream, data, callback) { ... });

// access stream options
ss(socket).on('foo', function(stream) {
  if (stream.options && stream.options.highWaterMark > 1024) {
    console.error('Too big highWaterMark.');
    return;
  }
});
```

### ss.createStream([options])

- options `Object`
    - highWaterMark `Number`
    - encoding `String`
    - decodeStrings `Boolean`
    - objectMode `Boolean`
    - allowHalfOpen `Boolean` if `true`, then the stream won't automatically close when the other endpoint ends. Default to `false`.
- return `Duplex Stream`

Create a new duplex stream. See [the docs](http://nodejs.org/api/stream.html) for the details of stream and `options`.

```js
var stream = ss.createStream();

// with options
var stream = ss.createStream({
  highWaterMark: 1024,
  objectMode: true,
  allowHalfOpen: true
});
```

### ss.createBlobReadStream(blob, [options])

- options `Object`
    - highWaterMark `Number`
    - encoding `String`
    - objectMode `Boolean`
- return `Readable Stream`

Create a new readable stream for [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [File](https://developer.mozilla.org/en-US/docs/Web/API/File) on browser. See [the docs](http://nodejs.org/api/stream.html) for the details of stream and `options`.

```js
var stream = ss.createBlobReadStream(new Blob([1, 2, 3]));
```

### ss.Buffer

[Node Buffer](https://nodejs.org/api/buffer.html) class to use on browser, which is exposed for convenience. On Node environment, you should just use normal `Buffer`.

```js
var stream = ss.createStream();
stream.write(new ss.Buffer([0, 1, 2]));
```

# Shoutout
Kudos to @nkzawa [Naoyuki Kanezawa] for writing the original library which this library is based on. 

# Typescript
This project is built using Typescript to enable type definitions for the users. 

# Contributions
This project is open to contributions and collaborations. Feel free to open a Pull Request and I will be happy to review them.

# Sponsors
None. Hopefully you can sponsor this project if you find it useful :)

## License
MIT