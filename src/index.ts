interface Options {
  protocols?: string[];
  maxAttempts?: number;
  heartBeatInterval?: number;
  pingPayload?: string;
  reconnectInterval?: number;
}

export default class Sockrates {
  private worker: Worker;

  public onopen: Function = this.noop;
  public onclose: Function = this.onopen;
  public onerror: Function = this.onopen;
  public onreconnect: Function = this.onopen;
  public onmaximum: Function = this.onopen;
  public onmessage: Function = this.onopen;

  constructor(url: string, opts: Partial<Options> = {}) {
    if (!window.Worker) {
      throw new Error(
        "Web workers are not supported in your browser to provide WebSocket connection."
      );
    }

    const blob = new Blob(["(", socketWorker.toString(), ")()"], {
      type: "text/javascript",
    });

    this.worker = new Worker(window.URL.createObjectURL(blob));

    this.worker.postMessage({ action: "CONFIGURE", data: { url, opts } });

    this.worker.onmessage = this.messageHandler.bind(this);
  }

  open() {
    this.worker.postMessage({ action: "OPEN" });
  }

  close() {
    this.worker.postMessage({ action: "CLOSE" });
  }

  reconnect() {
    this.worker.postMessage({ action: "RECONNECT" });
  }

  json(x: any, backlog?: any[]) {
    this.worker.postMessage({ action: "JSON", data: x, backlog: backlog });
  }

  send(x: string, backlog?: string[]) {
    this.worker.postMessage({ action: "SEND", data: x, backlog: backlog });
  }

  private noop() {}

  private messageHandler(e: MessageEvent) {
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
    private ws: WebSocket | null = null;
    private protocols: string[];
    private url: string;
    private attempts: number;
    private maxAttempts: number;
    private isConnected: boolean;
    private heartBeatTime: number;
    private heartBeatInterval: number;
    private pingPayload: string;
    private reconnectTime: number;
    private reconnectInterval: number;
    private isReconnect: boolean;
    private isRetrying: boolean;
    private jsonPayload: string[];
    private sendPayload: string[];
    private openTimer: ReturnType<typeof setTimeout> | null;
    private firstLoad: boolean;

    constructor(url: string, opts: Partial<Options> = {}) {
      this.protocols = opts.protocols || [];
      this.url = url;
      this.attempts = 0;
      this.maxAttempts = opts.maxAttempts || Infinity;
      this.isConnected = false;
      this.heartBeatTime = opts.heartBeatInterval || 0;
      this.heartBeatInterval = 0;
      this.pingPayload = opts.pingPayload || "ping";
      this.reconnectTime = opts.reconnectInterval || 0;
      this.reconnectInterval = 0;
      this.isReconnect = false;
      this.isRetrying = false;
      this.jsonPayload = [];
      this.sendPayload = [];
      this.openTimer = null;
      this.firstLoad = true;
    }

    open() {
      this.openTimer && clearTimeout(this.openTimer);

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

    connect() {
      if (this.isConnected) return;

      this.ws = new WebSocket(this.url, this.protocols || []);

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

      this.ws.onclose = (e) => {
        clearInterval(this.reconnectInterval);
        clearInterval(this.heartBeatInterval);

        this.isConnected = false;

        if (this.attempts < this.maxAttempts) {
          this.isRetrying = true;
        }
        try {
          postMessage({ action: "ONCLOSE" });
        } catch (e) {}

        if (this.isReconnect) {
          this.attempts = 0;
          this.reconnect();
          this.isReconnect = false;
        } else if (
          e.code === 1e3 ||
          e.code === 1001 ||
          e.code === 1005 ||
          e.code === 1006 ||
          e.code === 1013
        ) {
          this.wait(
            2 ** this.attempts *
              Math.floor(Math.random() * (1000 - 100 + 1) + 100)
          ).then(() => {
            return this.reconnect();
          });
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

        if (e && (e as any).code === "ECONNREFUSED") {
          if (this.isRetrying) return;
          this.reconnect();
        } else {
          try {
            postMessage({ action: "ONERROR" });
          } catch (e) {}
        }
      };
    }

    reconnect() {
      this.isReconnect = true;
      if (this.attempts++ < this.maxAttempts) {
        this.open();
      } else {
        try {
          postMessage({ action: "ONMAXIMUM" });
        } catch (e) {}
      }
    }

    json(x: any, backlog?: any[]) {
      this.attempts = 0;
      if (!this.isConnected) {
        if (backlog) {
          this.jsonPayload.push(x);
        }
        this.open();
      } else {
        this.ws!.send(JSON.stringify(x));
      }
    }

    send(x: string, backlog?: string[]) {
      this.attempts = 0;
      if (!this.isConnected) {
        if (backlog) {
          this.sendPayload.push(x);
        }
        this.open();
      } else {
        this.ws!.send(x);
      }
    }

    close(x?: number, y?: string) {
      this.ws!.close(x || 1e3, y);
    }

    private setSocketHeartBeat() {
      if (!this.heartBeatTime) return;
      clearInterval(this.heartBeatInterval);

      let heartBeatStart = Date.now();
      this.heartBeatInterval = setInterval(() => {
        if (!this.isConnected) return;
        if (heartBeatStart + this.heartBeatTime < Date.now()) {
          this.ws!.send(this.pingPayload);
          heartBeatStart = Date.now();
        }
      }, 1e3);
    }

    private setSocketReconnect() {
      if (!this.reconnectTime) return;
      clearInterval(this.reconnectInterval);

      const reconnectStart = Date.now();
      const reconnectEnd = reconnectStart + this.reconnectTime;

      this.reconnectInterval = setInterval(() => {
        if (!this.isConnected) return;
        if (reconnectEnd < Date.now()) {
          this.isReconnect = true;
          this.ws!.close();
        }
      }, 1e3);
    }

    private wait(ms: number): Promise<void> {
      return new Promise((res) => setTimeout(res, ms));
    }
  }

  let $: Socket;

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
