function noop() {}
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function Socket(url, opts = {}) {

  let ws,
    $ = {},
    attempts = 0,
    maxAttemps = opts.maxAttempts || Infinity,
    isConnected = false,
    heartBeatTime = opts.heartBeat,
    heartBeatInterval,
    reconnectTime = opts.reconnect,
    reconnectInterval,
    isReconnect = false,
    isRetrying = false;

  $.open = function () {
    if (isConnected) return;

    ws = new WebSocket(url, opts.protocols || []);

    ws.onopen = function (e) {
      ($.onopen || opts.onopen || noop)(e);
      attempts = 0;
      isConnected = true;
      isRetrying = false;

      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);
      if (reconnectTime) {
        setSocketReconnect();
      }
      if (heartBeatTime) {
        setSocketHeartBeat();
      }
    };

    ws.onclose = async function (e) {
      ($.onclose || opts.onclose || noop)(e);
      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);

      isConnected = false;

      if (attempts < maxAttemps) {
        isRetrying = true;
      }

      if (isReconnect) {
        attempts = 0;
        $.reconnect(e);
        isReconnect = false;
        // TODO: Remove 1006 code check
      } else if (
        e.code === 1e3 ||
        e.code === 1001 ||
        e.code === 1005 ||
        e.code === 1006 ||
        e.code === 1013
      ) {
        await wait(
          2 ** attempts * Math.floor(Math.random() * (1000 - 100 + 1) + 100)
        );
        $.reconnect(e);
      } else {
        attempts = 0;
      }
    };

    ws.onmessage = function (e) {
      ($.onmessage || opts.onmessage || noop)(e);
      setSocketHeartBeat();
    };

    ws.onerror = function (e) {
      isReconnect = false;
      isConnected = false;

      clearInterval(reconnectInterval);
      clearInterval(heartBeatInterval);

      if (e && e.code === "ECONNREFUSED") {
        if (isRetrying) return;
        $.reconnect(e);
      } else {
        ($.onerror || opts.onerror || noop)(e);
      }
    };
  };

  $.reconnect = function (e) {
    if (attempts++ < maxAttemps) {
      ($.onreconnect || opts.onreconnect || noop)(e);
      $.open();
    } else {
      ($.onmaximum || opts.onmaximum || noop)(e);
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
    clearInterval(heartBeatInterval);

    let heartBeatStart = Date.now();
    heartBeatInterval = setInterval(() => {
      if (!isConnected) return;
      if (heartBeatStart + heartBeatTime < Date.now()) {
        ws.send(opts.pingPayload || "ping");
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
