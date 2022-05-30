
declare module "sockrates" {
    export default class Sockrates {
        constructor(url: string, opts?: SockratesOptions );
        ws: Worker;
        open(): void;
        close(): void;
        reconnect(): void;
        json(x: any, backlog?: boolean): void;
        send(x: string, backlog?: boolean): void;
        noop(): void;
        messageHandler(e: any): void;
        onopen: function;
        onclose: function;
        onerror: function;
        onmaximum: function;
        onmessage: function;
        onreconnect: function;
    }

    export interface SockratesOptions {
        heartBeatInterval: number, 
        reconnectInterval: number,
        maxAttempts: number,
        protocols?: string | string[],
        pingPayload?: any
    }
}
