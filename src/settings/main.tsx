import "@/theme.css";
import { createRoot } from "react-dom/client";
import { SettingsPage } from "./Settings";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<SettingsPage />);
}
