# SwiperTab Privacy Policy

_Last updated: 2026-05-13_

SwiperTab is a browser extension that helps you review and close open tabs in a game-like way.
This policy describes what data SwiperTab handles and what happens to it.

## Short version

**SwiperTab does not collect, transmit, or share any personal data.** Everything
the extension reads about your tabs stays on your device, in the browser's own
local storage. There are no servers, no analytics, and no third parties.

## What SwiperTab reads

To do its job, SwiperTab reads:

- The URL, title, favicon, and audible state of your open tabs.
- A visual screenshot of the currently active tab (only when tab screenshots
  are enabled in settings).
- Open Graph image metadata from pages you visit (used as a fallback preview
  when no screenshot exists).
- Timestamps of when you last activated each tab.

## Where that data is stored

All of the above is stored exclusively in the browser's own extension storage
on your device:

- **`storage.local`** — tab screenshots, last-active timestamps, and Open Graph
  previews.
- **`storage.sync`** — your settings (threshold, whitelist, etc.). If you have
  browser sync enabled in your browser, your browser may sync this between
  your own devices. SwiperTab itself does not have a server.
- **`storage.session`** — short-lived runtime state (snooze timers, etc.). This
  is cleared every time the browser restarts.

Stored data is pruned automatically after 20 days of inactivity, and the
screenshot cache is capped to a fixed number of recent entries.

## What SwiperTab does *not* do

- It does not send any data to the developer or to any third-party server.
- It does not include analytics, telemetry, advertising, or tracking SDKs.
- It does not read page contents beyond the Open Graph preview tag.
- It does not run in private/incognito windows.

## Permissions

SwiperTab requests the following permissions, and uses them only for the
purposes listed:

- **`tabs`** — to list, activate, and close tabs.
- **`storage`** — to persist your settings and the local screenshot cache.
- **`alarms`** — to periodically capture the active tab's screenshot and to
  prune old cached data.
- **Host permissions (`<all_urls>`)** — required to capture screenshots of
  arbitrary pages you visit, and to read each page's Open Graph preview tag.

## Deleting your data

Uninstalling SwiperTab removes all of its stored data from your browser. You
can also clear the screenshot cache at any time by disabling tab screenshots
in the extension's settings.

## Contact

Questions about this policy? Email **marin.dedic@me.com**.
