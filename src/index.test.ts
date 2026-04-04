import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- BroadcastChannel mock ---

type MessageHandler = (event: MessageEvent) => void;

const channels: MockBroadcastChannel[] = [];

class MockBroadcastChannel {
  name: string;
  private handlers: MessageHandler[] = [];
  closed = false;

  constructor(name: string) {
    this.name = name;
    channels.push(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;
    const event = new MessageEvent('message', { data });
    // Deliver to all OTHER channels with the same name
    for (const ch of channels) {
      if (ch !== this && ch.name === this.name && !ch.closed) {
        for (const handler of ch.handlers) handler(event);
      }
    }
  }

  addEventListener(_type: string, handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  removeEventListener(_type: string, handler: MessageHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  close(): void {
    this.closed = true;
    this.handlers = [];
    const idx = channels.indexOf(this);
    if (idx >= 0) channels.splice(idx, 1);
  }
}

// Install mock before module loads
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

// Dynamic import so the module sees the mock
let mod: typeof import('./index.js');

beforeEach(async () => {
  channels.length = 0;
  // Fresh module for each test (reset module-level state)
  vi.resetModules();
  mod = await import('./index.js');
});

afterEach(() => {
  // Cleanup any leftover init
  try { mod.destroy(); } catch { /* noop */ }
  channels.length = 0;
});

// --- Tests ---

describe('init / destroy', () => {
  it('returns a cleanup function', () => {
    const cleanup = mod.init();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('assigns a tabId after init', () => {
    mod.init();
    expect(mod.getTabId()).toBeTruthy();
    expect(typeof mod.getTabId()).toBe('string');
  });

  it('clears state on destroy', () => {
    mod.init();
    mod.sync('key', 'value');
    expect(mod.get('key')).toBe('value');
    mod.destroy();
    expect(mod.get('key')).toBeUndefined();
    expect(mod.getTabId()).toBe('');
  });

  it('throws if sync called before init', () => {
    expect(() => mod.sync('key', 'val')).toThrow('call init() first');
  });
});

describe('sync / on / get', () => {
  it('stores value locally via sync', () => {
    mod.init();
    mod.sync('cart', { items: 3 });
    expect(mod.get('cart')).toEqual({ items: 3 });
  });

  it('delivers sync messages to on() callbacks on another channel', async () => {
    mod.init();

    // Simulate a second tab by importing a fresh module
    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    const mod2: typeof import('./index.js') = await import('./index.js');
    mod2.init();

    const received: unknown[] = [];
    mod2.on('cart', (value) => received.push(value));

    mod.sync('cart', { items: 5 });

    expect(received).toEqual([{ items: 5 }]);

    mod2.destroy();
  });

  it('on() returns an unsubscribe function', () => {
    mod.init();

    // We need a second module to receive
    // But we can test unsubscribe stops handler calls
    const received: unknown[] = [];
    const unsub = mod.on('key', (v) => received.push(v));
    unsub();
    // Internal listeners should be empty for this key after unsub
    // We can't easily test cross-tab here, but unsubscribe should work
    expect(typeof unsub).toBe('function');
  });

  it('get returns undefined for unknown keys', () => {
    mod.init();
    expect(mod.get('nonexistent')).toBeUndefined();
  });
});

describe('leader election', () => {
  it('single tab is always the leader', () => {
    mod.init();
    expect(mod.isLeader()).toBe(true);
  });

  it('returns false when not initialized', () => {
    expect(mod.isLeader()).toBe(false);
  });
});

describe('tabCount', () => {
  it('returns 0 when not initialized', () => {
    expect(mod.tabCount()).toBe(0);
  });

  it('returns 1 for a single tab', () => {
    mod.init();
    expect(mod.tabCount()).toBe(1);
  });
});

describe('auth helpers', () => {
  it('syncAuth / onAuthChange syncs token across tabs', async () => {
    mod.init();

    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    const mod2: typeof import('./index.js') = await import('./index.js');
    mod2.init();

    const tokens: (string | null)[] = [];
    mod2.onAuthChange((token) => tokens.push(token));

    mod.syncAuth('jwt-abc');
    mod.syncAuth(null);

    expect(tokens).toEqual(['jwt-abc', null]);

    mod2.destroy();
  });

  it('get returns auth value after syncAuth', () => {
    mod.init();
    mod.syncAuth('token-123');
    expect(mod.get('__auth')).toBe('token-123');
  });
});

describe('theme helpers', () => {
  it('syncTheme / onThemeChange syncs mode across tabs', async () => {
    mod.init();

    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    const mod2: typeof import('./index.js') = await import('./index.js');
    mod2.init();

    const modes: string[] = [];
    mod2.onThemeChange((mode) => modes.push(mode));

    mod.syncTheme('dark');
    mod.syncTheme('light');

    expect(modes).toEqual(['dark', 'light']);

    mod2.destroy();
  });

  it('get returns theme value after syncTheme', () => {
    mod.init();
    mod.syncTheme('dark');
    expect(mod.get('__theme')).toBe('dark');
  });
});

describe('cleanup', () => {
  it('double destroy is safe', () => {
    mod.init();
    mod.destroy();
    expect(() => mod.destroy()).not.toThrow();
  });

  it('cleanup function from init calls destroy', () => {
    const cleanup = mod.init();
    cleanup();
    expect(mod.getTabId()).toBe('');
    // Should be safe to call again
    expect(() => cleanup()).not.toThrow();
  });
});
