const isBrowser = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
const CHANNEL_NAME = 'tab-sync';
const HEARTBEAT_INTERVAL = 1000;
const HEARTBEAT_TIMEOUT = 3000;
let channel = null;
let tabId = '';
let tabBirth = 0;
let heartbeatTimer = null;
let boundBeforeUnload = null;
const knownTabs = new Map();
const listeners = new Map();
const state = new Map();
function generateTabId() {
    return Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}
function getChannel() {
    if (!channel)
        throw new Error('tab-sync: call init() first');
    return channel;
}
export function getTabId() {
    return tabId;
}
export function post(type, key, value) {
    const msg = { type, key, value, tabId, timestamp: Date.now() };
    getChannel().postMessage(msg);
}
export function listen(key, handler) {
    let set = listeners.get(key);
    if (!set) {
        set = new Set();
        listeners.set(key, set);
    }
    set.add(handler);
    return () => { set.delete(handler); };
}
function sendHeartbeat() {
    post('heartbeat', '__heartbeat', tabBirth);
    pruneStale();
}
function pruneStale() {
    const now = Date.now();
    for (const [id, info] of knownTabs) {
        if (now - info.lastSeen > HEARTBEAT_TIMEOUT) {
            knownTabs.delete(id);
        }
    }
}
export function isLeader() {
    if (!channel)
        return false;
    for (const info of knownTabs.values()) {
        if (info.birth < tabBirth)
            return false;
    }
    return true;
}
export function onLeaderChange(callback) {
    let wasLeader = isLeader();
    return listen('__heartbeat', () => {
        const nowLeader = isLeader();
        if (nowLeader !== wasLeader) {
            wasLeader = nowLeader;
            callback(nowLeader);
        }
    });
}
function handleMessage(event) {
    const msg = event.data;
    if (!msg || typeof msg.type !== 'string')
        return;
    if (msg.tabId === tabId)
        return;
    if (msg.type === 'heartbeat') {
        knownTabs.set(msg.tabId, { birth: msg.value, lastSeen: Date.now() });
    }
    if (msg.type === 'sync')
        state.set(msg.key, msg.value);
    const set = listeners.get(msg.key);
    if (set) {
        for (const handler of set)
            handler(msg);
    }
    const wildcard = listeners.get('*');
    if (wildcard) {
        for (const handler of wildcard)
            handler(msg);
    }
}
export function sync(key, value) {
    state.set(key, value);
    post('sync', key, value);
}
export function get(key) {
    return state.get(key);
}
export function on(key, callback) {
    return listen(key, (msg) => {
        if (msg.type === 'sync')
            callback(msg.value);
    });
}
export function tabCount() {
    if (!channel)
        return 0;
    pruneStale();
    return knownTabs.size + 1;
}
const AUTH_KEY = '__auth';
export function syncAuth(token) {
    sync(AUTH_KEY, token);
}
export function onAuthChange(callback) {
    return on(AUTH_KEY, callback);
}
const THEME_KEY = '__theme';
export function syncTheme(mode) {
    sync(THEME_KEY, mode);
}
export function onThemeChange(callback) {
    return on(THEME_KEY, callback);
}
export function init() {
    if (!isBrowser)
        return () => { };
    if (channel)
        return () => destroy();
    tabId = generateTabId();
    tabBirth = Date.now();
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', handleMessage);
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    boundBeforeUnload = () => destroy();
    globalThis.addEventListener('beforeunload', boundBeforeUnload);
    return () => destroy();
}
export function destroy() {
    if (!channel)
        return;
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
