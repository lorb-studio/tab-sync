export type MessageType = 'sync' | 'heartbeat' | 'leader-claim' | 'request-state';
export interface TabMessage<T = unknown> {
    type: MessageType;
    key: string;
    value: T;
    tabId: string;
    timestamp: number;
}
export declare function getTabId(): string;
export declare function post<T>(type: MessageType, key: string, value: T): void;
export declare function listen(key: string, handler: (msg: TabMessage) => void): () => void;
export declare function isLeader(): boolean;
export declare function onLeaderChange(callback: (amLeader: boolean) => void): () => void;
export declare function sync<T>(key: string, value: T): void;
export declare function get<T = unknown>(key: string): T | undefined;
export declare function on<T = unknown>(key: string, callback: (value: T) => void): () => void;
export declare function tabCount(): number;
export declare function syncAuth(token: string | null): void;
export declare function onAuthChange(callback: (token: string | null) => void): () => void;
export declare function syncTheme(mode: string): void;
export declare function onThemeChange(callback: (mode: string) => void): () => void;
export declare function init(): () => void;
export declare function destroy(): void;
