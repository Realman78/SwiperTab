import { useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Layers, Plus, Settings, X } from "lucide-react";

interface Props {
  tabCount: number;
  onCleanup: () => void;
  onSnooze: () => void;
  onMore: () => void;
  onSettings: () => void;
  onClose: () => void;
}

export function TriggerPrompt({ tabCount, onCleanup, onSnooze, onMore, onSettings, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSnooze();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onSnooze]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center p-6 text-foreground"
    >
      <div className="absolute inset-0 bg-gradient-soft" style={{opacity: "0.1"}} />
      <div className="absolute inset-0 backdrop-blur-md bg-background/60" style={{opacity: "0.95"}} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-card overflow-hidden"
      >
        <button
          onClick={onSettings}
          className="absolute top-4 left-4 p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Open settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative px-8 pt-10 pb-6">
          <motion.div
            initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            className="relative mx-auto w-20 h-20 mb-5"
          >
            <div className="absolute inset-0 bg-gradient-primary rounded-3xl shadow-glow rotate-6" />
            <div className="absolute inset-0 bg-card border border-border rounded-3xl flex items-center justify-center">
              <Layers className="w-9 h-9 text-primary" strokeWidth={2.2} />
            </div>
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              className="absolute -top-2 -right-2 min-w-[1.75rem] h-7 px-2 rounded-full bg-gradient-close text-close-foreground text-xs font-bold flex items-center justify-center shadow-soft"
            >
              {tabCount}
            </motion.div>
          </motion.div>

          <h2 className="text-2xl font-bold text-center text-balance text-foreground tracking-tight">
            You have <span className="text-primary">{tabCount} tabs</span> open.
          </h2>
          <p className="mt-2 text-center text-muted-foreground text-balance">
            Quick swipe through to clear out what you don't need.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-2.5">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCleanup}
            className="group w-full relative overflow-hidden rounded-2xl bg-gradient-primary text-primary-foreground font-semibold py-3.5 px-5 shadow-soft"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Layers className="w-4 h-4" />
              Clean up
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </motion.button>

          <div className="grid grid-cols-2 gap-2.5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onSnooze}
              className="rounded-2xl bg-secondary hover:bg-secondary/70 text-secondary-foreground font-medium py-3 px-4 transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <Clock className="w-3.5 h-3.5" />
              Snooze 10m
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onMore}
              className="rounded-2xl bg-secondary hover:bg-secondary/70 text-secondary-foreground font-medium py-3 px-4 transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              5 more tabs
            </motion.button>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-2">
            Press <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">Esc</kbd> to snooze
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
