import browser from "@/lib/browser";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Save } from "lucide-react";
import { DEFAULTS, type Settings } from "@/lib/defaults";
import type { ToBackground } from "@/lib/messages";

const MIN_THRESHOLD = 3;
const MAX_THRESHOLD = 200;
const STATUS_CLEAR_MS = 2000;

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

function parseDomainList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

function formatDomainList(list: string[]): string {
  return list.join("\n");
}

export function SettingsPage() {
  const [threshold, setThreshold] = useState<number>(DEFAULTS.threshold);
  const [whitelist, setWhitelist] = useState<string>("");
  const [skipList, setSkipList] = useState<string>("");
  const [screenshotsEnabled, setScreenshotsEnabled] = useState<boolean>(
    DEFAULTS.screenshotsEnabled,
  );
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalRef = useRef<Settings>(DEFAULTS);

  useEffect(() => {
    browser.storage.sync.get(DEFAULTS).then((stored) => {
      const s = stored as Settings;
      setThreshold(s.threshold);
      setWhitelist(formatDomainList(s.whitelist));
      setSkipList(formatDomainList(s.screenshotSkipDomains));
      setScreenshotsEnabled(s.screenshotsEnabled);
      originalRef.current = s;
      setLoaded(true);
    });
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  function flashSaved() {
    setStatus({ kind: "saved" });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus({ kind: "idle" }), STATUS_CLEAR_MS);
  }

  async function save() {
    const t = Math.round(threshold);
    if (!Number.isFinite(t) || t < MIN_THRESHOLD || t > MAX_THRESHOLD) {
      setStatus({
        kind: "error",
        message: `Threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`,
      });
      return;
    }
    const next: Settings = {
      threshold: t,
      whitelist: parseDomainList(whitelist),
      screenshotSkipDomains: parseDomainList(skipList),
      screenshotsEnabled,
    };
    const prev = originalRef.current;
    const addedWhitelist = next.whitelist.filter((d) => !prev.whitelist.includes(d));
    const addedSkip = next.screenshotSkipDomains.filter(
      (d) => !prev.screenshotSkipDomains.includes(d),
    );
    const screenshotsDisabled = prev.screenshotsEnabled && !next.screenshotsEnabled;
    try {
      await browser.storage.sync.set(next);
      originalRef.current = next;
      const msg: ToBackground = {
        type: "SETTINGS_CHANGED",
        addedWhitelist,
        addedSkip,
        screenshotsDisabled,
      };
      browser.runtime.sendMessage(msg).catch(() => {});
      flashSaved();
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Save failed." });
    }
  }

  return (
    <main className="min-h-screen bg-gradient-soft text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="flex items-center gap-3 mb-10">
          <div className="relative w-11 h-11">
            <div className="absolute inset-0 bg-gradient-primary rounded-2xl shadow-glow rotate-6" />
            <div className="absolute inset-0 bg-card border border-border rounded-2xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SwiperTab</h1>
            <p className="text-sm text-muted-foreground">Settings</p>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 12 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          <Section
            title="Tab threshold"
            description={`Prompt to clean up when you have more than this many tabs open. Pinned and private tabs don't count.`}
          >
            <input
              type="number"
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-32 rounded-xl bg-background border border-input px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Between {MIN_THRESHOLD} and {MAX_THRESHOLD}.
            </p>
          </Section>

          <Section
            title="Never auto-suggest closing"
            description="Tabs whose hostname ends with any of these will be excluded from the cleanup queue. One domain per line."
          >
            <textarea
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              placeholder={"mail.google.com\ncalendar.google.com"}
              rows={5}
              spellCheck={false}
              className="w-full rounded-xl bg-background border border-input px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow resize-y"
            />
          </Section>

          <Section
            title="Page screenshots"
            description="Capture small thumbnails of pages you visit, used to help you identify tabs during cleanup. Stored locally; never uploaded."
          >
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={screenshotsEnabled}
                onChange={(e) => setScreenshotsEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
              />
              <span className="text-sm text-foreground">Capture page screenshots</span>
            </label>
          </Section>

          <Section
            title="Don't capture screenshots on"
            description="Skip the periodic screenshot for these domains. Useful for sensitive sites. One domain per line."
          >
            <textarea
              value={skipList}
              onChange={(e) => setSkipList(e.target.value)}
              placeholder={"bank.example.com\nintranet.work.com"}
              rows={5}
              spellCheck={false}
              className="w-full rounded-xl bg-background border border-input px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow resize-y"
            />
          </Section>

          <div className="flex items-center gap-4 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={save}
              className="group relative overflow-hidden rounded-2xl bg-gradient-primary text-primary-foreground font-semibold py-3 px-6 shadow-soft"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </motion.button>

            <StatusLine status={status} />
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-card border border-border shadow-soft p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground text-balance">{description}</p>
      {children}
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "saved") {
    return (
      <motion.span
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-sm text-[hsl(var(--keep))] font-medium"
      >
        Saved
      </motion.span>
    );
  }
  return <span className="text-sm text-[hsl(var(--close))] font-medium">{status.message}</span>;
}
