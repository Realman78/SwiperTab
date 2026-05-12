import "@/theme.css";
import { createRoot } from "react-dom/client";
import { CleanupFlow } from "./CleanupFlow";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<CleanupFlow />);
}
