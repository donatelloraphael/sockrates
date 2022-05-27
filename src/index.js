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
    heartBeatStart,
    reconnectTime = opts.reconnect,
    reconnectInterval,
    reconnectStart,
    isReconnect = false;

  $.open = function () {
    if (isConnected || isConnecting) return;
    isConnecting = true;
    isConnected = true;

    ws = new WebSocket(url, opts.protocols || []);

    ws.onopen = function (e) {
      console.log("ONOPEN");
      (opts.onopen || noop)(e);
      attempts = 0;

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
      heartBeatStart = null;
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
      timer = null;

      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);

      e && e.code === "ECONNREFUSED"
        ? $.reconnect(e)
        : (opts.onerror || noop)(e);
    };
  };

  $.reconnect = function (e) {
    if (!timer && attempts++ < maxAttemps) {
      timer = setTimeout(function () {
        (opts.onreconnect || noop)(e);
        $.open();
      }, timeout);
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
    if (!heartBeatInterval) return;

    heartBeatStart = Date.now();
    clearInterval(heartBeatInterval);

    heartBeatInterval = setInterval(() => {
      if (!isConnected) return;
      if (heartBeatStart + heartBeatTime < Date.now()) {
        ws.send("ping");
        heartBeatStart = Date.now();
      }
    }, 1e3);
  }

  function setSocketReconnect() {
    if (!reconnectTime) return;
    
    reconnectStart = Date.now();
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
