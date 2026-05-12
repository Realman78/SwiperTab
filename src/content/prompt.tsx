import promptCss from "@/theme.css?inline";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TriggerPrompt } from "@/prompt/TriggerPrompt";
import type { Status, ToBackground, ToContent } from "@/lib/messages";

const COUNT_POLL_MS = 2000;

const HOST_ID = "swipertab-prompt-host";

if (window === window.top) {
  scrapeOgMeta();
  browser.runtime.onMessage.addListener((rawMsg) => {
    const msg = rawMsg as ToContent;
    if (msg?.type === "SHOW_PROMPT") showPrompt(msg.count);
  });
}

function getMeta(name: string): string | null {
  const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  return el ? el.getAttribute("content") : null;
}

function scrapeOgMeta() {
  const meta = {
    image: getMeta("og:image") ?? getMeta("twitter:image"),
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    themeColor: getMeta("theme-color"),
  };
  send({ type: "OG_META", url: location.href, meta });
}

function send(msg: ToBackground) {
  browser.runtime.sendMessage(msg).catch(() => {});
}

async function request<T>(msg: ToBackground): Promise<T | null> {
  try {
    return (await browser.runtime.sendMessage(msg)) as T;
  } catch {
    return null;
  }
}

function LivePrompt(props: {
  initialCount: number;
  onCleanup: () => void;
  onSnooze: () => void;
  onMore: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(props.initialCount);
  useEffect(() => {
    const tick = async () => {
      const status = await request<Status>({ type: "GET_STATUS" });
      if (status) setCount(status.count);
    };
    const id = setInterval(tick, COUNT_POLL_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <TriggerPrompt
      tabCount={count}
      onCleanup={props.onCleanup}
      onSnooze={props.onSnooze}
      onMore={props.onMore}
      onSettings={props.onSettings}
      onClose={props.onClose}
    />
  );
}

let activeRoot: Root | null = null;
let activeHost: HTMLElement | null = null;

function showPrompt(count: number) {
  if (activeHost) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position: fixed; inset: 0; z-index: 2147483647; color-scheme: light dark;";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = promptCss;
  shadow.appendChild(style);

  const mount = document.createElement("div");
  shadow.appendChild(mount);

  document.documentElement.appendChild(host);

  activeHost = host;
  activeRoot = createRoot(mount);

  const close = () => {
    activeRoot?.unmount();
    activeHost?.remove();
    activeRoot = null;
    activeHost = null;
  };

  const dispatch = (action: ToBackground["type"]) => () => {
    send({ type: action } as ToBackground);
    close();
  };

  activeRoot.render(
    <LivePrompt
      initialCount={count}
      onCleanup={dispatch("PROMPT_CLEAN")}
      onSnooze={dispatch("PROMPT_SNOOZE")}
      onMore={dispatch("PROMPT_BUMP")}
      onSettings={dispatch("OPEN_SETTINGS")}
      onClose={dispatch("PROMPT_DISMISS")}
    />,
  );
}
