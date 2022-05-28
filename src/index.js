class Sockrates {
  constructor(url, opts = {}) {
    this.ws = {};
    this.opts = opts;
    this.url = url;
    this.attempts = 0;
    this.maxAttemps = opts.maxAttempts || Infinity;
    this.isConnected = false;
    this.heartBeatTime = opts.heartBeat || null;
    this.heartBeatInterval = null;
    this.reconnectTime = opts.reconnect || null;
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

    this.ws = await new WebSocket(this.url, this.opts.protocols || []);
  
    this.ws.onopen = (e) => {
      (this.opts.onopen || this.noop)(e);
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
      (this.opts.onclose || this.noop)(e);
  
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
      (this.opts.onmessage || this.noop)(e);
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
        (this.opts.onerror || this.noop)(e);
      }
    };

  }

  reconnect(e) {
    if (this.attempts++ < this.maxAttemps) {
      (this.opts.onreconnect || this.noop)(e);
      this.open();
    } else {
      (this.opts.onmaximum || this.noop)(e);
    }
  }

  async json(x) {
    this.attempts = 0;
    if (!this.isConnected) {
      this.jsonPayload.push(x);
      this.open();
    } else {
      await this.ws.send(JSON.stringify(x));
    }
  }

  async send(x) {
    this.attempts = 0;
    if (!this.isConnected) {
      this.sendPayload.push(x);
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
        this.ws.send(this.opts.pingPayload || "ping");
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

  noop() {}

  wait(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
