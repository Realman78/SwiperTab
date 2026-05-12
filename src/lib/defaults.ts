export type Settings = {
  threshold: number;
  whitelist: string[];
  screenshotSkipDomains: string[];
  screenshotsEnabled: boolean;
};

export const DEFAULTS: Settings = {
  threshold: 15,
  whitelist: [],
  screenshotSkipDomains: [],
  screenshotsEnabled: true,
};
