<p align="center">
  <img src=".github/icon.png" width="80" height="80" alt="tab-sync" />
</p>

<h1 align="center">tab-sync</h1>
<p align="center">Login in one tab, every tab knows. Instantly.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lorb/tab-sync"><code>npm install @lorb/tab-sync</code></a>
</p>

**Cross-tab state sync** via BroadcastChannel. Auth tokens, theme preferences, cart state — any value you sync is instantly available in every open tab.

**Built-in helpers** for the two most common cases: auth and theme. One-liners.

**Leader election** included. Know which tab is in charge — run background jobs, hold WebSocket connections, or send analytics from a single tab.

```js
import { init, syncAuth, onAuthChange } from '@lorb/tab-sync';

init();
syncAuth(token);
// Every other tab immediately receives the token.
```

## Install

```bash
npm install @lorb/tab-sync
```

## What you can do

### Sync auth across tabs

User logs in on Tab A — Tabs B, C, D update without a page refresh. User logs out — every tab redirects to login.

```js
import { init, syncAuth, onAuthChange } from '@lorb/tab-sync';

init();

// Tab A: user logs in
syncAuth(token);

// Tab B, C, D:
onAuthChange((token) => {
  if (!token) window.location.href = '/login';
});
```

### Sync theme or any preference

```js
import { init, syncTheme, onThemeChange } from '@lorb/tab-sync';

init();
syncTheme('dark');
onThemeChange((mode) => {
  document.documentElement.dataset.theme = mode;
});
```

### Sync any custom value

```js
import { init, sync, on, get } from '@lorb/tab-sync';

init();

sync('cart', { items: 3, total: 49.99 });
on('cart', (value) => updateCartBadge(value.items));

// Read the last synced value without waiting for a change
const cart = get('cart');
```

### Listen to all changes at once

```js
import { init, on } from '@lorb/tab-sync';

init();
on('*', (message) => {
  console.log(message.key, message.value, message.tabId);
});
```

### Run something in only one tab

Leader election happens automatically. The oldest tab becomes leader.

```js
import { init, isLeader, onLeaderChange } from '@lorb/tab-sync';

init();

if (isLeader()) {
  startWebSocketConnection();
}

onLeaderChange((amLeader) => {
  if (amLeader) startWebSocketConnection();
  else stopWebSocketConnection();
});
```

### Know how many tabs are open

```js
import { tabCount } from '@lorb/tab-sync';

console.log(`${tabCount()} tabs open`);
```

## API

| Export | Description |
|--------|-------------|
| `init()` | Start syncing. Returns `cleanup()` function |
| `sync(key, value)` | Broadcast a value to all tabs |
| `on(key, callback)` | Listen for changes. Use `'*'` for all keys |
| `get(key)` | Get the last synced value |
| `syncAuth(token)` / `onAuthChange(cb)` | Auth shorthand |
| `syncTheme(mode)` / `onThemeChange(cb)` | Theme shorthand |
| `tabCount()` | Number of active tabs |
| `isLeader()` | Whether this tab is the elected leader |
| `onLeaderChange(cb)` | Leader election events |
| `destroy()` | Teardown |

SSR-safe. No-op when BroadcastChannel is unavailable.

## License

𖦹 MIT — [Lorb.studio](https://lorb.studio)
