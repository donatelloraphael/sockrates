export default class Sockrates {
  constructor(url, opts = {}) {
    if (window.Worker) {
      const blob = new Blob(["(", socketWorker.toString(), ")()"], {
        type: "text/javascript",
      });

      this.ws = new Worker(window.URL.createObjectURL(blob));
      this.ws.postMessage({ action: "CONFIGURE", data: { url, opts } });

      this.ws.onmessage = this.messageHandler.bind(this);
    } else {
      console.error(
        "Web workers are not supported in your browser to provide WebSocket connection."
      );
    }
  }

  open() {
    this.ws.postMessage({ action: "OPEN" });
  }

  close() {
    this.ws.postMessage({ action: "CLOSE" });
  }

  reconnect() {
    this.ws.postMessage({ action: "RECONNECT" });
  }

  json(x, backlog) {
    this.ws.postMessage({ action: "JSON", data: x, backlog: backlog });
  }

  send(x, backlog) {
    this.ws.postMessage({ action: "SEND", data: x, backlog: backlog });
  }

  noop() {}

  messageHandler(e) {
    switch (e.data.action) {
      case "ONOPEN":
        (this.onopen || this.noop)();
        break;
      case "ONCLOSE":
        (this.onclose || this.noop)();
        break;
      case "ONERROR":
        (this.onerror || this.noop)();
        break;
      case "ONRECONNECT":
        (this.onreconnect || this.noop)();
        break;
      case "ONMAXIMUM":
        (this.onmaximum || this.noop)();
        break;
      case "ONMESSAGE":
        (this.onmessage || this.noop)(e.data.data);
        break;
    }
  }
}

function socketWorker() {
  class Socket {
    constructor(url, opts = {}) {
      this.ws = null;
      this.protocols = opts.protocols;
      this.url = url;
      this.attempts = 0;
      this.maxAttemps = opts.maxAttempts || Infinity;
      this.isConnected = false;
      this.heartBeatTime = opts.heartBeatInterval || null;
      this.heartBeatInterval = null;
      this.pingPayload = opts.pingPayload || "ping";
      this.reconnectTime = opts.reconnectInterval || null;
      this.reconnectInterval = null;
      this.isReconnect = false;
      this.isRetrying = false;
      this.jsonPayload = [];
      this.sendPayload = [];
      this.openTimer = null;
      this.firstLoad = true;
    }

    open() {
      clearTimeout(this.openTimer);
      if (this.firstLoad) {
        this.firstLoad = false;
        this.connect();
      } else if (this.isRetrying) {
        this.connect();
      } else {
        this.openTimer = setTimeout(() => this.connect(), 1000);
        this.attempts = 0;
      }
    }

    async connect() {
      if (this.isConnected) return;

      this.ws = await new WebSocket(this.url, this.protocols || []);

      this.ws.onopen = (e) => {
        if (this.isReconnect) {
          try {
            postMessage({ action: "ONRECONNECT" });
          } catch (e) {}
        }
        try {
          postMessage({ action: "ONOPEN" });
        } catch (e) {}

        this.attempts = 0;
        this.isConnected = true;
        this.isRetrying = false;

        clearInterval(this.reconnectInterval);
        clearInterval(this.heartBeatInterval);
        if (this.reconnectTime) {
          this.setSocketReconnect();
        }
        if (this.heartBeatTime) {
          this.setSocketHeartBeat();
        }
        this.jsonPayload.forEach((payload) => {
          this.json(payload);
        });
        this.sendPayload.forEach((payload) => {
          this.send(payload);
        });
        this.jsonPayload = [];
        this.sendPayload = [];
      };

      this.ws.onclose = async (e) => {
        clearInterval(this.reconnectInterval);
        clearInterval(this.heartBeatInterval);

        this.isConnected = false;

        if (this.attempts < this.maxAttemps) {
          this.isRetrying = true;
        }
        try {
          postMessage({ action: "ONCLOSE" });
        } catch (e) {}

        if (this.isReconnect) {
          this.attempts = 0;
          this.reconnect(e);
          this.isReconnect = false;
        } else if (
          e.code === 1e3 ||
          e.code === 1001 ||
          e.code === 1005 ||
          e.code === 1006 ||
          e.code === 1013
        ) {
          await this.wait(
            2 ** this.attempts *
              Math.floor(Math.random() * (1000 - 100 + 1) + 100)
          );
          this.reconnect(e);
        } else {
          this.attempts = 0;
        }
      };

      this.ws.onmessage = (e) => {
        try {
          postMessage({ action: "ONMESSAGE", data: e.data });
        } catch (e) {}
        this.setSocketHeartBeat();
      };

      this.ws.onerror = (e) => {
        this.isReconnect = false;
        this.isConnected = false;

        clearInterval(this.reconnectInterval);
        clearInterval(this.heartBeatInterval);

        if (e && e.code === "ECONNREFUSED") {
          if (this.isRetrying) return;
          this.reconnect(e);
        } else {
          try {
            postMessage({ action: "ONERROR" });
          } catch (e) {}
        }
      };
    }

    reconnect() {
      this.isReconnect = true;
      if (this.attempts++ < this.maxAttemps) {
        this.open();
      } else {
        try {
          postMessage({ action: "ONMAXIMUM" });
        } catch (e) {}
      }
    }

    async json(x, backlog) {
      this.attempts = 0;
      if (!this.isConnected) {
        if (backlog) {
          this.jsonPayload.push(x);
        }
        this.open();
      } else {
        await this.ws.send(JSON.stringify(x));
      }
    }

    async send(x, backlog) {
      this.attempts = 0;
      if (!this.isConnected) {
        if (backlog) {
          this.sendPayload.push(x);
        }
        this.open();
      } else {
        await this.ws.send(x);
      }
    }

    close(x, y) {
      this.ws.close(x || 1e3, y);
    }

    setSocketHeartBeat() {
      if (!this.heartBeatTime) return;
      clearInterval(this.heartBeatInterval);

      let heartBeatStart = Date.now();
      this.heartBeatInterval = setInterval(() => {
        if (!this.isConnected) return;
        if (heartBeatStart + this.heartBeatTime < Date.now()) {
          this.ws.send(this.pingPayload);
          heartBeatStart = Date.now();
        }
      }, 1e3);
    }

    setSocketReconnect() {
      if (!this.reconnectTime) return;
      clearInterval(this.reconnectInterval);

      const reconnectStart = Date.now();
      const reconnectEnd = reconnectStart + this.reconnectTime;

      this.reconnectInterval = setInterval(() => {
        if (!this.isConnected) return;
        if (reconnectEnd < Date.now()) {
          this.isReconnect = true;
          this.ws.close();
        }
      }, 1e3);
    }

    wait(ms) {
      return new Promise((res) => setTimeout(res, ms));
    }
  }

  let $;

  self.onmessage = function (e) {
    switch (e.data.action) {
      case "CONFIGURE": {
        $ = new Socket(e.data.data.url, e.data.data.opts);
        break;
      }
      case "OPEN": {
        $.open();
        break;
      }
      case "CLOSE": {
        $.close();
        break;
      }
      case "RECONNECT": {
        $.reconnect();
        break;
      }
      case "SEND": {
        $.send(e.data.data, e.data.backlog);
        break;
      }
      case "JSON": {
        $.json(e.data.data, e.data.backlog);
        break;
      }
    }
  };
}
