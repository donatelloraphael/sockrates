export default class Sockrates {
    constructor(url: any, opts?: {});
    open(): void;
    close(): void;
    reconnect(): void;
    json(x: any, backlog: any): void;
    send(x: any, backlog: any): void;
    noop(): void;
    messageHandler(e: any): void;
}
