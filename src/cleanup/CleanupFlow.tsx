import browser from "@/lib/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Check, RotateCcw, Settings, Sparkles, X,
} from "lucide-react";
import type { Tab } from "@/lib/tab";
import type { Status, ToBackground } from "@/lib/messages";
import { TriggerPrompt } from "@/prompt/TriggerPrompt";
import { SwipeCard, type SwipeDir } from "./SwipeCard";

const UNDO_CAP = 50;

type HistoryEntry = { removed: Tab[]; closed: Tab[] };

function send<T = void>(msg: ToBackground): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}

async function exitTab() {
  const t = await browser.tabs.getCurrent();
  if (t?.id != null) await browser.tabs.remove(t.id);
}

function domainOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

export function CleanupFlow() {
  const [loading, setLoading] = useState(true);
  const [initialEmpty, setInitialEmpty] = useState(false);
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<Tab[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [doneStatus, setDoneStatus] = useState<Status | null>(null);
  const [pendingExit, setPendingExit] = useState<{ dir: SwipeDir; tabId: number } | null>(null);

  const queueRef = useRef<Tab[]>(queue);
  queueRef.current = queue;
  const historyRef = useRef<HistoryEntry[]>(history);
  historyRef.current = history;
  const pendingExitRef = useRef<typeof pendingExit>(pendingExit);
  pendingExitRef.current = pendingExit;

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tabs = await send<Tab[]>({ type: "GET_QUEUE" });
      if (cancelled) return;
      setLoading(false);
      if (tabs.length === 0) setInitialEmpty(true);
      setQueue(tabs);
    })();
    return () => { cancelled = true; };
  }, []);

  // Drop tabs from the queue when they're closed externally
  useEffect(() => {
    const onRemoved = (tabId: number) => {
      setQueue((q) => q.filter((t) => t.id !== tabId));
    };
    browser.tabs.onRemoved.addListener(onRemoved);
    return () => browser.tabs.onRemoved.removeListener(onRemoved);
  }, []);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((h) => {
      const next = [...h, entry];
      return next.length > UNDO_CAP ? next.slice(next.length - UNDO_CAP) : next;
    });
  }, []);

  const performSwipe = useCallback(async (dir: SwipeDir, tab: Tab) => {
    const q = queueRef.current;
    if (dir === "left") {
      await send({ type: "CLOSE_TABS", tabIds: [tab.id] });
      pushHistory({ removed: [tab], closed: [tab] });
      setQueue((qq) => qq.filter((t) => t.id !== tab.id));
    } else if (dir === "right") {
      pushHistory({ removed: [tab], closed: [] });
      setQueue((qq) => qq.filter((t) => t.id !== tab.id));
    } else if (dir === "up") {
      const host = domainOf(tab.url);
      const matching = q.filter((t) => domainOf(t.url) === host);
      pushHistory({ removed: matching, closed: [] });
      setQueue((qq) => qq.filter((t) => domainOf(t.url) !== host));
    } else if (dir === "down") {
      const host = domainOf(tab.url);
      const matching = q.filter((t) => domainOf(t.url) === host);
      await send({ type: "CLOSE_TABS", tabIds: matching.map((t) => t.id) });
      pushHistory({ removed: matching, closed: matching });
      setQueue((qq) => qq.filter((t) => domainOf(t.url) !== host));
    }
  }, [pushHistory]);

  const triggerSwipe = useCallback((dir: SwipeDir, tab: Tab) => {
    if (pendingExitRef.current) return;
    setPendingExit({ dir, tabId: tab.id });
  }, []);

  const onExitComplete = useCallback(() => {
    const pe = pendingExitRef.current;
    if (!pe) return;
    pendingExitRef.current = null;
    setPendingExit(null);
    const tab = queueRef.current.find((t) => t.id === pe.tabId);
    if (tab) performSwipe(pe.dir, tab);
  }, [performSwipe]);

  const handleAction = useCallback((dir: SwipeDir) => {
    const q = queueRef.current;
    if (q.length === 0) return;
    triggerSwipe(dir, q[0]);
  }, [triggerSwipe]);

  const skip = useCallback(() => {
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
  }, []);

  const undo = useCallback(async () => {
    const h = historyRef.current;
    const last = h[h.length - 1];
    if (!last) return;
    setHistory((prev) => prev.slice(0, -1));
    let restored = last.removed;
    if (last.closed.length > 0) {
      const reopened = await send<Tab[]>({ type: "REOPEN_TABS", tabs: last.closed });
      const byUrl = new Map(reopened.map((t) => [t.url, t]));
      restored = last.removed.map((t) => byUrl.get(t.url) ?? t);
    }
    setQueue((q) => [...restored, ...q]);
  }, []);

  const continueLater = useCallback(async () => {
    await send({ type: "POST_CLEANUP_SNOOZE" });
    exitTab();
  }, []);

  const openSettings = useCallback(() => {
    browser.runtime.openOptionsPage();
  }, []);

  const visitTab = useCallback(async (tab: Tab) => {
    try {
      await browser.tabs.update(tab.id, { active: true });
      if (tab.windowId >= 0) await browser.windows.update(tab.windowId, { focused: true });
    } catch {
      /* tab may have been closed externally */
    }
  }, []);

  const gateSnooze = useCallback(async () => {
    await send({ type: "PROMPT_SNOOZE" });
    exitTab();
  }, []);

  const gateBump = useCallback(async () => {
    await send({ type: "PROMPT_BUMP" });
    exitTab();
  }, []);

  const gateClose = useCallback(async () => {
    await send({ type: "PROMPT_DISMISS" });
    exitTab();
  }, []);

  // Keyboard (only after gate)
  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); handleAction("left"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); handleAction("right"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); handleAction("up"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); handleAction("down"); }
      else if (e.key === " ") { e.preventDefault(); skip(); }
      else if (e.key === "u" || e.key === "U") undo();
      else if (e.key === "Escape") exitTab();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, handleAction, skip, undo]);

  const closed = history.reduce((n, h) => n + h.closed.length, 0);
  const kept = history.reduce((n, h) => n + (h.removed.length - h.closed.length), 0);
  const topDomain = queue[0] ? domainOf(queue[0].url) : "";
  const initialTotal = queue.length + history.reduce((n, h) => n + h.removed.length, 0);
  const progress = initialTotal > 0 ? (initialTotal - queue.length) / initialTotal : 1;
  const done = !loading && !initialEmpty && queue.length === 0;

  // On done: 5-min auto-snooze + fetch status for the done screen.
  useEffect(() => {
    if (!done) return;
    let cancelled = false;
    (async () => {
      await send({ type: "POST_CLEANUP_SNOOZE" });
      const status = await send<Status>({ type: "GET_STATUS" });
      if (!cancelled) setDoneStatus(status);
    })();
    return () => { cancelled = true; };
  }, [done]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!started) {
    return (
      <TriggerPrompt
        tabCount={queue.length}
        onCleanup={() => setStarted(true)}
        onSnooze={gateSnooze}
        onMore={gateBump}
        onSettings={openSettings}
        onClose={gateClose}
      />
    );
  }

  if (initialEmpty) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-soft text-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-primary shadow-glow flex items-center justify-center mb-5">
          <Sparkles className="w-9 h-9 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Nothing to clean up</h1>
        <p className="text-muted-foreground mb-6">Your open tabs are all pinned or whitelisted.</p>
        <button
          onClick={exitTab}
          className="px-6 py-2.5 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-soft"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-soft overflow-hidden">
      {/* header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">SwiperTab</p>
          <h2 className="text-xl font-bold text-foreground">
            {done ? "All clean ✨" : `${queue.length} to review`}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur border border-border shadow-soft">
            <span className="w-2 h-2 rounded-full bg-keep" />
            <span className="text-sm font-semibold text-foreground">{kept}</span>
            <span className="w-px h-3 bg-border mx-1" />
            <span className="w-2 h-2 rounded-full bg-close" />
            <span className="text-sm font-semibold text-foreground">{closed}</span>
          </div>
          <button
            onClick={continueLater}
            disabled={done}
            className="px-3 py-1.5 rounded-full bg-card/80 backdrop-blur border border-border shadow-soft text-foreground hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
          >
            Continue later
          </button>
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="p-2.5 rounded-full bg-card/80 backdrop-blur border border-border shadow-soft text-foreground hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Undo (U)"
            title="Undo (U)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={openSettings}
            className="p-2.5 rounded-full bg-card/80 backdrop-blur border border-border shadow-soft text-muted-foreground hover:text-foreground hover:bg-card transition"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* progress */}
      <div className="px-6 mb-2">
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full bg-gradient-primary"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* card stack */}
      <div className="flex-1 flex items-center justify-center px-6 py-4 min-h-0">
        <div className="relative w-full max-w-sm aspect-[3/4]">
          <AnimatePresence>
            {done && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 rounded-3xl bg-card border border-border shadow-card flex flex-col items-center justify-center text-center p-8"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-primary shadow-glow flex items-center justify-center mb-5">
                  <Sparkles className="w-9 h-9 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-1">Inbox zero, tab edition.</h3>
                <p className="text-muted-foreground mb-3">
                  Closed <span className="text-foreground font-semibold">{closed}</span>, kept{" "}
                  <span className="text-foreground font-semibold">{kept}</span>.
                </p>
                <p className="text-sm text-muted-foreground mb-2 text-balance">
                  SwiperTab will snooze for 5 minutes.
                </p>
                {doneStatus?.overThreshold && (
                  <p className="text-sm text-muted-foreground mb-4 text-balance">
                    You're still over your threshold of {doneStatus.threshold}.{" "}
                    <button
                      onClick={openSettings}
                      className="underline text-primary hover:text-primary/80"
                    >
                      Raise it in settings
                    </button>
                    .
                  </p>
                )}
                <button
                  onClick={exitTab}
                  className="mt-4 px-6 py-2.5 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-soft"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {queue
            .slice(0, 3)
            .reverse()
            .map((tab, i, arr) => {
              const stackIndex = arr.length - 1 - i;
              const isTopCard = stackIndex === 0;
              const exitDir =
                isTopCard && pendingExit?.tabId === tab.id ? pendingExit.dir : null;
              return (
                <SwipeCard
                  key={tab.id}
                  tab={tab}
                  isTop={isTopCard}
                  index={stackIndex}
                  onSwipe={triggerSwipe}
                  onVisit={visitTab}
                  exitDir={exitDir}
                  onExitComplete={onExitComplete}
                />
              );
            })}
        </div>
      </div>

      {/* controls */}
      <div className="px-6 pb-6 pt-2">
        <div className="flex items-center justify-center gap-3 mb-3">
          <ActionBtn label={`Close all from ${topDomain || "domain"}`} icon={ArrowDown} variant="close" onClick={() => handleAction("down")} disabled={done} />
          <ActionBtn label={`Keep all from ${topDomain || "domain"}`} icon={ArrowUp} variant="keep" onClick={() => handleAction("up")} disabled={done} />
        </div>
        <div className="flex items-center justify-center gap-4">
          <BigBtn variant="close" onClick={() => handleAction("left")} disabled={done}>
            <X className="w-7 h-7" strokeWidth={3} />
          </BigBtn>
          <div className="flex flex-col items-center text-xs text-muted-foreground gap-0.5">
            <div className="flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> close <ArrowRight className="w-3 h-3" /> keep
            </div>
            <div className="text-[10px] uppercase tracking-widest">space = skip · u = undo</div>
          </div>
          <BigBtn variant="keep" onClick={() => handleAction("right")} disabled={done}>
            <Check className="w-7 h-7" strokeWidth={3} />
          </BigBtn>
        </div>
      </div>
    </div>
  );
}

const BigBtn = ({
  variant, children, onClick, disabled,
}: {
  variant: "keep" | "close";
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <motion.button
    whileHover={{ scale: 1.06 }}
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    disabled={disabled}
    className={`w-16 h-16 rounded-full shadow-card flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed border-2 ${
      variant === "keep"
        ? "bg-gradient-keep text-keep-foreground border-keep/40"
        : "bg-gradient-close text-close-foreground border-close/40"
    }`}
  >
    {children}
  </motion.button>
);

const ActionBtn = ({
  label, icon: Icon, variant, onClick, disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "keep" | "close";
  onClick: () => void;
  disabled?: boolean;
}) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-card/80 backdrop-blur border border-border shadow-soft text-xs font-medium text-foreground hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition"
  >
    <Icon className={`w-3.5 h-3.5 ${variant === "keep" ? "text-keep" : "text-close"}`} />
    {label}
  </motion.button>
);
