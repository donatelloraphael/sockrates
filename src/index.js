function noop() {}

function Socket(url, opts) {
  opts = opts || {};

  var ws,
    $ = {},
    timer,
    attempts = 0,
    maxAttemps = opts.maxAttempts || Infinity,
    timeout = opts.timeout || 5e3,
    isConnected = false,
    isConnecting = false,
    heartBeatTime = opts.heartBeat,
    heartBeatInterval,
    reconnectTime = opts.reconnect,
    reconnectInterval,
    isReconnect = false;

  $.open = function () {
    if (isConnected || isConnecting) return;

    ws = new WebSocket(url, opts.protocols || []);

    ws.onopen = function (e) {
      (opts.onopen || noop)(e);
      attempts = 0;
      isConnecting = false;
      isConnected = true;

      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);
      if (reconnectTime) {
        setSocketReconnect();
      }
      if (heartBeatTime) {
        setSocketHeartBeat();
      }
    };

    ws.onclose = function (e) {
      (opts.onclose || noop)(e);

      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);
      clearTimeout(timer);

      attempts = 0;
      maxAttemps = opts.maxAttemps || Infinity;
      isConnected = false;
      isConnecting = false;

      if (isReconnect) {
        $.reconnect(e);
        isReconnect = false;
      } else if (e.code === 1e3 || e.code === 1001 || e.code === 1005) {
        $.reconnect(e);
      }
    };

    ws.onmessage = function (e) {
      (opts.onmessage || noop)(e);
      setSocketHeartBeat();
    };

    ws.onerror = function (e) {
      isConnected = false;
      isConnecting = false;

      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);
      clearTimeout(timer);

      e && e.code === "ECONNREFUSED"
        ? $.reconnect(e)
        : (opts.onerror || noop)(e);
    };
  };

  $.reconnect = function (e) {
    if (attempts++ < maxAttemps) {
      (opts.onreconnect || noop)(e);
      $.open();
    } else {
      (opts.onmaximum || noop)(e);
    }
  };

  $.json = function (x) {
    ws.send(JSON.stringify(x));
  };

  $.send = function (x) {
    ws.send(x);
  };

  $.close = function (x, y) {
    ws.close(x || 1e3, y);
  };

  function setSocketHeartBeat() {
    if (!heartBeatTime) return;
    clearInterval(heartBeatInterval)

    let heartBeatStart = Date.now();
    heartBeatInterval = setInterval(() => {
      console.log(isConnecting)
      if (!isConnected || isConnecting) return;
      if (heartBeatStart + heartBeatTime < Date.now()) {
        ws.send("ping");
       heartBeatStart = Date.now();
      }
    }, 1e3);
  }

  function setSocketReconnect() {
    if (!reconnectTime) return;
    clearInterval(reconnectInterval);
    
    const reconnectStart = Date.now();
    const reconnectEnd = reconnectStart + reconnectTime;
    
    reconnectInterval = setInterval(() => {
      if (!isConnected) return;
      if (reconnectEnd < Date.now()) {
        isReconnect = true;
        ws.close();
      }
    }, 1e3);
  }

  return $;
}
