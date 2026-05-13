type Target = "firefox" | "chrome";

export function buildManifest(target: Target): Record<string, unknown> {
  const base: Record<string, unknown> = {
    manifest_version: 3,
    name: "SwiperTab",
    version: "1.0.0",
    description: "Clean up your tabs with a swipe.",
    permissions: ["tabs", "storage", "alarms"],
    host_permissions: ["<all_urls>"],
    incognito: "not_allowed",
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png",
      "128": "icons/icon-128.png",
    },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["src/content/prompt.tsx"],
        run_at: "document_idle",
      },
    ],
    options_ui: {
      page: "src/settings/index.html",
      open_in_tab: true,
    },
    action: {
      default_title: "SwiperTab — open cleanup",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
      },
    },
  };

  if (target === "firefox") {
    return {
      ...base,
      browser_specific_settings: {
        gecko: { id: "swipertab@marindedic.com", strict_min_version: "115.0" },
      },
      background: { scripts: ["src/background/index.ts"] },
    };
  }

  return {
    ...base,
    background: { service_worker: "src/background/index.ts", type: "module" },
  };
}
