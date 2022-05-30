<div align="center">
  <img src="https://raw.githubusercontent.com/donatelloraphael/sockrates/develop/cover.png" alt="Sockrates" height="250" />
</div>

<h1 align="center">Sockrates</h1>

Sockrates is a flexible browser side Websockets client with a small footprint (1KB minified and gzipped). It is a wrapper around the native WebSocket api of the browser and runs in a Web Worker. It supports the following features:

## Features
- Automatic reconnects. Even in background!
- Automatic retry in case of connection failure with exponential backoff and random variance.
- Can use the heartbeat feature which sends a ping to the server at your chosen interval to keep the connection alive.
- Can use the reconnect feature which can close the connection after a certain time after it has been opened and immediately reopen the connection again. This is especially useful for certain WebSocket servers which has a time limit on the duration the websocket connection is kept open.
- Ability to configure event listeners after the Sockrates object has been created and reconfigure whenever you want.
- Ablility to create multiple instances.
- Supports configuration to allow adding messages to a queue when not connected, and send the all of the backlogged messages upon server reconnect.

Sockrates runs on a web worker thread instead of the main thread. Because of this, Sockrates doesn't affect the performance of the main thread and because it is running on a web worker, it allows instant reconnects on connection drop since web workers are not in any way restricted from running in the background when you switch to other browser tabs.


## Install


```
$ npm install --save sockrates
```

## Usage
```js
import Sockrates from "sockrates";

// All config options except the url are optional, even the configuration object.
const socket = new Sockrates("ws://127.0.0.1:8080/", {
   heartBeatInterval: 5 * 60 * 1000, 
   reconnectInterval: 2 * 3600 * 1000,
   maxAttempts: 10,
   protocols: [],
   pingPayload: "ping"
 });

 socket.onopen = function() {
    console.log("ONOPEN")
  }
  socket.onclose = function() {
    console.log("ONCLOSE")
  }
  socket.onerror = function() {
    console.log("ONERROR")
  }
  socket.onreconnect = function() {
    console.log("ONRECONNECT")
  }
  socket.onmaximum = function() {
    console.log("ONMAXIMUM")
  }
  socket.onmessage = function(e) {
    console.log("ONMESSAGE", e)
  }

  socket.open(); // Need to open the connection before we can use it.
  socket.send("Hi"); // Just calls the websocket `send` method.
  socket.json({ action:"ping" }); // Calls JSON.stringify before calling the websocket send method.
  socket.close(); // Graceful shutdown.
```

## API

### Sockrates(url, options)

Returns: "`Sockrates`

Returns a `Sockrates` instance.

#### url
Type: `String`

Websocket connection url. Starts with either `ws://` or `wss://`

#### options.heartBeatInterval
Type: `Number`

The interval duration which should be used for sending heartbeat messages, in milliseconds. Omit to disable heartbeat feature.

#### options.pingPayload
Type: `String`<br>
Default: `"ping"`

The string to be used as the hearbeat payload.

#### options.reconnectInterval
Type: `Number`

The interval duration after which the websocket connection will be closed and reopened again, in milliseconds.

#### options.maxAttempts
Type: `Number`<br>
Default: `Infinity`

The maximum number of reconnection attempts in case of connection drop after which Sockrates stops retrying. Default is `Infinity`. Provide `0` to disable this feature.

#### options.protocols
Type: `String|Array`

Either protocol as a string or sub-protocols as an array.

### onopen
Type: `Function`

The event handler that should be run on opening a connection.

### onmessage
Type: `Function`

The event handler to be run in case of an incoming message. Receives the payload as the only argument.
### onclose
Type: `Function`

The event handler to be run in case of normal closing of websocket connection.

### onerror
Type: `Function`

The event handler to be run in case of an abrupt closing of the websocket connection.

### onreconnect
Type: `Function`

The event handler to be run in case of a successful reconnect.

### onmaximum
Type: `Function`

The event handler to be run in case of maximum number of reconnection attempts have been made.

### open()

Initializes and opens a Websocket connection.

### close()

Gracefully shuts down the websocket connection.

### send(data, backlog)

Sends the `data` to the server through Websocket. Set the `backlog` argument to `true` to enable backlog of messages when connection is lost that will be sent when it reconnects. Backlog default is `false`.

### json(data, backlog)

Calls `JSON.stringify` on data before sending to the server. Set the `backlog` argument to `true` to enable backlog of messages when connection is lost that will be sent when it reconnects. Backlog default is `false`.


## Licence

MIT © [Akbar E K](https://github.com/donatelloraphael)
