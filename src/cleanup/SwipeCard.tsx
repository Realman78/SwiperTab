import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Volume2, Clock, Globe } from "lucide-react";
import type { Tab } from "@/lib/tab";
import { domainGradient } from "@/lib/domain-gradient";

export type SwipeDir = "left" | "right" | "up" | "down";

interface Props {
  tab: Tab;
  isTop: boolean;
  index: number;
  onSwipe: (dir: SwipeDir, tab: Tab) => void;
  exitDir?: SwipeDir | null;
  onExitComplete?: () => void;
}

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;
const EXIT_X = 1200;
const EXIT_Y = 1000;
const VIGNETTE_RANGE = 180;

function domainOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function formatAge(lastActive: number): string {
  if (!lastActive) return "—";
  const ms = Date.now() - lastActive;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function SwipeCard({ tab, isTop, index, onSwipe, exitDir, onExitComplete }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-14, 0, 14], { clamp: true });
  const closeOpacity = useTransform(x, [-180, -40, 0], [1, 0.2, 0]);
  const keepOpacity = useTransform(x, [0, 40, 180], [0, 0.2, 1]);
  const keepDomainOpacity = useTransform(y, [-180, -40, 0], [1, 0.2, 0]);
  const closeDomainOpacity = useTransform(y, [0, 40, 180], [0, 0.2, 1]);

  const keepVignetteOpacity = useTransform<number, number>([x, y], (latest) => {
    const [xv, yv] = latest as unknown as [number, number];
    const right = Math.max(0, xv) / VIGNETTE_RANGE;
    const up = Math.max(0, -yv) / VIGNETTE_RANGE;
    return Math.min(1, Math.max(right, up));
  });
  const closeVignetteOpacity = useTransform<number, number>([x, y], (latest) => {
    const [xv, yv] = latest as unknown as [number, number];
    const left = Math.max(0, -xv) / VIGNETTE_RANGE;
    const down = Math.max(0, yv) / VIGNETTE_RANGE;
    return Math.min(1, Math.max(left, down));
  });

  const exiting = exitDir != null;

  const handleEnd = (_: unknown, info: PanInfo) => {
    if (exiting) return;
    const { offset, velocity } = info;
    const swipeX = Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > VELOCITY_THRESHOLD;
    const swipeY = Math.abs(offset.y) > SWIPE_THRESHOLD || Math.abs(velocity.y) > VELOCITY_THRESHOLD;
    if (swipeX && Math.abs(offset.x) >= Math.abs(offset.y)) {
      onSwipe(offset.x > 0 ? "right" : "left", tab);
    } else if (swipeY) {
      onSwipe(offset.y < 0 ? "up" : "down", tab);
    }
  };

  const stackOffset = index * 10;
  const stackScale = 1 - index * 0.04;

  const exitTarget =
    exitDir === "left"  ? { x: -EXIT_X, y: 0 } :
    exitDir === "right" ? { x:  EXIT_X, y: 0 } :
    exitDir === "up"    ? { x: 0, y: -EXIT_Y } :
    exitDir === "down"  ? { x: 0, y:  EXIT_Y } :
    null;

  const domain = domainOf(tab.url);
  const visual = tab.screenshot;
  const previewBackground = visual ? undefined : domainGradient(domain);

  return (
    <motion.div
      drag={isTop && !exiting}
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleEnd}
      style={isTop ? { x, y, rotate } : undefined}
      initial={false}
      animate={
        exiting && exitTarget
          ? { ...exitTarget, opacity: 0 }
          : isTop
            ? { scale: 1, y: 0 }
            : { scale: stackScale, y: stackOffset, opacity: index > 2 ? 0 : 1 }
      }
      transition={
        exiting
          ? { type: "tween", duration: 0.5, ease: [0.4, 0, 0.2, 1] }
          : { type: "spring", stiffness: 260, damping: 26 }
      }
      onAnimationComplete={() => {
        if (exiting) onExitComplete?.();
      }}
      className={`absolute inset-0 ${isTop ? "cursor-grab active:cursor-grabbing z-30" : "z-10 pointer-events-none"}`}
    >
      <div className="relative w-full h-full rounded-3xl bg-card border border-border shadow-card overflow-hidden">
        {/* preview */}
        <div
          className={`relative ${visual ? "h-[22rem]" : "h-44"} overflow-hidden bg-muted`}
          style={previewBackground ? { background: previewBackground } : undefined}
        >
          {visual && (
            <img src={visual} alt="" style={{"objectPosition": "top"}} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/95" />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-card/90 backdrop-blur shadow-soft flex items-center justify-center overflow-hidden">
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="w-5 h-5" />
              ) : (
                <Globe className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            {tab.audible && (
              <div className="px-2.5 py-1 rounded-full bg-card/90 backdrop-blur shadow-soft flex items-center gap-1 text-xs font-medium text-foreground">
                <Volume2 className="w-3 h-3 text-accent" /> playing
              </div>
            )}
          </div>
          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-card/90 backdrop-blur text-xs font-medium text-muted-foreground flex items-center gap-1 shadow-soft">
            <Clock className="w-3 h-3" />
            {formatAge(tab.lastActive)}
          </div>
        </div>

        {/* content */}
        <div className="p-5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Globe className="w-3 h-3" />
            <span className="truncate">{domain}</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground leading-snug line-clamp-2 text-balance">
            {tab.title || "(untitled)"}
          </h3>
          <p className="text-xs text-muted-foreground mt-2 truncate">{tab.url}</p>
        </div>

        {/* directional vignettes */}
        {isTop && (
          <>
            <motion.div
              aria-hidden
              style={{
                opacity: keepVignetteOpacity,
                boxShadow: "inset 0 0 80px 18px hsl(var(--keep))",
              }}
              className="absolute inset-0 rounded-3xl pointer-events-none"
            />
            <motion.div
              aria-hidden
              style={{
                opacity: closeVignetteOpacity,
                boxShadow: "inset 0 0 80px 18px hsl(var(--close))",
              }}
              className="absolute inset-0 rounded-3xl pointer-events-none"
            />
          </>
        )}

        {/* swipe stamps */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: keepOpacity }}
              className="absolute top-8 left-8 px-4 py-2 rounded-2xl bg-gradient-keep text-keep-foreground font-bold text-lg -rotate-12 shadow-glow border-2 border-keep-foreground/40"
            >
              KEEP
            </motion.div>
            <motion.div
              style={{ opacity: closeOpacity }}
              className="absolute top-8 right-8 px-4 py-2 rounded-2xl bg-gradient-close text-close-foreground font-bold text-lg rotate-12 shadow-glow border-2 border-close-foreground/40"
            >
              CLOSE
            </motion.div>
            {/* up = top, down = bottom (matches swipe direction) */}
            <motion.div
              style={{ opacity: keepDomainOpacity }}
              className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-gradient-keep text-keep-foreground font-bold shadow-glow border-2 border-keep-foreground/40 whitespace-nowrap"
            >
              KEEP ALL · {domain}
            </motion.div>
            <motion.div
              style={{ opacity: closeDomainOpacity }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-gradient-close text-close-foreground font-bold shadow-glow border-2 border-close-foreground/40 whitespace-nowrap"
            >
              CLOSE ALL · {domain}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
