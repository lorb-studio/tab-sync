// --- Types ---

export type MessageType = 'sync' | 'heartbeat' | 'leader-claim' | 'request-state';

export interface TabMessage<T = unknown> {
  type: MessageType;
  key: string;
  value: T;
  tabId: string;
  timestamp: number;
}

// --- SSR guard ---

const isBrowser = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';

// --- Channel ---

const CHANNEL_NAME = 'tab-sync';
const HEARTBEAT_INTERVAL = 1000;
const HEARTBEAT_TIMEOUT = 3000;

let channel: BroadcastChannel | null = null;
let tabId = '';
let tabBirth = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let boundBeforeUnload: (() => void) | null = null;
const knownTabs = new Map<string, { birth: number; lastSeen: number }>();
const listeners = new Map<string, Set<(msg: TabMessage) => void>>();
const state = new Map<string, unknown>();

function generateTabId(): string {
  return Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

function getChannel(): BroadcastChannel {
  if (!channel) throw new Error('tab-sync: call init() first');
  return channel;
}

export function getTabId(): string {
  return tabId;
}

// --- Core messaging ---

export function post<T>(type: MessageType, key: string, value: T): void {
  const msg: TabMessage<T> = { type, key, value, tabId, timestamp: Date.now() };
  getChannel().postMessage(msg);
}

export function listen(key: string, handler: (msg: TabMessage) => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(handler);
  return () => { set!.delete(handler); };
}

// --- Leader election ---

function sendHeartbeat(): void {
  post('heartbeat', '__heartbeat', tabBirth);
  pruneStale();
}

function pruneStale(): void {
  const now = Date.now();
  for (const [id, info] of knownTabs) {
    if (now - info.lastSeen > HEARTBEAT_TIMEOUT) {
      knownTabs.delete(id);
    }
  }
}

export function isLeader(): boolean {
  if (!channel) return false;
  // Oldest tab (lowest birth) is leader. Self is included in comparison
  for (const info of knownTabs.values()) {
    if (info.birth < tabBirth) return false;
  }
  return true;
}

export function onLeaderChange(callback: (amLeader: boolean) => void): () => void {
  let wasLeader = isLeader();
  return listen('__heartbeat', () => {
    const nowLeader = isLeader();
    if (nowLeader !== wasLeader) {
      wasLeader = nowLeader;
      callback(nowLeader);
    }
  });
}

function handleMessage(event: MessageEvent<TabMessage>): void {
  const msg = event.data;
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.tabId === tabId) return; // ignore own messages

  // Track heartbeats from other tabs
  if (msg.type === 'heartbeat') {
    knownTabs.set(msg.tabId, { birth: msg.value as number, lastSeen: Date.now() });
  }

  // Store latest value
  if (msg.type === 'sync') state.set(msg.key, msg.value);

  // Dispatch to key-specific listeners
  const set = listeners.get(msg.key);
  if (set) {
    for (const handler of set) handler(msg);
  }

  // Dispatch to wildcard listeners
  const wildcard = listeners.get('*');
  if (wildcard) {
    for (const handler of wildcard) handler(msg);
  }
}

// --- Public API: sync / on ---

export function sync<T>(key: string, value: T): void {
  state.set(key, value);
  post('sync', key, value);
}

export function get<T = unknown>(key: string): T | undefined {
  return state.get(key) as T | undefined;
}

export function on<T = unknown>(key: string, callback: (value: T) => void): () => void {
  return listen(key, (msg) => {
    if (msg.type === 'sync') callback(msg.value as T);
  });
}

// --- Tab count ---

export function tabCount(): number {
  if (!channel) return 0;
  pruneStale();
  return knownTabs.size + 1; // known peers + self
}

// --- Auth helper ---

const AUTH_KEY = '__auth';

export function syncAuth(token: string | null): void {
  sync(AUTH_KEY, token);
}

export function onAuthChange(callback: (token: string | null) => void): () => void {
  return on<string | null>(AUTH_KEY, callback);
}

// --- Theme helper ---

const THEME_KEY = '__theme';

export function syncTheme(mode: string): void {
  sync(THEME_KEY, mode);
}

export function onThemeChange(callback: (mode: string) => void): () => void {
  return on<string>(THEME_KEY, callback);
}

// --- Lifecycle ---

export function init(): () => void {
  if (!isBrowser) return () => {};
  if (channel) return () => destroy();

  tabId = generateTabId();
  tabBirth = Date.now();
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', handleMessage);

  // Start heartbeat for leader election
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  // Notify peers on tab close for fast leader takeover
  boundBeforeUnload = () => destroy();
  globalThis.addEventListener('beforeunload', boundBeforeUnload);

  return () => destroy();
}

export function destroy(): void {
  if (!channel) return;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (boundBeforeUnload) {
    globalThis.removeEventListener('beforeunload', boundBeforeUnload);
    boundBeforeUnload = null;
  }
  channel.removeEventListener('message', handleMessage);
  channel.close();
  channel = null;
  tabId = '';
  tabBirth = 0;
  knownTabs.clear();
  listeners.clear();
  state.clear();
}
