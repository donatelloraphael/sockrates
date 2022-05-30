export default class Sockrates {
    constructor(url: string, opts?: {});
    ws: Worker;
    open(): void;
    close(): void;
    reconnect(): void;
    json(x: any, backlog: boolean): void;
    send(x: string, backlog: boolean): void;
    noop(): void;
    messageHandler(e: any): void;
}
