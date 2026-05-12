export type Tab = {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  audible: boolean;
  lastActive: number;
  screenshot: string | null;
  ogImage: string | null;
};
