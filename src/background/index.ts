import browser, { type Tabs, type Runtime } from "@/lib/browser";
import { DEFAULTS, type Settings } from "@/lib/defaults";
import type { Tab } from "@/lib/tab";
import type { OgMeta, ToBackground } from "@/lib/messages";
import { matchesDomain } from "@/lib/whitelist";

const MAX_AGE_MS = 20 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 10 * 60 * 1000;
const POST_CLEANUP_SNOOZE_MS = 5 * 60 * 1000;
const DISMISS_SNOOZE_MS = 15 * 1000;
const BUMP_TTL_MS = 20 * 60 * 1000;
const SCREENSHOT_CAP = 200;
const OGMETA_CAP = 500;
const DWELL_MS = 3000;
const PROMPT_DELAY_MS = 400;
const TRIGGER_LOCK_MS = 3000;
const PRUNE_PERIOD_MIN = 24 * 60;
const CLEANUP_PATH = "src/cleanup/index.html";

type Runtime = { snoozeUntil: number; bump: number; bumpUntil: number; activeTabId: number | null };
type Screenshot = { data: string; ts: number };
type Stamped<T> = T & { ts: number };
type LastActiveMap = Record<string, number>;
type ScreenshotMap = Record<string, Screenshot>;
type OgMetaMap = Record<string, Stamped<OgMeta>>;

let dwellTimer: ReturnType<typeof setTimeout> | null = null;
let triggerLockedAt = 0;

function lockTrigger(): void {
  triggerLockedAt = Date.now();
}

function triggerLocked(): boolean {
  return Date.now() - triggerLockedAt < TRIGGER_LOCK_MS;
}

function urlKey(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

function domainOf(url: string | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname; } catch { return ""; }
}

function hostFromKey(key: string): string {
  try { return new URL(key).hostname; } catch { return ""; }
}

async function getSettings(): Promise<Settings> {
  return (await browser.storage.sync.get(DEFAULTS)) as Settings;
}

async function getRuntime(): Promise<Runtime> {
  return (await browser.storage.session.get({
    snoozeUntil: 0,
    bump: 0,
    bumpUntil: 0,
    activeTabId: null,
  })) as Runtime;
}

async function setRuntime(updates: Partial<Runtime>): Promise<void> {
  await browser.storage.session.set(updates);
}

async function countableTabs(): Promise<Tabs.Tab[]> {
  const [tabs, { whitelist }] = await Promise.all([
    browser.tabs.query({}),
    getSettings(),
  ]);
  return tabs.filter((t) => {
    if (t.pinned || t.incognito) return false;
    if (matchesDomain(domainOf(t.url), whitelist)) return false;
    return true;
  });
}

async function findCleanupTab(): Promise<Tabs.Tab | null> {
  const tabs = await browser.tabs.query({ url: browser.runtime.getURL(CLEANUP_PATH) });
  return tabs[0] ?? null;
}

function pruneByTs<T extends { ts: number }>(obj: Record<string, T>, cap: number): void {
  const keys = Object.keys(obj);
  if (keys.length <= cap) return;
  keys.sort((a, b) => obj[a].ts - obj[b].ts);
  for (const k of keys.slice(0, keys.length - cap)) delete obj[k];
}

browser.tabs.onCreated.addListener(async (newTab) => {
  if (newTab.id == null) return;
  if (triggerLocked()) return;
  if (newTab.url?.startsWith(browser.runtime.getURL(""))) return;
  if (await findCleanupTab()) return;

  const { snoozeUntil, bump, bumpUntil } = await getRuntime();
  if (Date.now() < snoozeUntil) return;

  const effectiveBump = Date.now() < bumpUntil ? bump : 0;
  const { threshold } = await getSettings();
  const tabs = await countableTabs();
  if (tabs.length < threshold + effectiveBump + 1) return;
  
  const newTabId = newTab.id;
  setTimeout(async () => {
    try {
      await browser.tabs.sendMessage(newTabId, { type: "SHOW_PROMPT", count: tabs.length });
    } catch {
      lockTrigger();
      browser.tabs.create({ url: browser.runtime.getURL(CLEANUP_PATH), active: true });
    }
  }, PROMPT_DELAY_MS);
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  await setRuntime({ activeTabId: tabId });
  if (dwellTimer) clearTimeout(dwellTimer);
  dwellTimer = setTimeout(() => updateLastActive(tabId), DWELL_MS);
  captureTab(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.active) return;
  captureTab(tabId);
});

async function updateLastActive(tabId: number): Promise<void> {
  try {
    const tab = await browser.tabs.get(tabId);
    const key = urlKey(tab.url);
    if (!key) return;
    const stored = await browser.storage.local.get("lastActive");
    const lastActive: LastActiveMap = (stored.lastActive as LastActiveMap) ?? {};
    lastActive[key] = Date.now();
    await browser.storage.local.set({ lastActive });
  } catch {
    /* tab may have closed */
  }
}

browser.alarms.create("capture", { periodInMinutes: 1 });
browser.alarms.create("prune", { periodInMinutes: PRUNE_PERIOD_MIN });
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "capture") {
    const { activeTabId } = await getRuntime();
    if (activeTabId != null) captureTab(activeTabId);
  } else if (alarm.name === "prune") {
    pruneStorage();
  }
});

pruneStorage();

async function pruneStorage(): Promise<void> {
  const now = Date.now();
  const stored = await browser.storage.local.get(["screenshots", "ogMeta", "lastActive"]);
  const screenshots: ScreenshotMap = (stored.screenshots as ScreenshotMap) ?? {};
  const ogMeta: OgMetaMap = (stored.ogMeta as OgMetaMap) ?? {};
  const lastActive: LastActiveMap = (stored.lastActive as LastActiveMap) ?? {};
  for (const k of Object.keys(screenshots)) {
    if (now - screenshots[k].ts > MAX_AGE_MS) delete screenshots[k];
  }
  for (const k of Object.keys(ogMeta)) {
    if (now - ogMeta[k].ts > MAX_AGE_MS) delete ogMeta[k];
  }
  for (const k of Object.keys(lastActive)) {
    if (now - lastActive[k] > MAX_AGE_MS) delete lastActive[k];
  }
  await browser.storage.local.set({ screenshots, ogMeta, lastActive });
}

async function purgeByDomains(
  domains: string[],
  targets: { screenshots?: boolean; ogMeta?: boolean; lastActive?: boolean },
): Promise<void> {
  if (domains.length === 0) return;
  const keys: string[] = [];
  if (targets.screenshots) keys.push("screenshots");
  if (targets.ogMeta) keys.push("ogMeta");
  if (targets.lastActive) keys.push("lastActive");
  const stored = await browser.storage.local.get(keys);
  const updates: Record<string, unknown> = {};
  const matches = (key: string): boolean => matchesDomain(hostFromKey(key), domains);
  if (targets.screenshots) {
    const m = (stored.screenshots as ScreenshotMap) ?? {};
    for (const k of Object.keys(m)) if (matches(k)) delete m[k];
    updates.screenshots = m;
  }
  if (targets.ogMeta) {
    const m = (stored.ogMeta as OgMetaMap) ?? {};
    for (const k of Object.keys(m)) if (matches(k)) delete m[k];
    updates.ogMeta = m;
  }
  if (targets.lastActive) {
    const m = (stored.lastActive as LastActiveMap) ?? {};
    for (const k of Object.keys(m)) if (matches(k)) delete m[k];
    updates.lastActive = m;
  }
  await browser.storage.local.set(updates);
}

async function handleSettingsChanged(
  addedWhitelist: string[],
  addedSkip: string[],
  screenshotsDisabled: boolean,
): Promise<void> {
  await purgeByDomains(addedWhitelist, { screenshots: true, ogMeta: true, lastActive: true });
  await purgeByDomains(addedSkip, { screenshots: true });
  if (screenshotsDisabled) await browser.storage.local.set({ screenshots: {} });
}

async function captureTab(tabId: number): Promise<void> {
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.active || tab.windowId == null) return;
    if (!tab.url || tab.incognito) return;
    const u = new URL(tab.url);
    if (!["http:", "https:"].includes(u.protocol)) return;
    const { screenshotSkipDomains, screenshotsEnabled } = await getSettings();
    if (!screenshotsEnabled) return;
    if (matchesDomain(u.hostname, screenshotSkipDomains)) return;
    const data = await browser.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 60 });
    const key = urlKey(tab.url);
    if (!key) return;
    const stored = await browser.storage.local.get("screenshots");
    const screenshots: ScreenshotMap = (stored.screenshots as ScreenshotMap) ?? {};
    screenshots[key] = { data, ts: Date.now() };
    pruneByTs(screenshots, SCREENSHOT_CAP);
    await browser.storage.local.set({ screenshots });
  } catch {
    /* capture can fail on discarded / restricted tabs */
  }
}

browser.action.onClicked.addListener(async () => {
  const existing = await findCleanupTab();
  if (existing?.id != null) {
    await browser.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) await browser.windows.update(existing.windowId, { focused: true });
    return;
  }
  lockTrigger();
  browser.tabs.create({ url: browser.runtime.getURL(CLEANUP_PATH), active: true });
});

browser.runtime.onMessage.addListener((rawMsg: unknown, sender: Runtime.MessageSender) => {
  const msg = rawMsg as ToBackground;
  switch (msg.type) {
    case "PROMPT_CLEAN":
      return openCleanup(sender.tab);
    case "PROMPT_SNOOZE":
      return setRuntime({ snoozeUntil: Date.now() + SNOOZE_MS });
    case "POST_CLEANUP_SNOOZE":
      return setRuntime({
        snoozeUntil: Date.now() + POST_CLEANUP_SNOOZE_MS,
        bump: 0,
        bumpUntil: 0,
      });
    case "PROMPT_DISMISS":
      return setRuntime({ snoozeUntil: Date.now() + DISMISS_SNOOZE_MS });
    case "PROMPT_BUMP":
      return bumpFromCurrent();
    case "OPEN_SETTINGS":
      lockTrigger();
      return browser.runtime.openOptionsPage();
    case "OG_META":
      return saveOgMeta(msg.url, msg.meta);
    case "GET_QUEUE":
      return buildQueue();
    case "CLOSE_TABS":
      return browser.tabs.remove(msg.tabIds).catch(() => {});
    case "GET_STATUS":
      return getStatus();
    case "REOPEN_TABS":
      return reopenTabs(msg.tabs);
    case "SETTINGS_CHANGED":
      return handleSettingsChanged(msg.addedWhitelist, msg.addedSkip, msg.screenshotsDisabled);
  }
});

async function getStatus(): Promise<{ count: number; threshold: number; overThreshold: boolean }> {
  const [tabs, settings, runtime] = await Promise.all([
    countableTabs(),
    getSettings(),
    getRuntime(),
  ]);
  const effectiveBump = Date.now() < runtime.bumpUntil ? runtime.bump : 0;
  return {
    count: tabs.length,
    threshold: settings.threshold,
    overThreshold: tabs.length > settings.threshold + effectiveBump,
  };
}

async function bumpFromCurrent(): Promise<void> {
  const [tabs, settings, runtime] = await Promise.all([
    countableTabs(),
    getSettings(),
    getRuntime(),
  ]);
  const currentBump = Date.now() < runtime.bumpUntil ? runtime.bump : 0;
  const target = Math.max(currentBump, tabs.length + 5 - settings.threshold);
  await setRuntime({ bump: target, bumpUntil: Date.now() + BUMP_TTL_MS });
}

async function reopenTabs(tabs: Tab[]): Promise<Tab[]> {
  return Promise.all(
    tabs.map(async (orig) => {
      const created = await browser.tabs.create({ url: orig.url, active: false });
      return {
        ...orig,
        id: created.id ?? orig.id,
        windowId: created.windowId ?? orig.windowId,
      };
    }),
  );
}

async function openCleanup(triggerTab: Tabs.Tab | undefined): Promise<void> {
  if (!triggerTab || triggerTab.id == null) return;
  const url = browser.runtime.getURL(CLEANUP_PATH);
  const isEmpty = !triggerTab.url
    || ["about:newtab", "about:home", "about:blank"].includes(triggerTab.url);
  lockTrigger();
  if (isEmpty) {
    await browser.tabs.update(triggerTab.id, { url });
  } else {
    await browser.tabs.create({ url, active: true });
  }
}

async function saveOgMeta(url: string, meta: OgMeta): Promise<void> {
  const key = urlKey(url);
  if (!key) return;
  const stored = await browser.storage.local.get("ogMeta");
  const ogMeta: OgMetaMap = (stored.ogMeta as OgMetaMap) ?? {};
  ogMeta[key] = { ...meta, ts: Date.now() };
  pruneByTs(ogMeta, OGMETA_CAP);
  await browser.storage.local.set({ ogMeta });
}

async function buildQueue(): Promise<Tab[]> {
  const tabs = await browser.tabs.query({});
  const { whitelist } = await getSettings();
  const stored = await browser.storage.local.get(["lastActive", "screenshots", "ogMeta"]);
  const lastActive: LastActiveMap = (stored.lastActive as LastActiveMap) ?? {};
  const screenshots: ScreenshotMap = (stored.screenshots as ScreenshotMap) ?? {};
  const ogMeta: OgMetaMap = (stored.ogMeta as OgMetaMap) ?? {};
  const cleanupUrl = browser.runtime.getURL(CLEANUP_PATH);
  const now = Date.now();
  return tabs
    .filter((t) => t.id != null && !t.pinned && !t.incognito && t.url !== cleanupUrl)
    .filter((t) => !matchesDomain(domainOf(t.url), whitelist))
    .map((t): Tab => {
      const key = urlKey(t.url) ?? t.url ?? "";
      const shot = screenshots[key];
      return {
        id: t.id as number,
        windowId: t.windowId ?? -1,
        url: t.url ?? "",
        title: t.title ?? "",
        favIconUrl: t.favIconUrl ?? null,
        audible: !!t.audible,
        lastActive: lastActive[key] ?? 0,
        screenshot: shot && now - shot.ts < MAX_AGE_MS ? shot.data : null,
        ogImage: ogMeta[key]?.image ?? null,
      };
    })
    .sort((a, b) => a.lastActive - b.lastActive);
}
