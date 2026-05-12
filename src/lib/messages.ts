import type { Tab } from "./tab";

export type OgMeta = {
  image: string | null;
  title: string;
  h1: string | null;
  themeColor: string | null;
};

export type ToBackground =
  | { type: "PROMPT_CLEAN" }
  | { type: "PROMPT_SNOOZE" }
  | { type: "PROMPT_DISMISS" }
  | { type: "PROMPT_BUMP" }
  | { type: "POST_CLEANUP_SNOOZE" }
  | { type: "OPEN_SETTINGS" }
  | { type: "OG_META"; url: string; meta: OgMeta }
  | { type: "GET_QUEUE" }
  | { type: "GET_STATUS" }
  | { type: "CLOSE_TABS"; tabIds: number[] }
  | { type: "REOPEN_TABS"; tabs: Tab[] }
  | {
      type: "SETTINGS_CHANGED";
      addedWhitelist: string[];
      addedSkip: string[];
      screenshotsDisabled: boolean;
    };

export type Status = { count: number; threshold: number; overThreshold: boolean };

export type ToContent = { type: "SHOW_PROMPT"; count: number };

export type Reply = {
  GET_QUEUE: Tab[];
};
