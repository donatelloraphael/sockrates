
declare module "sockrates" {
    export default class Sockrates {
        constructor(url: string, opts?: SockratesOptions );
        ws: Worker;
        open(): void;
        close(): void;
        reconnect(): void;
        json(x: any, backlog: boolean): void;
        send(x: string, backlog: boolean): void;
        noop(): void;
        messageHandler(e: any): void;
    }

    export interface SockratesOptions {
        heartBeatInterval: number, 
        reconnectInterval: number,
        maxAttempts: number,
        protocols: string | string[],
        pingPayload: any
    }
}
