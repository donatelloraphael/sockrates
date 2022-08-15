interface Options {
    protocols?: string[];
    maxAttempts?: number;
    heartBeatInterval?: number;
    pingPayload?: string;
    reconnectInterval?: number;
}
export default class Sockrates {
    private worker;
    onopen: Function;
    onclose: Function;
    onerror: Function;
    onreconnect: Function;
    onmaximum: Function;
    onmessage: Function;
    constructor(url: string, opts?: Options);
    open(): void;
    close(): void;
    reconnect(): void;
    json(x: any, backlog: any[]): void;
    send(x: string, backlog: string[]): void;
    private noop;
    private messageHandler;
}
export {};
