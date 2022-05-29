export default class Sockrates {
  constructor(url, opts = {}) {
    if (window.Worker) {
      this.ws = new Worker(new URL("worker.js", import.meta.url));
      this.ws.postMessage({ action: "CONFIGURE", data: { url, opts } });

      this.ws.onmessage = this.messageHandler.bind(this);
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

  json(x) {
    this.ws.postMessage({ action: "JSON", data: x });
  }

  send(x) {
    this.ws.postMessage({ action: "SEND", data: x });
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
